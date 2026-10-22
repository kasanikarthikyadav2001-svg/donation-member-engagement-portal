import nodemailer from 'nodemailer';
import {randomUUID} from 'node:crypto';
import {config} from '../config.js';
import type {Database} from '../database/index.js';
import {receiptPdf} from './receipts.js';
import {AppError} from '../utils/errors.js';
export const emailEnabled=()=>Boolean(config.smtpHost);
export async function enqueueEmail(db:Database,to:string,subject:string,body:string,receiptId?:string) {
 if(!emailEnabled())throw new AppError(503,'Email delivery is not configured. You can download receipts instead.','EMAIL_UNAVAILABLE');
 const id=randomUUID();await db.insert('emailJobs',{id,recipient:to,subject,body,receipt_id:receiptId||null,status:'queued',attempts:0,next_attempt_at:new Date(),created_at:new Date()});return id;
}
export async function claimEmailJob(db:Database,owner:string,leaseMs=120000) {
 const now=new Date();return db.collection('emailJobs').findOneAndUpdate({attempts:{$lt:5},next_attempt_at:{$lte:now},$or:[{status:{$in:['queued','failed']}},{status:'sending',lease_until:{$lte:now}}]},{$set:{status:'sending',lease_owner:owner,lease_until:new Date(+now+leaseMs)},$inc:{attempts:1}},{sort:{created_at:1,id:1},returnDocument:'after'});
}
export async function completeEmailJob(db:Database,id:string,owner:string,error=false) {
 return db.update('emailJobs',{id,status:'sending',lease_owner:owner,lease_until:{$gt:new Date()}},{$set:error?{status:'failed',last_error:'Delivery failed',next_attempt_at:new Date(Date.now()+300000)}:{status:'sent',sent_at:new Date(),last_error:null},$unset:{lease_owner:'',lease_until:''}});
}
export async function deliverEmails(db:Database) {
 if(!emailEnabled())return;
 const transport=nodemailer.createTransport({host:config.smtpHost,port:config.smtpPort,secure:config.smtpPort===465,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:30000,auth:config.smtpUser?{user:config.smtpUser,pass:config.smtpPass}:undefined});
 for(let i=0;i<5;i++) {
  const owner=randomUUID(),j=await claimEmailJob(db,owner);if(!j)break;
  try {
   const d=j.receipt_id?await db.one('donations',{'receiptSnapshot.id':j.receipt_id}):null,r=d?.receiptSnapshot;
   if(j.receipt_id&&!r)throw new Error('Receipt not found');
   await transport.sendMail({from:config.mailFrom,to:j.recipient,subject:j.subject,text:j.body,messageId:`<${j.id}@dmep.local>`,attachments:r?[{filename:`${r.reference}.pdf`,content:await receiptPdf(r)}]:[]});
   await completeEmailJob(db,j.id,owner);
  }catch{await completeEmailJob(db,j.id,owner,true);}
 }
 // SMTP acceptance followed by a crash can still cause duplicate delivery after lease expiry.
}
