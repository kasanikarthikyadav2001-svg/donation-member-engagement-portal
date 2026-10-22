import { db } from './database/index.js';
import { migrate } from './database/migrate.js';
import { ensureAdministrator } from './database/bootstrap.js';

// Free hosts lack pre-deploy jobs. Run repeatable setup before accepting traffic.
try {
  await migrate(db);
  await ensureAdministrator(db);
  await import('./server.js');
} catch (error: any) {
  // Do not print credentials, connection strings or rejected configuration values.
  console.error('Cloud startup failed. Verify MongoDB access, ADMIN_EMAIL and ADMIN_PASSWORD. No traffic was accepted.');
  await db.close();
  process.exitCode = 1;
}
