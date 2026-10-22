import {db,timestamps} from './index.js';
import {migrate} from './migrate.js';
import {seed} from './seed.js';
import {randomUUID} from 'node:crypto';
import {hashPassword} from '../utils/security.js';
import {password,email} from '../models/validation.js';
try {
 const command=process.argv[2];await migrate(db);
 if(command==='seed')await seed(db);
 else if(command==='bootstrap') {
  const address=email.parse(process.env.ADMIN_EMAIL),pwd=password.parse(process.env.ADMIN_PASSWORD),h=await hashPassword(pwd);
  await db.transaction(async tx=>{
   // Unique bootstrap marker also serialises competing first-administrator requests.
   await tx.insert('schemaVersions',{name:'admin_bootstrap',applied_at:new Date()});
   if(await tx.count('users',{role:'admin'}))throw new Error('An administrator already exists.');
   const id=randomUUID(),name=process.env.ADMIN_NAME||'Administrator';await tx.insert('users',{id,name,email:address,password_hash:h,role:'admin',status:'active',session_version:0,...timestamps()});await tx.insert('profiles',{id:randomUUID(),user_id:id,name,email:address,kind:'both',status:'active',consent:false,phone:'',notes:'',...timestamps()});
  });
 }else if(command!=='migrate')throw new Error('Use migrate, seed or bootstrap');
 console.log(`${command} completed`);
}finally{await db.close();}
