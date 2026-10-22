import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {type Database,timestamps,literalSearch} from '../database/index.js';
import {roles,staff,type User} from '../middleware/auth.js';
import {surveySchema,uuid,pageSchema} from '../models/validation.js';
import {audit} from '../services/audit.js';
import {AppError,notFound} from '../utils/errors.js';
export async function surveyEligible(db:Database,s:any,u:User) {return s.audience==='all'||Boolean(await db.one('profiles',{user_id:u.id,kind:{$in:['member','both']},status:'active'}));}
const questions=(v:any)=>v.questions.map((q:any,i:number)=>({...q,id:randomUUID(),position:i}));
export function surveyRoutes(db:Database) {
 const r=Router();
 const find=async(id:string)=>{const s=await db.one('surveys',{id:uuid.parse(id)});if(!s)throw notFound();return s;};
 r.get('/',async(req,res)=>{
  const q=pageSchema.parse(req.query),filter:any={title:literalSearch(q.search)};if(q.status)filter.status=q.status;
  if(!staff(req.user!)){filter.status=q.status&&q.status!=='published'?'__unavailable__':'published';filter.$or=[{closes_at:null},{closes_at:{$gt:new Date()}}];if(!(await surveyEligible(db,{audience:'members'},req.user!)))filter.audience='all';}
  const total=await db.count('surveys',filter),surveys=await db.many('surveys',filter,{created_at:-1,id:1},q.limit,(q.page-1)*q.limit);
  const data=[];for(const s of surveys)data.push({...s,response_count:await db.count('responses',{survey_id:s.id}),responded:Boolean(await db.one('responses',{survey_id:s.id,user_id:req.user!.id}))});
  res.json({data,total,page:q.page,limit:q.limit});
 });
 r.post('/',roles('admin','volunteer'),async(req,res)=>{const v=surveySchema.parse(req.body),id=randomUUID();await db.transaction(async tx=>{await tx.insert('surveys',{id,title:v.title,description:v.description,audience:v.audience,closes_at:v.closesAt?new Date(v.closesAt):null,status:'draft',questions:questions(v),version:1,control_version:0,created_by:req.user!.id,...timestamps()});await audit(tx,req.user!.id,'survey_created','survey',id);});res.status(201).json({id});});
 r.get('/:id',async(req,res)=>{const s=await find(String(req.params.id));if(!staff(req.user!)&&(s.status!=='published'||(s.closes_at&&+s.closes_at<=Date.now())||!(await surveyEligible(db,s,req.user!))))throw notFound();res.json(s);});
 r.patch('/:id',roles('admin','volunteer'),async(req,res)=>{
  const id=uuid.parse(req.params.id),v=surveySchema.parse(req.body);
  await db.transaction(async tx=>{const s=await tx.one('surveys',{id});if(!s)throw notFound();if(s.status!=='draft')throw new AppError(409,'Only draft surveys can be edited.');await tx.update('surveys',{id,status:'draft'},{$set:{title:v.title,description:v.description,audience:v.audience,closes_at:v.closesAt?new Date(v.closesAt):null,questions:questions(v),updated_at:new Date()},$inc:{version:1,control_version:1}});await audit(tx,req.user!.id,'survey_updated','survey',id);});res.json({ok:true});
 });
 r.post('/:id/status',roles('admin','volunteer'),async(req,res)=>{
  const id=uuid.parse(req.params.id),{status}=z.object({status:z.enum(['published','closed'])}).strict().parse(req.body);
  await db.transaction(async tx=>{const s=await tx.one('surveys',{id});if(!s)throw notFound();if((s.status==='draft'&&status!=='published')||s.status==='closed'||(s.status==='published'&&status!=='closed'))throw new AppError(409,'This survey status change is not allowed.');if(status==='published'&&s.closes_at&&+s.closes_at<=Date.now())throw new AppError(400,'Choose a future closing date before publishing.');await tx.update('surveys',{id},{$set:{status,updated_at:new Date()},$inc:{control_version:1}});await audit(tx,req.user!.id,'survey_'+status,'survey',id);});res.json({ok:true});
 });
 r.post('/:id/responses',async(req,res)=>{
  const id=uuid.parse(req.params.id),v=z.object({answers:z.array(z.object({questionId:uuid,value:z.string().trim().max(2000)}).strict()).max(50)}).strict().parse(req.body);
  await db.transaction(async tx=>{
   const s=await tx.one('surveys',{id});if(!s)throw notFound();if(s.status!=='published'||(s.closes_at&&+s.closes_at<=Date.now()))throw new AppError(409,'This survey is no longer accepting responses.');if(!(await surveyEligible(tx,s,req.user!)))throw new AppError(403,'This survey is for active members.');
   const qs=s.questions as any[],values=new Map(v.answers.map(a=>[a.questionId,a.value]));if(values.size!==v.answers.length||v.answers.some(a=>!qs.find(q=>q.id===a.questionId)))throw new AppError(400,'Answers must match this survey.');
   for(const q of qs){const value=values.get(q.id)||'';if(q.required&&!value)throw new AppError(400,`Please answer: ${q.label}`);if(value&&q.type==='choice'&&!q.options.includes(value))throw new AppError(400,'Choose one of the available options.');if(value&&q.type==='rating'&&!/^[1-5]$/.test(value))throw new AppError(400,'Ratings must be between 1 and 5.');}
   // Both closure and submission write this aggregate, preventing stale open-state acceptance.
   await tx.update('surveys',{id,status:'published',version:s.version},{$inc:{control_version:1}});
   if(s.audience==='members')await tx.update('profiles',{user_id:req.user!.id},{$inc:{participation_version:1}});
   await tx.insert('responses',{id:randomUUID(),survey_id:id,user_id:req.user!.id,survey_version:s.version,submitted_at:new Date(),answers:qs.map(q=>({question_id:q.id,value:values.get(q.id)||''}))});await audit(tx,req.user!.id,'survey_responded','survey',id);
  });res.status(201).json({ok:true});
 });
 r.get('/:id/results',roles('admin','volunteer'),async(req,res)=>{const s=await find(String(req.params.id));const rows=await db.aggregate('responses',[{$match:{survey_id:s.id}},{$sort:{submitted_at:1}},{$unwind:'$answers'},{$group:{_id:'$answers.question_id',answers:{$push:'$answers.value'}}}]);res.json({...s,responseCount:await db.count('responses',{survey_id:s.id}),questions:s.questions.map((q:any)=>({...q,answers:rows.find(a=>a._id===q.id)?.answers||[]}))});});return r;
}
