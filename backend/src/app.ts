import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type { Database } from "./database/index.js";
import { config } from "./config.js";
import { AppError } from "./utils/errors.js";
import { auth } from "./middleware/auth.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profiles.js";
import {
  donationRoutes,
  receiptRoutes,
  handleWebhook,
  stripe,
} from "./routes/donations.js";
import { surveyRoutes } from "./routes/surveys.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { emailEnabled } from "./services/email.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: [
    "req.headers.cookie",
    "req.headers.authorization",
    "req.headers.x-csrf-token",
    "res.headers.set-cookie",
  ],
});
export function createApp(db: Database) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(pinoHttp({ logger, genReqId: () => randomUUID() }));
  app.use(cors({ origin: config.origin, credentials: true }));
  app.get("/api/health", async (_req, res) => {
    await db.native.command({ ping: 1 });
    res.json({ status: "ok" });
  });
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "256kb" }),
    async (req, res) => {
      if (!stripe || !config.stripeWebhook)
        throw new AppError(503, "Payment integration is not configured.");
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.get("stripe-signature") || "",
          config.stripeWebhook,
        );
      } catch {
        throw new AppError(400, "Invalid webhook signature.");
      }
      await handleWebhook(db, event);
      res.json({ received: true });
    },
  );
  app.use(
    "/api",
    express.json({ limit: "128kb" }),
    cookieParser(),
    rateLimit(db, "api", 300),
    (req, res, next) => {
      res.set("Cache-Control", "no-store");
      const origin = req.get("origin");
      if (
        !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
        origin &&
        origin !== config.origin
      )
        return next(new AppError(403, "Request origin is not permitted."));
      next();
    },
  );
  app.get("/api/config", (_req, res) => {
    res.json({
      organisation: config.org,
        paymentsEnabled: config.paymentMode === 'stripe' && Boolean(stripe && config.stripeWebhook),
        dummyPaymentsEnabled: config.paymentMode === 'dummy',
        paymentMode: config.paymentMode,
      sandboxEnabled: config.allowSandbox,
      emailEnabled: emailEnabled(),
    });
  });
  app.use("/api/auth", authRoutes(db));
  app.use("/api/profiles", auth(db), profileRoutes(db));
  app.use("/api/donations", auth(db), donationRoutes(db));
  app.use("/api/receipts", auth(db), receiptRoutes(db));
  app.use("/api/surveys", auth(db), surveyRoutes(db));
  app.use("/api", auth(db), dashboardRoutes(db));
  const frontend = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../frontend/dist",
  );
  if (fs.existsSync(path.join(frontend, "index.html"))) {
    app.use(
      express.static(frontend, {
        index: false,
        maxAge: config.production ? "1h" : 0,
      }),
    );
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) =>
      res.sendFile(path.join(frontend, "index.html")),
    );
  }
  app.use((_req, _res, next) =>
    next(new AppError(404, "This endpoint does not exist.", "NOT_FOUND")),
  );
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (err instanceof ZodError) {
        res
          .status(422)
          .json({
            error: {
              code: "VALIDATION",
              message: err.errors[0]?.message || "Please check the form.",
              fields: err.flatten().fieldErrors,
            },
          });
        return;
      }
      if (err.code === 11000) {
        res
          .status(409)
          .json({
            error: {
              code: "CONFLICT",
              message:
                "This record already exists. Check the email or whether you already submitted.",
            },
          });
        return;
      }
      if (err.code === 121) {
        res
          .status(409)
          .json({
            error: {
              code: "CONFLICT",
              message: "The record does not match database validation rules.",
            },
          });
        return;
      }
      if (err instanceof AppError) {
        res
          .status(err.status)
          .json({ error: { code: err.code, message: err.message } });
        return;
      }
      if (err.type === "entity.parse.failed") {
        res
          .status(400)
          .json({
            error: {
              code: "INVALID_JSON",
              message: "Request body must be valid JSON.",
            },
          });
        return;
      }
      if (err.type === "entity.too.large") {
        res
          .status(413)
          .json({
            error: { code: "TOO_LARGE", message: "Request is too large." },
          });
        return;
      }
      logger.error({ err, requestId: req.id }, "Unhandled request error");
      res
        .status(500)
        .json({
          error: {
            code: "INTERNAL",
            message: "Something went wrong. Please try again.",
            requestId: req.id,
          },
        });
    },
  );
  return app;
}
