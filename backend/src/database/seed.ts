import {randomUUID} from 'node:crypto';
import {type Database,timestamps} from './index.js';
import {hashPassword} from '../utils/security.js';
import {issueReceipt} from '../services/receipts.js';
export async function seed(db:Database) {
 if(process.env.NODE_ENV==='production')throw new Error('Demo seeding is disabled in production.');
 if(await db.count('users'))return;
 const pwd=process.env.DEMO_PASSWORD;if(!pwd||pwd.length<12)throw new Error('Set DEMO_PASSWORD with 12 or more characters.');
 const h=await hashPassword(pwd);
 await db.transaction(async tx=>{
  const people=[['Alex Morgan','admin@beacon.local','admin','both'],['Jordan Lee','volunteer@beacon.local','volunteer','member'],['Taylor Chen','member@beacon.local','member','both'],['Sam Wilson','donor@beacon.local','donor','donor'],['Amelia Carter','amelia@example.org','','donor'],['Oliver Brooks','oliver@example.org','','both'],['Mia Patel','mia@example.org','','member'],['Ethan Nguyen','ethan@example.org','','donor'],['Sofia Williams','sofia@example.org','','both'],['Noah Thompson','noah@example.org','','donor'],['Isla Martin','isla@example.org','','member'],['Lucas Anderson','lucas@example.org','','donor']];
  const profiles:string[]=[];let admin='';
  for(const [name,email,role,kind] of people){const uid=role?randomUUID():undefined,pid=randomUUID();if(role)await tx.insert('users',{id:uid,name,email,password_hash:h,role,status:'active',session_version:0,...timestamps()});if(role==='admin')admin=uid!;await tx.insert('profiles',{id:pid,...(uid?{user_id:uid}:{}),name,email,kind,status:'active',phone:'+61 400 000 000',consent:true,notes:'Synthetic demonstration record.',...timestamps()});profiles.push(pid);}
  const campaigns=['Community fund','Youth mentoring','Food relief','Community fund','Food relief'];
  for(let i=0;i<30;i++){const id=randomUUID(),date=new Date();date.setDate(Math.max(1,date.getDate()-(i%8)));date.setMonth(date.getMonth()-Math.floor(i/5));await tx.insert('donations',{id,profile_id:profiles[i%profiles.length],amount_cents:(50+(i*37)%950)*100,currency:'AUD',status:'succeeded',channel:i%3===0?'cash':'bank_transfer',campaign:campaigns[i%5],note:'',idempotency_key:randomUUID(),created_by:admin,created_at:date,updated_at:date});await issueReceipt(tx,id);}
  await tx.insert('surveys',{id:randomUUID(),title:'Shape our next community initiative',description:'Help us choose where to focus our volunteer effort. Responses are linked to your account; summary results omit names.',status:'published',audience:'members',created_by:admin,closes_at:new Date(Date.now()+30*86400000),version:1,control_version:0,...timestamps(),questions:[{id:randomUUID(),label:'Which initiative matters most to you?',type:'choice',required:true,options:['Food relief','Youth mentoring','Environmental care'],position:0},{id:randomUUID(),label:'How connected do you feel to the club?',type:'rating',required:true,options:[],position:1}]});
  await tx.insert('surveys',{id:randomUUID(),title:'Volunteer experience check-in',description:'Tell us what would make volunteering easier.',status:'draft',audience:'all',created_by:admin,closes_at:null,version:1,control_version:0,...timestamps(),questions:[{id:randomUUID(),label:'What could we improve?',type:'text',required:true,options:[],position:0}]});
 });
}
