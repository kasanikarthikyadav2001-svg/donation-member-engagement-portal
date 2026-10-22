import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {type Database,timestamps,literalSearch} from '../database/index.js';
import {roles,staff} from '../middleware/auth.js';
import {profileSchema,pageSchema,uuid,password} from '../models/validation.js';
import {audit} from '../services/audit.js';
import {hashPassword} from '../utils/security.js';
import {AppError,notFound} from '../utils/errors.js';
export function profileRoutes(db:Database) {
 const r=Router();
 r.get('/mine',async(req,res)=>{res.json(await db.one('profiles',{user_id:req.user!.id}));});
 r.patch('/mine',async(req,res)=>{
  const v=z.object({phone:profileSchema.shape.phone,consent:z.boolean()}).strict().parse(req.body);
  const p=await db.collection('profiles').findOneAndUpdate({user_id:req.user!.id},{$set:{...v,updated_at:new Date()}},{returnDocument:'after',projection:{_id:0}});if(!p)throw notFound();res.json(p);
 });
 r.get('/',roles('admin','volunteer'),async(req,res)=>{
  const q=pageSchema.parse(req.query),filter:any={$or:[{name:literalSearch(q.search)},{email:literalSearch(q.search)}]};
  if(q.status)filter.status=q.status;if(q.kind)filter.kind={$in:[q.kind,'both']};
  const total=await db.count('profiles',filter);
  const data=await db.aggregate('profiles',[{$match:filter},{$sort:{created_at:-1,id:1}},{$skip:(q.page-1)*q.limit},{$limit:q.limit},{$lookup:{from:'users',localField:'user_id',foreignField:'id',as:'account'}},{$lookup:{from:'donations',let:{pid:'$id'},pipeline:[{$match:{$expr:{$eq:['$profile_id','$$pid']},status:'succeeded',channel:{$ne:'sandbox'}}},{$group:{_id:null,total:{$sum:'$amount_cents'}}}],as:'donated'}},{$set:{role:{$ifNull:[{$arrayElemAt:['$account.role',0]},null]},total_donated:{$ifNull:[{$arrayElemAt:['$donated.total',0]},0]}}},{$unset:['_id','account','donated']}]);
  res.json({data,total,page:q.page,limit:q.limit});
 });
 r.post('/',roles('admin','volunteer'),async(req,res)=>{const v=profileSchema.parse(req.body),id=randomUUID();await db.transaction(async tx=>{await tx.insert('profiles',{id,...v,...timestamps()});await audit(tx,req.user!.id,'profile_created','profile',id);});res.status(201).json({id});});
 r.get('/:id',async(req,res)=>{const p=await db.one('profiles',{id:uuid.parse(req.params.id)});if(!p||(!staff(req.user!)&&p.user_id!==req.user!.id))throw notFound();res.json(p);});
 r.patch('/:id',roles('admin','volunteer'),async(req,res)=>{
  const id=uuid.parse(req.params.id),v=profileSchema.parse(req.body);
  await db.transaction(async tx=>{
   const p=await tx.one('profiles',{id});if(!p)throw notFound();if(p.user_id&&p.email!==v.email)throw new AppError(400,'Account-linked emails cannot be changed here.');
   await tx.update('profiles',{id},{$set:{...v,updated_at:new Date()}});if(p.user_id)await tx.update('users',{id:p.user_id},{$set:{name:v.name,updated_at:new Date()}});await audit(tx,req.user!.id,'profile_updated','profile',id);
  });res.json({ok:true});
 });
 r.post('/:id/account',roles('admin'),async(req,res)=>{
  const id=uuid.parse(req.params.id),v=z.object({password,role:z.enum(['volunteer','member','donor'])}).strict().parse(req.body),h=await hashPassword(v.password);
  await db.transaction(async tx=>{const p=await tx.one('profiles',{id});if(!p)throw notFound();if(p.user_id)throw new AppError(409,'This profile already has an account.');const uid=randomUUID();await tx.insert('users',{id:uid,name:p.name,email:p.email,password_hash:h,role:v.role,status:'active',session_version:0,...timestamps()});await tx.update('profiles',{id},{$set:{user_id:uid,updated_at:new Date()}});await audit(tx,req.user!.id,'account_created','account',uid);});res.status(201).json({ok:true});
 });return r;
}
