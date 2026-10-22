import type {Database} from './index.js';
import {isDeepStrictEqual} from 'node:util';
const str={bsonType:'string'},date={bsonType:'date'};
const state=(...x:string[])=>({enum:x});
export async function migrate(db:Database) {
 await db.ready();
 const schemas:Record<string,any>={
 users:{required:['id','name','email','password_hash','role','status','session_version'],properties:{id:str,email:str,role:state('admin','volunteer','member','donor'),status:state('active','inactive'),session_version:{bsonType:'number',minimum:0}}},
 profiles:{required:['id','name','email','kind','status','consent'],properties:{id:str,email:str,kind:state('donor','member','both'),status:state('active','inactive'),consent:{bsonType:'bool'}}},
 donations:{required:['id','profile_id','amount_cents','currency','channel','status','idempotency_key'],properties:{id:str,profile_id:str,amount_cents:{bsonType:['int','long','double'],minimum:100,maximum:100000000,multipleOf:1},currency:state('AUD'),channel:state('cash','bank_transfer','stripe','sandbox'),status:state('pending','succeeded','failed','cancelled'),receiptSnapshot:{bsonType:'object',required:['id','reference','donor_name','donor_email','issued_at','amount_cents'],properties:{issued_at:date}}}},
 surveys:{required:['id','questions','status','audience','version'],properties:{id:str,status:state('draft','published','closed'),audience:state('all','members'),questions:{bsonType:'array',minItems:1,maxItems:50,items:{bsonType:'object',required:['id','label','type','required','options'],properties:{id:str,type:state('text','choice','rating'),required:{bsonType:'bool'},options:{bsonType:'array',maxItems:12}}}}}},
 responses:{required:['id','survey_id','user_id','answers','survey_version'],properties:{answers:{bsonType:'array',maxItems:50}}},
 sessions:{required:['token_hash','user_id','csrf_token','expires_at','session_version'],properties:{expires_at:date}},
 resetTokens:{required:['token_hash','user_id','expires_at'],properties:{expires_at:date}},
 emailJobs:{required:['id','recipient','subject','body','status','attempts','next_attempt_at'],properties:{status:state('queued','sending','sent','failed'),attempts:{bsonType:'number',minimum:0,maximum:5},next_attempt_at:date}},
 auditEvents:{required:['id','action','created_at'],properties:{created_at:date}},webhookEvents:{required:['id','processed_at'],properties:{processed_at:date}},
 rateLimits:{required:['key','count','resets_at'],properties:{resets_at:date}},schemaVersions:{required:['name','applied_at'],properties:{applied_at:date}}
 };
 for(const [name,schema] of Object.entries(schemas)) {
  const validator={$jsonSchema:{bsonType:'object',...schema}};
  const existing=await db.native.listCollections({name}).next();
  if(!existing) {
   try{await db.native.createCollection(name,{validator});}catch(e:any){if(e.code!==48)throw e;}
  } else if(!isDeepStrictEqual('options' in existing ? existing.options?.validator : undefined,validator)) {
   // Altering an existing contract requires a separate dbAdmin release identity.
   await db.native.command({collMod:name,validator,validationLevel:'strict',validationAction:'error'});
  }
  if(!['sessions','resetTokens','rateLimits','schemaVersions'].includes(name))await db.collection(name).createIndex({id:1},{unique:true});
 }
 for(const name of ['users','profiles'])await db.collection(name).createIndex({email:1},{unique:true});
 await db.collection('profiles').createIndex({user_id:1},{unique:true,partialFilterExpression:{user_id:{$type:'string'}}});
 await db.collection('profiles').createIndex({kind:1,status:1,created_at:-1,id:1});
 for(const name of ['sessions','resetTokens']){await db.collection(name).createIndex({token_hash:1},{unique:true});await db.collection(name).createIndex({expires_at:1},{expireAfterSeconds:0});await db.collection(name).createIndex({user_id:1});}
 await db.collection('rateLimits').createIndex({key:1},{unique:true});await db.collection('rateLimits').createIndex({resets_at:1},{expireAfterSeconds:86400});
 await db.collection('schemaVersions').createIndex({name:1},{unique:true});
 await db.collection('donations').createIndex({idempotency_key:1},{unique:true});
 for(const key of ['stripe_session_id','receiptSnapshot.id','receiptSnapshot.reference'])await db.collection('donations').createIndex({[key]:1},{unique:true,partialFilterExpression:{[key]:{$type:'string'}}});
 await db.collection('donations').createIndex({profile_id:1,created_at:-1,id:1});await db.collection('donations').createIndex({status:1,created_at:-1});
 await db.collection('responses').createIndex({survey_id:1,user_id:1},{unique:true});
 await db.collection('surveys').createIndex({status:1,closes_at:1,created_at:-1});await db.collection('emailJobs').createIndex({status:1,next_attempt_at:1,lease_until:1});await db.collection('auditEvents').createIndex({created_at:-1,id:1});
 await db.collection('schemaVersions').updateOne({name:'001_document_schema'},{$setOnInsert:{name:'001_document_schema',applied_at:new Date()}},{upsert:true});
}
