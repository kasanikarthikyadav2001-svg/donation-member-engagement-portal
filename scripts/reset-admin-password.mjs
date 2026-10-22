import {createDatabase} from '../backend/dist/database/index.js';
import {resetAdministratorPassword} from '../backend/dist/services/adminRecovery.js';
import {startupDiagnostic} from '../backend/dist/utils/startup.js';

// Secrets arrive over stdin, never command-line arguments or an on-disk file.
let db;
try {
 let raw='';
 for await(const chunk of process.stdin){raw+=chunk;if(raw.length>16384)throw new Error('Input too large');}
 const input=JSON.parse(raw.replace(/^\uFEFF/,''));raw='';
 if(typeof input.uri!=='string'||!/^mongodb(?:\+srv)?:\/\//.test(input.uri.trim()))throw Object.assign(new Error(),{inputCode:'URI_REQUIRED'});
 if(typeof input.database!=='string'||!/^[a-zA-Z0-9_-]{1,63}$/.test(input.database))throw Object.assign(new Error(),{inputCode:'DATABASE_REQUIRED'});
 input.uri=input.uri.trim();
 db=createDatabase(input.uri,input.database);
 await db.ready();
 await resetAdministratorPassword(db,input.email,input.password);
 input.uri='';input.password='';
 console.log('Website administrator password reset successfully. Previous sessions and reset links were revoked.');
}catch(error){
 const diagnostic=startupDiagnostic(error,'administrator_setup');
 if(error?.inputCode==='URI_REQUIRED')console.error('The first input must be the FULL connection string beginning mongodb+srv://, not just the database password. No database change was made.');
 else if(error?.inputCode==='DATABASE_REQUIRED')console.error('Provide the database name containing the website users, for example Cluster0. No database change was made.');
 else if(error?.status===404)console.error('No active administrator matches the email in that database. Check the database name and account email.');
 else if(diagnostic.category==='STARTUP_ERROR')console.error('Reset failed. Check the connection string, database name and input format. No success was recorded.');
 else console.error(JSON.stringify(diagnostic));
 process.exitCode=1;
}finally{if(db)await db.close();}
