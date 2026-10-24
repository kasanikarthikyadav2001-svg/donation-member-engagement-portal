import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {createDatabase} from '../backend/dist/database/index.js';
import {migrate} from '../backend/dist/database/migrate.js';
import {createApp} from '../backend/dist/app.js';
import {config} from '../backend/dist/config.js';
import {hashPassword} from '../backend/dist/utils/security.js';
const db=createDatabase(process.env.TEST_MONGODB_URI,'dmep_dummy_test_'+randomUUID().replaceAll('-',''));
let app,donor,other,admin,pid;
const savedMode=config.paymentMode;
async function login(email){const agent=request.agent(app);const r=await agent.post('/api/auth/login').send({email,password:'DummyIntegrationPass123!'});assert.equal(r.status,200);return {agent,csrf:r.body.csrfToken};}
const post=(u,path,value)=>u.agent.post('/api'+path).set('X-CSRF-Token',u.csrf).send(value);
before(async()=>{
 await migrate(db);config.paymentMode='dummy';app=createApp(db);const hash=await hashPassword('DummyIntegrationPass123!');
 for(const [name,role] of [['demo','donor'],['other','donor'],['staff','admin']]){const uid=randomUUID(),profile=randomUUID();await db.insert('users',{id:uid,name,email:name+'@dummy.test',password_hash:hash,role,status:'active',session_version:0,created_at:new Date()});await db.insert('profiles',{id:profile,user_id:uid,name,email:name+'@dummy.test',kind:'donor',status:'active',consent:true,created_at:new Date()});if(name==='demo')pid=profile;}
 donor=await login('demo@dummy.test');other=await login('other@dummy.test');admin=await login('staff@dummy.test');
});
after(async()=>{config.paymentMode=savedMode;await db.native.dropDatabase();await db.close();});
const create=(extra={})=>post(donor,'/donations',{profileId:pid,amount:25.5,channel:'dummy',campaign:'Demo initiative',idempotencyKey:randomUUID(),...extra});
test('dummy mode works without provider secrets and begins with a durable pending checkout',async()=>{
 const configResponse=await request(app).get('/api/config');assert.equal(configResponse.body.dummyPaymentsEnabled,true);assert.equal(configResponse.body.paymentsEnabled,false);
 const r=await create();assert.equal(r.status,201);assert.equal(r.body.donation.status,'pending');assert.equal(r.body.donation.channel,'sandbox');assert.match(r.body.checkoutUrl,new RegExp('/checkout/'+r.body.donation.id+'$'));
 const stored=await db.one('donations',{id:r.body.donation.id});assert.equal(stored.gateway,'dummy');assert.equal(stored.receiptSnapshot,undefined);
 const view=await donor.agent.get(`/api/donations/${stored.id}/checkout`);assert.equal(view.status,200);assert.equal(view.body.amount_cents,2550);
 assert.equal((await other.agent.get(`/api/donations/${stored.id}/checkout`)).status,404);
 assert.equal((await post(other,`/donations/${stored.id}/checkout`,{outcome:'succeeded'})).status,404);
 assert.equal((await request(app).get(`/api/donations/${stored.id}/checkout`)).status,401);
});
test('success creates one simulated receipt and excludes all dummy amounts from real totals',async()=>{
 const key=randomUUID();const [a,b]=await Promise.all([create({idempotencyKey:key}),create({idempotencyKey:key})]);assert.equal(a.status,201);assert.equal(b.status,201);assert.equal(a.body.donation.id,b.body.donation.id);const id=a.body.donation.id;
 const results=await Promise.all([post(donor,`/donations/${id}/checkout`,{outcome:'succeeded'}),post(donor,`/donations/${id}/checkout`,{outcome:'succeeded'})]);for(const r of results)assert.equal(r.status,200);
 assert.equal(results[0].body.receipt_id,results[1].body.receipt_id);
 const d=await db.one('donations',{id});assert.equal(d.receiptSnapshot.sandbox,true);assert.equal(await db.count('auditEvents',{entity_id:id,action:'dummy_payment_succeeded'}),1);
 const pdf=await donor.agent.get(`/api/receipts/${d.receiptSnapshot.id}/download`);assert.equal(pdf.status,200);assert.match(pdf.headers['content-type'],/pdf/);
 assert.equal((await other.agent.get(`/api/receipts/${d.receiptSnapshot.id}/download`)).status,404);
 const dashboard=await donor.agent.get('/api/dashboard');assert.equal(dashboard.body.summary.raised,0);assert.equal(dashboard.body.summary.donation_count,0);assert.ok(dashboard.body.monthly.every(m=>m.amount===0));assert.equal(dashboard.body.campaigns.length,0);
 const report=await admin.agent.get('/api/reports?from=2020-01-01&to=2040-12-31');assert.equal(report.body.summary.raised,0);
 const people=await admin.agent.get('/api/profiles?search=demo@dummy.test');assert.equal(people.body.data[0].total_donated,0);
 assert.equal((await post(donor,`/donations/${id}/checkout`,{outcome:'failed'})).status,409);
});
test('decline and cancellation persist their outcomes without generating success receipts',async()=>{
 for(const outcome of ['failed','cancelled']){const created=await create();const id=created.body.donation.id;const r=await post(donor,`/donations/${id}/checkout`,{outcome});assert.equal(r.status,200);assert.equal(r.body.status,outcome);assert.equal(r.body.receipt_id,undefined);assert.equal((await db.one('donations',{id})).receiptSnapshot,undefined);assert.equal((await post(donor,`/donations/${id}/checkout`,{outcome})).status,200);assert.equal((await post(donor,`/donations/${id}/checkout`,{outcome:'succeeded'})).status,409);}
});
test('dummy checkout rejects forged outcomes, card fields, missing CSRF and non-dummy records',async()=>{
 const c=await create(),id=c.body.donation.id;
 assert.equal((await post(donor,`/donations/${id}/checkout`,{outcome:'paid'})).status,422);
 assert.equal((await post(donor,`/donations/${id}/checkout`,{outcome:'succeeded',cardNumber:'do-not-store'})).status,422);
 assert.equal((await donor.agent.post(`/api/donations/${id}/checkout`).send({outcome:'succeeded'})).status,403);
 const received=await post(admin,'/donations',{profileId:pid,amount:10,channel:'cash',idempotencyKey:randomUUID()});assert.equal(received.status,201);
 assert.equal((await post(donor,`/donations/${received.body.donation.id}/checkout`,{outcome:'succeeded'})).status,404);
 assert.equal((await db.one('donations',{id})).status,'pending');
});
test('disabled dummy mode blocks new and existing checkouts without changing records',async()=>{
 const c=await create(),id=c.body.donation.id;config.paymentMode='disabled';
 try{assert.equal((await create()).status,503);assert.equal((await donor.agent.get(`/api/donations/${id}/checkout`)).status,503);assert.equal((await post(donor,`/donations/${id}/checkout`,{outcome:'succeeded'})).status,503);assert.equal((await db.one('donations',{id})).status,'pending');}
 finally{config.paymentMode='dummy';}
});
