import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
const require=createRequire(path.resolve('backend/package.json'));
const {MongoMemoryReplSet}=require('mongodb-memory-server');
const replica=await MongoMemoryReplSet.create({binary:{version:'7.0.24',downloadDir:path.resolve('backend/.mongo-binaries')},replSet:{name:'e2e-rs',count:1,storageEngine:'wiredTiger',ip:'127.0.0.1'}});
const env={...process.env,NODE_ENV:'development',MONGODB_URI:replica.getUri(),MONGODB_DATABASE:'dmep_e2e',PORT:'4200',APP_URL:'http://127.0.0.1:4200',E2E_BASE_URL:'http://127.0.0.1:4200',DEMO_PASSWORD:randomBytes(18).toString('base64url')+'Aa1!',ALLOW_SANDBOX_PAYMENTS:'true',LOG_LEVEL:'warn'};
function run(args){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,args,{env,stdio:'inherit'});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(new Error(`Process exited ${code}`)));});}
let server;
try{
 await run(['backend/dist/database/cli.js','seed']);
 server=spawn(process.execPath,['backend/dist/server.js'],{env,stdio:'inherit'});
 let ready=false;for(let i=0;i<60;i++){try{if((await fetch(env.E2E_BASE_URL+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}
 if(!ready)throw new Error('E2E server did not become ready');
 await run(['node_modules/@playwright/test/cli.js','test']);
}finally{if(server){server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(resolve,5000).unref();});}await replica.stop();}
