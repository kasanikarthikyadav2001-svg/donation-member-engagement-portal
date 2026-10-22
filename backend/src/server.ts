import { db } from "./database/index.js";
import { migrate } from "./database/migrate.js";
import { config } from "./config.js";
import { createApp, logger } from "./app.js";
import { deliverEmails } from "./services/email.js";
await db.ready();
if (!config.production) await migrate(db);
const server = createApp(db).listen(config.port, "0.0.0.0", () =>
  logger.info({ port: config.port }, "DMEP API started"),
);
let busy = false;
const worker = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await deliverEmails(db);
  } catch (err) {
    logger.error({ err }, "Maintenance worker failed");
  } finally {
    busy = false;
  }
}, 15000);
worker.unref();
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    clearInterval(worker);
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
