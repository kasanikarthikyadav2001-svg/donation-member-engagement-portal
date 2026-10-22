import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createDatabase} from '../backend/dist/database/index.js';
import {migrate} from '../backend/dist/database/migrate.js';
import {createApp} from '../backend/dist/app.js';
import {hashPassword,hashToken} from '../backend/dist/utils/security.js';
import {claimEmailJob,completeEmailJob} from '../backend/dist/services/email.js';
import {handleWebhook} from '../backend/dist/routes/donations.js';
import {ensureAdministrator} from '../backend/dist/database/bootstrap.js';
import {resetAdministratorPassword} from '../backend/dist/services/adminRecovery.js';
import {checkPassword} from '../backend/dist/utils/security.js';
const db=createDatabase(process.env.TEST_MONGODB_URI,'dmep_storage_test_'+randomUUID().replaceAll('-',''));
let app,uid,pid,agent,csrf;
before(async()=>{
 await migrate(db);app=createApp(db);uid=randomUUID();pid=randomUUID();
 await db.insert('users',{id:uid,name:'Storage member',email:'storage@example.org',password_hash:await hashPassword('StoragePassword123!'),role:'member',status:'active',session_version:0,created_at:new Date()});
 await db.insert('profiles',{id:pid,user_id:uid,name:'Storage member',email:'storage@example.org',kind:'member',status:'active',consent:true,phone:'',notes:'',created_at:new Date()});
 agent=request.agent(app);const login=await agent.post('/api/auth/login').send({email:'storage@example.org',password:'StoragePassword123!'});assert.equal(login.status,200);csrf=login.body.csrfToken;
});
after(async()=>{await db.native.dropDatabase();await db.close();});
test('schema installation is repeatable; optional unique keys and document validators work',async()=>{
 await migrate(db);
 for(let i=0;i<2;i++)await db.insert('donations',{id:randomUUID(),profile_id:pid,amount_cents:100,currency:'AUD',channel:'stripe',status:'pending',idempotency_key:randomUUID(),created_at:new Date()});
 await assert.rejects(db.insert('donations',{id:randomUUID(),profile_id:pid,amount_cents:1.5,currency:'AUD',channel:'stripe',status:'pending',idempotency_key:randomUUID()}),e=>e.code===121);
 await assert.rejects(db.insert('profiles',{id:randomUUID(),user_id:uid,name:'Duplicate',email:'other@example.org',kind:'member',status:'active',consent:true}),e=>e.code===11000);
});
test('multi-document transactions roll back all changes on failure',async()=>{
 const id=randomUUID();await assert.rejects(db.transaction(async tx=>{await tx.insert('auditEvents',{id,action:'rollback',created_at:new Date()});await tx.update('profiles',{id:pid},{$set:{name:'Uncommitted'}});throw new Error('Injected fault');}));
 assert.equal(await db.one('auditEvents',{id}),null);assert.equal((await db.one('profiles',{id:pid})).name,'Storage member');
});
test('expired sessions are rejected before TTL cleanup and session versions revoke access',async()=>{
 const token='x'.repeat(64),csrfToken='y'.repeat(64);await db.insert('sessions',{token_hash:hashToken(token),user_id:uid,session_version:0,csrf_token:csrfToken,expires_at:new Date(Date.now()-1000)});
 assert.equal((await request(app).get('/api/auth/me').set('Cookie',`dmep_session=${token}`)).status,401);
 await db.update('users',{id:uid},{$inc:{session_version:1}});assert.equal((await agent.get('/api/auth/me')).status,401);
 await db.update('users',{id:uid},{$inc:{session_version:-1}});
});
test('only one worker claims a job; expired ownership cannot complete it',async()=>{
 const id=randomUUID();await db.insert('emailJobs',{id,recipient:'mail@example.org',subject:'Test',body:'Test',status:'queued',attempts:0,next_attempt_at:new Date(),created_at:new Date()});
 const claims=await Promise.all([claimEmailJob(db,'worker-a'),claimEmailJob(db,'worker-b')]);assert.equal(claims.filter(Boolean).length,1);
 const owner=claims.find(Boolean).lease_owner;assert.equal((await completeEmailJob(db,id,'wrong-owner')).modifiedCount,0);
 await db.update('emailJobs',{id},{$set:{lease_until:new Date(Date.now()-1000)}});assert.equal((await completeEmailJob(db,id,owner)).modifiedCount,0);
 const recovered=await claimEmailJob(db,'recovery');assert.equal(recovered.id,id);assert.equal(recovered.attempts,2);assert.equal((await completeEmailJob(db,id,'recovery')).modifiedCount,1);
});
test('survey definitions and answers embed; concurrent submissions accept one response',async()=>{
 const sid=randomUUID(),qid=randomUUID();await db.insert('surveys',{id:sid,title:'Concurrent survey',status:'published',audience:'members',closes_at:null,version:1,control_version:0,created_at:new Date(),questions:[{id:qid,label:'Pick',type:'choice',required:true,options:['A','B'],position:0}]});
 const submit=()=>agent.post(`/api/surveys/${sid}/responses`).set('X-CSRF-Token',csrf).send({answers:[{questionId:qid,value:'A'}]});
 const results=await Promise.all([submit(),submit()]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await db.count('responses',{survey_id:sid}),1);
 const response=await db.one('responses',{survey_id:sid});assert.deepEqual(response.answers,[{question_id:qid,value:'A'}]);
 await db.update('surveys',{id:sid},{$set:{status:'closed'}});assert.equal((await submit()).status,409);
});
test('failed payment validation does not retain event marker; concurrent deliveries fulfil once',async()=>{
 const id=randomUUID(),eid=randomUUID();await db.insert('donations',{id,profile_id:pid,amount_cents:1000,currency:'AUD',channel:'stripe',status:'pending',idempotency_key:randomUUID(),stripe_session_id:'cs_storage',created_at:new Date()});
 const event={id:eid,type:'checkout.session.completed',data:{object:{id:'cs_storage',metadata:{donationId:id},payment_status:'paid',currency:'aud',amount_total:999}}};
 await assert.rejects(handleWebhook(db,event));assert.equal(await db.one('webhookEvents',{id:eid}),null);assert.equal((await db.one('donations',{id})).status,'pending');
 event.data.object.amount_total=1000;await Promise.all([handleWebhook(db,event),handleWebhook(db,event)]);const d=await db.one('donations',{id});assert.ok(d.receiptSnapshot.id);assert.equal(await db.count('auditEvents',{entity_id:id,action:'payment_succeeded'}),1);
 await db.update('profiles',{id:pid},{$set:{name:'Changed after issue'}});assert.equal((await db.one('donations',{id})).receiptSnapshot.donor_name,'Storage member');
});
test('expired recovery tokens fail and a valid reset token is consumed once',async()=>{
 for(const [token,expires] of [['e'.repeat(64),Date.now()-1000],['v'.repeat(64),Date.now()+600000]])await db.insert('resetTokens',{token_hash:hashToken(token),user_id:uid,expires_at:new Date(expires)});
 const reset=token=>request(app).post('/api/auth/reset-password').send({token,password:'NewStoragePassword123!'});
 assert.equal((await reset('e'.repeat(64))).status,400);
 const results=await Promise.all([reset('v'.repeat(64)),reset('v'.repeat(64))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
});
test('cloud bootstrap creates one administrator and never resets credentials on restart',async()=>{
 const saved={ADMIN_EMAIL:process.env.ADMIN_EMAIL,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,ADMIN_NAME:process.env.ADMIN_NAME};
 try{
  process.env.ADMIN_EMAIL='cloud-admin@example.org';process.env.ADMIN_PASSWORD='CloudAdminPassword123!';process.env.ADMIN_NAME='Kartheek';
  const results=await Promise.all([ensureAdministrator(db),ensureAdministrator(db)]);
  assert.equal(results.filter(Boolean).length,1);assert.equal(await db.count('users',{role:'admin'}),1);
  const original=await db.one('users',{email:'cloud-admin@example.org'});assert.equal(original.name,'Kartheek');
  process.env.ADMIN_PASSWORD='ChangedEnvironmentPassword123!';assert.equal(await ensureAdministrator(db),false);
  assert.equal((await db.one('users',{id:original.id})).password_hash,original.password_hash);
 }finally{for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test('operator recovery resets only the selected active administrator and revokes sessions atomically',async()=>{
 const u=await db.one('users',{email:'cloud-admin@example.org'});
 await db.insert('sessions',{token_hash:hashToken('operator-session'),user_id:u.id,session_version:u.session_version,csrf_token:'csrf',expires_at:new Date(Date.now()+600000)});
 await db.insert('resetTokens',{token_hash:hashToken('operator-reset'),user_id:u.id,expires_at:new Date(Date.now()+600000)});
 await assert.rejects(resetAdministratorPassword(db,'storage@example.org','NewOperatorPassword123!'));
 await assert.rejects(resetAdministratorPassword(db,u.email,'short'));
 assert.equal(await db.count('sessions',{user_id:u.id}),1);
 await resetAdministratorPassword(db,u.email,'NewOperatorPassword123!');
 const updated=await db.one('users',{id:u.id});
 assert.equal(await checkPassword('NewOperatorPassword123!',updated.password_hash),true);
 assert.equal(updated.session_version,u.session_version+1);
 assert.equal(await db.count('sessions',{user_id:u.id}),0);
 assert.equal(await db.count('resetTokens',{user_id:u.id}),0);
 assert.equal(await db.count('auditEvents',{entity_id:u.id,action:'administrator_password_reset'}),1);
 assert.equal(await checkPassword('NewOperatorPassword123!',(await db.one('users',{id:uid})).password_hash),false);
});
