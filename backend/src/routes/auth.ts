import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {type Database,timestamps} from '../database/index.js';
import {config} from '../config.js';
import {auth} from '../middleware/auth.js';
import {rateLimit} from '../middleware/rateLimit.js';
import {loginSchema,registerSchema,email,password} from '../models/validation.js';
import {token,hashToken,hashPassword,checkPassword} from '../utils/security.js';
import {AppError} from '../utils/errors.js';
import {audit} from '../services/audit.js';
import {enqueueEmail,emailEnabled} from '../services/email.js';
const cookie={httpOnly:true,secure:config.production,sameSite:'lax' as const,path:'/api',maxAge:config.sessionHours*3600000};
export function authRoutes(db:Database) {
 const r=Router();
 const signIn=async(u:any,res:any)=>{
  const t=token(),csrf=token();
  await db.insert('sessions',{token_hash:hashToken(t),user_id:u.id,session_version:u.session_version,csrf_token:csrf,expires_at:new Date(Date.now()+cookie.maxAge),created_at:new Date()});
  res.cookie('dmep_session',t,cookie);res.json({user:{id:u.id,name:u.name,email:u.email,role:u.role,status:u.status},csrfToken:csrf});
 };
 r.post('/login',rateLimit(db,'login',12,900),async(req,res)=>{
  const v=loginSchema.parse(req.body),u=await db.one('users',{email:v.email});
  const valid=await checkPassword(v.password,u?.password_hash||'$2b$12$C6UzMDM.H6dfI/f/IKcEe.OUvfwOTPrNOZ.yawIxqt32yZ.qTaFAK');
  if(!u||!valid||u.status!=='active')throw new AppError(401,'Email or password is incorrect.','INVALID_CREDENTIALS');
  await audit(db,u.id,'signed_in','account',u.id);await signIn(u,res);
 });
 r.post('/register',rateLimit(db,'register',10,3600),async(req,res)=>{
  const v=registerSchema.parse(req.body),id=randomUUID(),h=await hashPassword(v.password);
  await db.transaction(async tx=>{
   if(await tx.one('profiles',{email:v.email}))throw new AppError(409,'A record already uses this email. Ask an administrator to create your account.','EMAIL_EXISTS');
   await tx.insert('users',{id,name:v.name,email:v.email,password_hash:h,role:'donor',status:'active',session_version:0,...timestamps()});
   await tx.insert('profiles',{id:randomUUID(),user_id:id,name:v.name,email:v.email,kind:'donor',status:'active',consent:true,phone:'',notes:'',...timestamps()});
   await audit(tx,id,'registered','account',id);
  });await signIn(await db.one('users',{id}),res);
 });
 r.get('/me',auth(db),async(req,res)=>{res.json({user:req.user,csrfToken:req.csrf});});
 r.post('/logout',auth(db),async(req,res)=>{await db.remove('sessions',{token_hash:req.sessionHash});res.clearCookie('dmep_session',{...cookie,maxAge:undefined});res.json({ok:true});});
 r.patch('/account',auth(db),async(req,res)=>{
  const v=z.object({name:z.string().trim().min(2).max(120)}).strict().parse(req.body);
  await db.transaction(async tx=>{await tx.update('users',{id:req.user!.id},{$set:{name:v.name,updated_at:new Date()}});await tx.update('profiles',{user_id:req.user!.id},{$set:{name:v.name,updated_at:new Date()}});await audit(tx,req.user!.id,'account_updated','account',req.user!.id);});res.json({ok:true});
 });
 r.post('/password',auth(db),async(req,res)=>{
  const v=z.object({currentPassword:z.string().max(128),newPassword:password}).strict().parse(req.body);
  const u=await db.one('users',{id:req.user!.id});
  if(!u||!(await checkPassword(v.currentPassword,u.password_hash)))throw new AppError(400,'Your current password is incorrect.');
  const h=await hashPassword(v.newPassword);
  await db.transaction(async tx=>{
   const changed=await tx.update('users',{id:u.id,password_hash:u.password_hash},{$set:{password_hash:h,updated_at:new Date()},$inc:{session_version:1}});
   if(!changed.matchedCount)throw new AppError(409,'Account changed. Please try again.');
   await tx.remove('sessions',{user_id:u.id,token_hash:{$ne:req.sessionHash}});
   await tx.update('sessions',{token_hash:req.sessionHash},{$set:{session_version:u.session_version+1}});
   await audit(tx,u.id,'password_changed','account',u.id);
  });res.json({ok:true});
 });
 r.post('/forgot-password',rateLimit(db,'reset',6,900),async(req,res)=>{
  const v=z.object({email}).strict().parse(req.body);if(!emailEnabled())throw new AppError(503,'Password recovery is unavailable. Contact your administrator.');
  const u=await db.one('users',{email:v.email,status:'active'});
  if(u){const t=token();await db.transaction(async tx=>{await tx.update('users',{id:u.id},{$inc:{reset_version:1}});await tx.remove('resetTokens',{user_id:u.id});await tx.insert('resetTokens',{token_hash:hashToken(t),user_id:u.id,expires_at:new Date(Date.now()+1800000)});await enqueueEmail(tx,v.email,'Reset your Beacon password',`Reset your password within 30 minutes: ${config.origin}/reset-password?token=${t}`);});}
  res.json({message:'If an active account exists, a reset link will be emailed.'});
 });
 r.post('/reset-password',rateLimit(db,'reset-confirm',10,900),async(req,res)=>{
  const v=z.object({token:z.string().length(64),password}).strict().parse(req.body),h=await hashPassword(v.password);
  await db.transaction(async tx=>{
   const t=await tx.collection('resetTokens').findOneAndDelete({token_hash:hashToken(v.token),expires_at:{$gt:new Date()}},tx.options);
   if(!t)throw new AppError(400,'This reset link is invalid or expired.');
   await tx.update('users',{id:t.user_id},{$set:{password_hash:h,updated_at:new Date()},$inc:{session_version:1}});await tx.remove('sessions',{user_id:t.user_id});await audit(tx,t.user_id,'password_reset','account',t.user_id);
  });res.json({ok:true});
 });return r;
}
