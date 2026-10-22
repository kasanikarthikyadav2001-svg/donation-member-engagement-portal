import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startupDiagnostic} from '../backend/dist/utils/startup.js';
const require=createRequire(new URL('../backend/package.json',import.meta.url));
const {z}=require('zod');
test('startup diagnostics identify connection, authentication, permissions and validation failures without secrets',()=>{
 const secret='NEVER_LOG_THIS_PASSWORD';
 const cases=[
  [{name:'MongoServerSelectionError',message:`timeout mongodb+srv://user:${secret}@private.example/`},'MONGODB_UNREACHABLE'],
  [{code:18,message:`Authentication failed ${secret}`},'MONGODB_AUTHENTICATION_FAILED'],
  [{code:13,message:`not authorized ${secret}`},'MONGODB_PERMISSION_DENIED'],
  [{name:'MongoParseError',message:secret},'INVALID_MONGODB_URI'],
  [{code:121,message:secret},'MONGODB_DOCUMENT_VALIDATION_FAILED'],
  [{code:11000,message:secret},'MONGODB_DUPLICATE_RECORD'],
  [new Error(secret),'STARTUP_ERROR'],
 ];
 for(const [error,category] of cases){const result=startupDiagnostic(error,'database_schema');assert.equal(result.category,category);const text=JSON.stringify(result);assert.ok(!text.includes(secret));assert.ok(!text.includes('private.example'));assert.equal(result.stage,'database_schema');}
 const invalid=z.string().email().safeParse(secret);
 const diagnostic=startupDiagnostic(invalid.error,'administrator_setup');assert.equal(diagnostic.category,'INVALID_ADMIN_CONFIGURATION');assert.ok(!JSON.stringify(diagnostic).includes(secret));
});
