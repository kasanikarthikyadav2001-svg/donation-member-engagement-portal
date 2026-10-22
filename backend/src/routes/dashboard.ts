import {Router} from 'express';
import {z} from 'zod';
import {type Database,literalSearch} from '../database/index.js';
import {staff,roles} from '../middleware/auth.js';
import {pageSchema,uuid} from '../models/validation.js';
import {audit} from '../services/audit.js';
import {AppError,notFound} from '../utils/errors.js';
import {donationJoin} from './donations.js';
export function dashboardRoutes(db:Database) {
 const r=Router();
 r.get('/dashboard',async(req,res)=>{
  const own=staff(req.user!)?{}:{'profile.user_id':req.user!.id},month=new Date();month.setUTCDate(1);month.setUTCHours(0,0,0,0);
  const paid={$and:[{$eq:['$status','succeeded']},{$ne:['$channel','sandbox']}]},prefix=[...donationJoin(),{$match:own}];
  const summary=(await db.aggregate('donations',[...prefix,{$group:{_id:null,donation_count:{$sum:{$cond:[paid,1,0]}},raised:{$sum:{$cond:[paid,'$amount_cents',0]}},this_month:{$sum:{$cond:[{$and:[paid,{$gte:['$created_at',month]}]},'$amount_cents',0]}},pending:{$sum:{$cond:[{$eq:['$status','pending']},1,0]}}}},{$unset:'_id'}]))[0]||{donation_count:0,raised:0,this_month:0,pending:0};
  const f=staff(req.user!)?{}:{user_id:req.user!.id},donors=await db.count('profiles',{...f,status:'active',kind:{$in:['donor','both']}}),members=await db.count('profiles',{...f,status:'active',kind:{$in:['member','both']}});
  const first=new Date(month);first.setUTCMonth(first.getUTCMonth()-5);
  const buckets=await db.aggregate('donations',[...prefix,{$match:{status:'succeeded',channel:{$ne:'sandbox'},created_at:{$gte:first}}},{$group:{_id:{$dateToString:{format:'%Y-%m',date:'$created_at',timezone:'UTC'}},amount:{$sum:'$amount_cents'}}}]);
  const monthly=Array.from({length:6},(_,i)=>{const m=new Date(first);m.setUTCMonth(m.getUTCMonth()+i);return {month:m.toLocaleString('en-AU',{month:'short',timeZone:'UTC'}),amount:buckets.find(b=>b._id===m.toISOString().slice(0,7))?.amount||0};});
  const recent=await db.aggregate('donations',[...prefix,{$sort:{created_at:-1,id:1}},{$limit:5},{$unset:['_id','profile','receiptSnapshot']}]);
  const campaigns=await db.aggregate('donations',[...prefix,{$match:{status:'succeeded',channel:{$ne:'sandbox'}}},{$group:{_id:'$campaign',amount:{$sum:'$amount_cents'},count:{$sum:1}}},{$sort:{amount:-1,_id:1}},{$limit:5},{$project:{_id:0,campaign:'$_id',amount:1,count:1}}]);res.json({summary:{...summary,donors,members},monthly,recent,campaigns});
 });
 r.get('/reports',roles('admin','volunteer'),async(req,res)=>{
  const q=z.object({from:z.string().date(),to:z.string().date()}).parse(req.query);if(q.from>q.to)throw new AppError(400,'Start date must be before end date.');const end=new Date(q.to);end.setUTCDate(end.getUTCDate()+1);
  const data=await db.aggregate('donations',[{$match:{created_at:{$gte:new Date(q.from),$lt:end}}},...donationJoin(),{$sort:{created_at:-1,id:1}},{$project:{_id:0,id:1,created_at:1,donor_name:1,email:'$donor_email',amount_cents:1,currency:1,channel:1,status:1,campaign:1,reference:1}}]);res.json({data,summary:{count:data.length,raised:data.filter(d=>d.status==='succeeded'&&d.channel!=='sandbox').reduce((a,d)=>a+d.amount_cents,0)}});
 });
 r.get('/audit',roles('admin'),async(req,res)=>{
  const q=pageSchema.parse(req.query),filter={$or:[{action:literalSearch(q.search)},{actor_name:literalSearch(q.search)}]};const [out]=await db.aggregate('auditEvents',[{$lookup:{from:'users',localField:'actor_id',foreignField:'id',as:'actor'}},{$set:{actor_name:{$ifNull:[{$arrayElemAt:['$actor.name',0]},'System']}}},{$match:filter},{$facet:{data:[{$sort:{created_at:-1,id:1}},{$skip:(q.page-1)*q.limit},{$limit:q.limit},{$unset:['_id','actor']}],total:[{$count:'value'}]}}]);res.json({data:out.data,total:out.total[0]?.value||0,page:q.page,limit:q.limit});
 });
 r.get('/accounts',roles('admin'),async(req,res)=>{const q=pageSchema.parse(req.query),filter={$or:[{name:literalSearch(q.search)},{email:literalSearch(q.search)}]},users=await db.many('users',filter,{created_at:-1,id:1},q.limit,(q.page-1)*q.limit);res.json({data:users.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,status:u.status,created_at:u.created_at})),total:await db.count('users',filter),page:q.page,limit:q.limit});});
 r.patch('/accounts/:id',roles('admin'),async(req,res)=>{
  const id=uuid.parse(req.params.id),v=z.object({role:z.enum(['admin','volunteer','member','donor']),status:z.enum(['active','inactive'])}).strict().parse(req.body);if(id===req.user!.id&&(v.role!=='admin'||v.status!=='active'))throw new AppError(400,'You cannot remove your own administrator access.');
  await db.transaction(async tx=>{if(!(await tx.update('users',{id},{$set:{...v,updated_at:new Date()},$inc:{session_version:1}})).matchedCount)throw notFound();await tx.remove('sessions',{user_id:id});await audit(tx,req.user!.id,'permissions_updated','account',id,v);});res.json({ok:true});
 });
 r.get('/email-jobs',roles('admin'),async(_req,res)=>{const jobs=await db.many('emailJobs',{}, {created_at:-1,id:1},50);res.json({data:jobs.map(j=>({id:j.id,recipient:j.recipient,subject:j.subject,status:j.status,attempts:j.attempts,last_error:j.last_error,created_at:j.created_at,sent_at:j.sent_at}))});});return r;
}
