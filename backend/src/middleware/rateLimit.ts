import type {Request,Response,NextFunction} from 'express';
import type {Database} from '../database/index.js';
import {hashToken} from '../utils/security.js';
export function rateLimit(db:Database,label:string,max:number,seconds=60) {
 return async(req:Request,res:Response,next:NextFunction)=>{
  try {
   const key=label+':'+hashToken(req.ip||'unknown'),now=new Date();let row;
   try {row=await db.collection('rateLimits').findOneAndUpdate({key},[{$set:{key,count:{$cond:[{$gt:['$resets_at',now]},{$add:['$count',1]},1]},resets_at:{$cond:[{$gt:['$resets_at',now]},'$resets_at',new Date(+now+seconds*1000)]}}}],{upsert:true,returnDocument:'after'});}
   catch(e:any){if(e.code!==11000)throw e;row=await db.collection('rateLimits').findOneAndUpdate({key},{$inc:{count:1}},{returnDocument:'after'});}
   if(row&&row.count>max){res.set('Retry-After',String(Math.max(1,Math.ceil((+row.resets_at-Date.now())/1000))));res.status(429).json({error:{code:'RATE_LIMIT',message:'Too many attempts. Please try again shortly.'}});return;}next();
  }catch(e){next(e);}
 };
}
