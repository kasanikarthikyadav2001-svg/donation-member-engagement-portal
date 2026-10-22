import {randomUUID} from 'node:crypto';
import type {Database} from '../database/index.js';
export async function audit(db:Database,actor:string|null,action:string,type:string,id?:string,details:object={}) {
 await db.insert('auditEvents',{id:randomUUID(),actor_id:actor,action,entity_type:type,entity_id:id||null,details,created_at:new Date()});
}
