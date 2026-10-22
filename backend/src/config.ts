import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const base = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
dotenv.config({ path: path.join(base, ".env"), quiet: true });
export const config = {
  production: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT || 4000),
  origin: process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://127.0.0.1:5173",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0",
  mongoDatabase: process.env.MONGODB_DATABASE || "dmep",
  sessionHours: 12,
  org: process.env.ORGANISATION_NAME || "Sydney Beacon",
  stripeKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhook: process.env.STRIPE_WEBHOOK_SECRET,
  allowSandbox: process.env.ALLOW_SANDBOX_PAYMENTS === "true",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASSWORD,
  mailFrom: process.env.MAIL_FROM || "Beacon <receipts@example.org>",
};
if (
  config.production &&
  (!process.env.MONGODB_URI || !config.origin.startsWith("https://"))
)
  throw new Error("Production requires MONGODB_URI and HTTPS APP_URL");
if (config.production && config.allowSandbox)
  throw new Error("Sandbox simulation must be disabled in production");
