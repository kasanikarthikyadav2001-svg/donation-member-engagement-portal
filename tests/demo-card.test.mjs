import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../frontend/src/utils/demoCard.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {TEST_CARDS,validateDemoCard,formatTestCard,formatExpiry,demoExpiry}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const now=new Date('2026-10-24T12:00:00Z');
const valid={name:'Test Supporter',number:'4242 4242 4242 4242',expiry:'12/29',cvc:'123'};
test('known test cards drive outcomes while other card numbers and codes are rejected',()=>{
 assert.deepEqual(validateDemoCard(valid,now),{errors:{},outcome:'succeeded'});
 for(const card of TEST_CARDS)assert.equal(validateDemoCard({...valid,number:card.number},now).outcome,card.outcome);
 for(const number of ['4111111111111111','5555555555554444','4242424242424243','', 'letters']){const r=validateDemoCard({...valid,number},now);assert.equal(r.outcome,null);assert.ok(r.errors.number);}
 for(const cvc of ['','000','1234'])assert.ok(validateDemoCard({...valid,cvc},now).errors.cvc);
});
test('card form validates expiry bounds and test name; input formatting is predictable',()=>{
 for(const expiry of ['09/26','00/29','13/29','1/29','12/99',''])assert.ok(validateDemoCard({...valid,expiry},now).errors.expiry);
 assert.equal(validateDemoCard({...valid,expiry:'10/26'},now).outcome,'succeeded');
 for(const name of ['','A','x'.repeat(101)])assert.ok(validateDemoCard({...valid,name},now).errors.name);
 assert.equal(formatTestCard('4242424242424242'),'4242 4242 4242 4242');assert.equal(formatExpiry('1229'),'12/29');assert.equal(demoExpiry(now),'12/29');
});
