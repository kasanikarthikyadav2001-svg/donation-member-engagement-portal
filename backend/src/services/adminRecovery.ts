import type { Database } from '../database/index.js';
import { email, password } from '../models/validation.js';
import { hashPassword } from '../utils/security.js';
import { AppError } from '../utils/errors.js';
import { audit } from './audit.js';

/** Operator-only utility, intentionally not exposed through a public HTTP route. */
export async function resetAdministratorPassword(db: Database, address: string, secret: string) {
  const normalised = email.parse(address);
  const hash = await hashPassword(password.parse(secret));
  await db.transaction(async tx => {
    const user = await tx.one('users', { email: normalised, role: 'admin', status: 'active' });
    if (!user) throw new AppError(404, 'No active administrator matches that email in the selected database.');
    await tx.update('users', { id: user.id }, {
      $set: { password_hash: hash, updated_at: new Date() },
      $inc: { session_version: 1 },
    });
    await tx.remove('sessions', { user_id: user.id });
    await tx.remove('resetTokens', { user_id: user.id });
    await audit(tx, null, 'administrator_password_reset', 'account', user.id, { method: 'operator_cli' });
  });
}
