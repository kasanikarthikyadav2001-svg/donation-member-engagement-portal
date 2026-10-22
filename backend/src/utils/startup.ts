import { ZodError } from 'zod';

export type StartupStage = 'database_connection' | 'database_schema' | 'administrator_setup' | 'http_server';

/** Only emit fixed diagnostic text, never driver messages, URIs or rejected values. */
export function startupDiagnostic(error: any, stage: StartupStage) {
  const message = String(error?.message || '');
  const code = error?.code ?? error?.cause?.code;
  let category = 'STARTUP_ERROR';
  let hint = 'Check the deployment configuration and the last successful startup stage.';
  if (error instanceof ZodError || (error?.name === 'ZodError' && Array.isArray(error?.issues))) {
    category = 'INVALID_ADMIN_CONFIGURATION';
    hint = 'ADMIN_EMAIL must be valid. ADMIN_PASSWORD must have 12 to 128 characters, uppercase, lowercase and a number.';
  } else if (error?.name === 'MongoParseError') {
    category = 'INVALID_MONGODB_URI';
    hint = 'Use the complete Atlas Drivers URI. Replace placeholders and percent-encode reserved password characters.';
  } else if (code === 18 || /authentication failed|bad auth|auth failed/i.test(message)) {
    category = 'MONGODB_AUTHENTICATION_FAILED';
    hint = 'Check the Atlas database username and current database password in MONGODB_URI. Atlas website credentials are different.';
  } else if (code === 13 || /not authorized|unauthorized/i.test(message)) {
    category = 'MONGODB_PERMISSION_DENIED';
    hint = 'Grant the database user readWrite on MONGODB_DATABASE. Changing existing validators requires a dbAdmin release identity.';
  } else if (error?.name === 'MongoServerSelectionError' || error?.name === 'MongoNetworkError' || /ENOTFOUND|ECONNREFUSED|querySrv|timed out/i.test(message)) {
    category = 'MONGODB_UNREACHABLE';
    hint = 'Check the Atlas cluster is active, the URI hostname is correct and Atlas Network Access includes the Render outbound IP ranges.';
  } else if (code === 121) {
    category = 'MONGODB_DOCUMENT_VALIDATION_FAILED';
    hint = 'The database contains a document that does not meet the application schema. Review schema and database selection.';
  } else if (code === 11000) {
    category = 'MONGODB_DUPLICATE_RECORD';
    hint = 'A unique record conflicts with initial setup. Check whether the administrator email already belongs to another account.';
  } else if (/replica set|Transaction numbers/i.test(message)) {
    category = 'MONGODB_TRANSACTIONS_UNAVAILABLE';
    hint = 'Use an Atlas cluster or a transaction-capable MongoDB replica set.';
  } else if (/ADMIN_NAME must/i.test(message)) {
    category = 'INVALID_ADMIN_CONFIGURATION';
    hint = 'ADMIN_NAME must contain 2 to 120 characters.';
  }
  return { event: 'cloud_startup_failed', stage, category, hint };
}
