import { db } from './database/index.js';
import { migrate } from './database/migrate.js';
import { ensureAdministrator } from './database/bootstrap.js';
import { startupDiagnostic, type StartupStage } from './utils/startup.js';

// Free hosts lack pre-deploy jobs. Run repeatable setup before accepting traffic.
let stage: StartupStage = 'database_connection';
try {
  await db.ready();
  console.info('Cloud startup: MongoDB connection ready.');
  stage = 'database_schema';
  await migrate(db);
  console.info('Cloud startup: MongoDB schema ready.');
  stage = 'administrator_setup';
  await ensureAdministrator(db);
  console.info('Cloud startup: administrator ready.');
  stage = 'http_server';
  await import('./server.js');
} catch (error: any) {
  // Do not print credentials, connection strings or rejected configuration values.
  console.error(JSON.stringify(startupDiagnostic(error, stage)));
  await db.close();
  process.exitCode = 1;
}
