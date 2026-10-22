import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import Stripe from 'stripe';
import {type Database,timestamps,literalSearch} from '../database/index.js';
import {config} from '../config.js';
import {staff} from '../middleware/auth.js';
import {donationSchema,pageSchema,uuid} from '../models/validation.js';
import {audit} from '../services/audit.js';
import {issueReceipt,receiptPdf} from '../services/receipts.js';
import {enqueueEmail} from '../services/email.js';
import {AppError,notFound} from '../utils/errors.js';
export const stripe=config.stripeKey?new Stripe(config.stripeKey):null;
export function donationJoin() {return [{$lookup:{from:'profiles',localField:'profile_id',foreignField:'id',as:'profile'}},{$unwind:'$profile'},{$set:{donor_name:'$profile.name',donor_email:'$profile.email',receipt_id:'$receiptSnapshot.id',reference:'$receiptSnapshot.reference'}}];}
export function donationRoutes(db:Database) {
 const r=Router();
 r.get('/',async(req,res)=>{
  const q=pageSchema.parse(req.query),filter:any={$or:[{donor_name:literalSearch(q.search)},{campaign:literalSearch(q.search)},{reference:literalSearch(q.search)}]};
  if(q.status)filter.status=q.status;if(!staff(req.user!))filter['profile.user_id']=req.user!.id;
  const [result]=await db.aggregate('donations',[...donationJoin(),{$match:filter},{$facet:{data:[{$sort:{created_at:-1,id:1}},{$skip:(q.page-1)*q.limit},{$limit:q.limit},{$unset:['_id','profile','receiptSnapshot']}],total:[{$count:'value'}]}}]);
  res.json({data:result.data,total:result.total[0]?.value||0,page:q.page,limit:q.limit});
 });
 r.post('/',async(req,res)=>{
  const v=donationSchema.parse(req.body),amount=Math.round(v.amount*100);
  if(!staff(req.user!)&&['cash','bank_transfer'].includes(v.channel))throw new AppError(403,'Only staff can record an offline donation.');
  if(v.channel==='sandbox'&&!config.allowSandbox)throw new AppError(400,'Sandbox simulation is disabled.');
  if(v.channel==='stripe'&&(!stripe||!config.stripeWebhook))throw new AppError(503,'Online payments are unavailable. Please contact the club.');
  let profile:any;
  const perform=()=>db.transaction(async tx=>{
   profile=await tx.one('profiles',{id:v.profileId});if(!profile||(!staff(req.user!)&&profile.user_id!==req.user!.id))throw notFound();if(profile.status!=='active')throw new AppError(400,'This profile is inactive.');
   const old=await tx.one('donations',{idempotency_key:v.idempotencyKey});
   if(old){if(old.created_by!==req.user!.id||old.profile_id!==profile.id||old.amount_cents!==amount||old.channel!==v.channel||old.campaign!==v.campaign||old.note!==v.note)throw new AppError(409,'This request key was already used for another donation.');return old;}
   // Write the linked profile to conflict with simultaneous profile lifecycle changes.
   await tx.update('profiles',{id:profile.id},{$inc:{donation_version:1}});
   const d={id:randomUUID(),profile_id:profile.id,amount_cents:amount,currency:'AUD',status:v.channel==='stripe'?'pending':'succeeded',channel:v.channel,campaign:v.campaign,note:v.note,idempotency_key:v.idempotencyKey,created_by:req.user!.id,...timestamps()};
   await tx.insert('donations',d);if(v.channel!=='stripe')await issueReceipt(tx,d.id);await audit(tx,req.user!.id,'donation_created','donation',d.id,{channel:v.channel});return d;
  });
  let result:any;
  try{result=await perform();}catch(e:any){if(e.code!==11000)throw e;result=await perform();}
  let checkoutUrl:string|undefined;
  if(v.channel==='stripe'&&result.status==='pending') {
   const s=await stripe!.checkout.sessions.create({mode:'payment',customer_email:profile.email,line_items:[{price_data:{currency:'aud',product_data:{name:v.campaign},unit_amount:amount},quantity:1}],client_reference_id:result.id,metadata:{donationId:result.id},success_url:`${config.origin}/donations?payment=processing`,cancel_url:`${config.origin}/donations?payment=cancelled`},{idempotencyKey:result.id});
   await db.update('donations',{id:result.id},{$set:{stripe_session_id:s.id}});checkoutUrl=s.url||undefined;
  }
  const {receiptSnapshot,_id,...publicDonation}=result;res.status(201).json({donation:publicDonation,checkoutUrl});
 });return r;
}
export function receiptRoutes(db:Database) {
 const r=Router();
 const find=async(id:string,user:any)=>{
  const d=await db.one('donations',{'receiptSnapshot.id':uuid.parse(id)});if(!d)throw notFound();
  if(!staff(user)){const p=await db.one('profiles',{id:d.profile_id,user_id:user.id});if(!p)throw notFound();}return d.receiptSnapshot;
 };
 r.get('/:id/download',async(req,res)=>{const receipt=await find(String(req.params.id),req.user);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${receipt.reference}.pdf"`,'Cache-Control':'private, no-store'}).send(await receiptPdf(receipt));});
 r.post('/:id/email',async(req,res)=>{const receipt=await find(String(req.params.id),req.user);const id=await db.transaction(async tx=>{const j=await enqueueEmail(tx,receipt.donor_email,`${config.org} donation acknowledgement`,`Thank you, ${receipt.donor_name}. Your donation acknowledgement ${receipt.reference} is attached.`,receipt.id);await audit(tx,req.user!.id,'receipt_email_queued','receipt',receipt.id);return j;});res.status(202).json({jobId:id,message:'Receipt queued for email delivery.'});});return r;
}
export async function handleWebhook(db:Database,event:Stripe.Event) {
 try{await db.transaction(async tx=>{
  if(await tx.one('webhookEvents',{id:event.id}))return;
  await tx.insert('webhookEvents',{id:event.id,processed_at:new Date()});
  if(!['checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed','checkout.session.expired'].includes(event.type))return;
  const session=event.data.object as Stripe.Checkout.Session,id=session.metadata?.donationId;if(!id)return;
  const d=await tx.one('donations',{id});if(!d||d.channel!=='stripe')throw new AppError(400,'Unknown payment record.');
  if(d.stripe_session_id&&d.stripe_session_id!==session.id)throw new AppError(400,'Payment session does not match.');if(d.status==='succeeded')return;
  const success=['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)&&session.payment_status==='paid';
  if(success&&(session.amount_total!==d.amount_cents||session.currency?.toUpperCase()!==d.currency))throw new AppError(400,'Payment amount or currency does not match.');
  const status=success?'succeeded':event.type==='checkout.session.expired'?'cancelled':event.type==='checkout.session.async_payment_failed'?'failed':'pending';
  await tx.update('donations',{id},{$set:{status,stripe_session_id:session.id,updated_at:new Date()}});if(success)await issueReceipt(tx,id);await audit(tx,null,'payment_'+status,'donation',id);
 });}catch(e:any){if(e.code!==11000||!(await db.one('webhookEvents',{id:event.id})))throw e;}
}
