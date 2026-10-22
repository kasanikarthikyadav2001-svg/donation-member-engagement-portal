import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import path from 'node:path';
const require=createRequire(path.resolve('backend/package.json'));
const {MongoMemoryReplSet}=require('mongodb-memory-server');
let replica;
try {
 if(!process.env.TEST_MONGODB_URI) {
  replica=await MongoMemoryReplSet.create({binary:{version:'7.0.24',downloadDir:path.resolve('backend/.mongo-binaries')},replSet:{name:'test-rs',count:1,storageEngine:'wiredTiger',ip:'127.0.0.1'}});
  process.env.TEST_MONGODB_URI=replica.getUri();
 }
 const code=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--test','--test-isolation=none','--test-concurrency=1','tests/unit.test.mjs','tests/startup.test.mjs','tests/integration.test.mjs','tests/mongodb.test.mjs'],{env:process.env,stdio:'inherit'});p.on('error',reject);p.on('exit',resolve);});
 process.exitCode=code??1;
}finally{if(replica)await replica.stop();}
