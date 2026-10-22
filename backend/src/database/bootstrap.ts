import { randomUUID } from 'node:crypto';
import { type Database, timestamps } from './index.js';
import { email, password } from '../models/validation.js';
import { hashPassword } from '../utils/security.js';

/** First-deploy account setup. Restarts never overwrite an existing administrator. */
export async function ensureAdministrator(db: Database) {
  if (await db.count('users', { role: 'admin' })) return false;
  const address = email.parse(process.env.ADMIN_EMAIL);
  const secret = password.parse(process.env.ADMIN_PASSWORD);
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();
  if (name.length < 2 || name.length > 120) throw new Error('ADMIN_NAME must contain 2 to 120 characters.');
  const hash = await hashPassword(secret);
  try {
    return await db.transaction(async tx => {
      if (await tx.count('users', { role: 'admin' })) return false;
      await tx.insert('schemaVersions', { name: 'admin_bootstrap', applied_at: new Date() });
      const id = randomUUID();
      await tx.insert('users', { id, name, email: address, password_hash: hash, role: 'admin', status: 'active', session_version: 0, ...timestamps() });
      await tx.insert('profiles', { id: randomUUID(), user_id: id, name, email: address, kind: 'both', status: 'active', consent: false, phone: '', notes: '', ...timestamps() });
      return true;
    });
  } catch (error: any) {
    if (error.code === 11000 && await db.count('users', { role: 'admin' })) return false;
    throw error;
  }
}
