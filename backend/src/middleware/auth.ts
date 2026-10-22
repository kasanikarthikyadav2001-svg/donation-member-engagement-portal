import type {Request,Response,NextFunction} from 'express';
import type {Database} from '../database/index.js';
import {hashToken} from '../utils/security.js';
import {AppError} from '../utils/errors.js';
export type User={id:string;name:string;email:string;role:'admin'|'volunteer'|'member'|'donor';status:string};
declare global {namespace Express {interface Request {user?:User;csrf?:string;sessionHash?:string}}}
export const auth=(db:Database)=>async(req:Request,_res:Response,next:NextFunction)=>{
 try {
  const t=req.cookies?.dmep_session;if(!t)throw new AppError(401,'Please sign in to continue.','UNAUTHENTICATED');
  const h=hashToken(t),s=await db.one('sessions',{token_hash:h,expires_at:{$gt:new Date()}});
  const u=s?await db.one('users',{id:s.user_id,status:'active'}):null;
  if(!u||!s||u.session_version!==s.session_version)throw new AppError(401,'Your session has expired. Please sign in again.','UNAUTHENTICATED');
  req.user={id:u.id,name:u.name,email:u.email,role:u.role,status:u.status};req.csrf=s.csrf_token;req.sessionHash=h;
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.get('x-csrf-token')!==s.csrf_token)throw new AppError(403,'Security check failed. Refresh the page and try again.','CSRF');
  next();
 }catch(e){next(e);}
};
export const roles=(...allowed:User['role'][]) => (req:Request,_res:Response,next:NextFunction)=>allowed.includes(req.user!.role)?next():next(new AppError(403,'You do not have permission to perform this action.','FORBIDDEN'));
export const staff=(u:User)=>['admin','volunteer'].includes(u.role);
