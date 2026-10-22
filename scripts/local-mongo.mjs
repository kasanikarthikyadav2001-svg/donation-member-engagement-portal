import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'backend/package.json'));
const {MongoMemoryReplSet}=require('mongodb-memory-server');
require('dotenv').config({path:path.join(root,'.env'),quiet:true});
if(process.env.NODE_ENV==='production')throw new Error('Local MongoDB launcher is development-only. Use Atlas or a secured replica set in production.');
const data=path.join(root,'backend/data-mongo');fs.mkdirSync(data,{recursive:true});
process.env.MONGOMS_DOWNLOAD_DIR=path.join(root,'backend/.mongo-binaries');
process.env.MONGOMS_VERSION=process.env.MONGOMS_VERSION||'7.0.24';
const replica=await MongoMemoryReplSet.create({binary:{version:process.env.MONGOMS_VERSION,downloadDir:process.env.MONGOMS_DOWNLOAD_DIR},instanceOpts:[{port:27017,dbPath:data}],replSet:{name:'rs0',count:1,storageEngine:'wiredTiger',ip:'127.0.0.1'}});
const env={...process.env,NODE_ENV:'development',MONGODB_URI:replica.getUri(),MONGODB_DATABASE:process.env.MONGODB_DATABASE||'dmep',PORT:process.env.PORT||'4100',APP_URL:process.env.APP_URL||'http://127.0.0.1:4100'};
async function command(args){await new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{cwd:root,env,stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`Command exited ${code}`)));});}
let child;
try{
 await command(['backend/dist/database/cli.js','migrate']);
 if(env.DEMO_PASSWORD)await command(['backend/dist/database/cli.js','seed']);
 child=spawn(process.execPath,['backend/dist/server.js'],{cwd:root,env,stdio:'inherit'});
 console.log(`Local MongoDB replica set ready. Open ${env.APP_URL}`);
 const shutdown=()=>child?.kill('SIGTERM');process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
 await new Promise(resolve=>{child.on('exit',resolve);child.on('error',resolve);});
}finally{await replica.stop({doCleanup:false});}
