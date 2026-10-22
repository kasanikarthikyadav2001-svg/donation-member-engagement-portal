import { MongoClient, type ClientSession, type Db, type Document } from 'mongodb';
import { config } from '../config.js';
export class Database {
 constructor(readonly client: MongoClient, readonly native: Db, readonly session?: ClientSession) {}
 collection(name:string) { return this.native.collection<Document>(name); }
 get options() { return {session:this.session}; }
 one(name:string,filter:Document) { return this.collection(name).findOne(filter,{...this.options,projection:{_id:0}}); }
 many(name:string,filter:Document={},sort:Document={created_at:-1,id:1},limit=100,skip=0) {return this.collection(name).find(filter,{...this.options,projection:{_id:0}}).sort(sort).skip(skip).limit(limit).toArray();}
 async insert(name:string,value:Document) {await this.collection(name).insertOne(value,this.options);return value;}
 update(name:string,filter:Document,update:Document) {return this.collection(name).updateOne(filter,update,this.options);}
 remove(name:string,filter:Document) {return this.collection(name).deleteMany(filter,this.options);}
 count(name:string,filter:Document={}) {return this.collection(name).countDocuments(filter,this.options);}
 aggregate(name:string,pipeline:Document[]) {return this.collection(name).aggregate(pipeline,this.options).toArray();}
 async transaction<T>(fn:(tx:Database)=>Promise<T>):Promise<T> {
  if(this.session)return fn(this);
  return this.client.withSession(session=>session.withTransaction(()=>fn(new Database(this.client,this.native,session)),{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary',maxCommitTimeMS:10000}));
 }
 async ready() {await this.native.command({ping:1});const h=await this.native.command({hello:1});if(!h.setName&&h.msg!=='isdbgrid')throw new Error('MongoDB requires a replica set or Atlas for transactions.');}
 async close() {if(!this.session)await this.client.close();}
}
export function createDatabase(uri=config.mongoUri,name=config.mongoDatabase) {const c=new MongoClient(uri,{maxPoolSize:20,serverSelectionTimeoutMS:10000});return new Database(c,c.db(name));}
export const db=createDatabase();
export const timestamps=()=>({created_at:new Date(),updated_at:new Date()});
export const literalSearch=(s:string)=>({$regex:s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'});
