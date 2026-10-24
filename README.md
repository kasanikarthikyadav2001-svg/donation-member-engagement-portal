# Donation and Member Engagement Portal

A full-stack donation and membership application for Sydney Beacon. React and TypeScript frontend, Express REST API, native MongoDB persistence, secure sessions, role permissions, Stripe hosted checkout, PDF acknowledgements, surveys and reporting.

## Requirements

- Node.js 24 and npm.
- MongoDB Atlas or a transaction-capable replica set for normal deployment.
- The local launcher can download and start a real single-node MongoDB replica set. Its first download requires internet access and approximately 600 MB on Windows.

## Local setup

```powershell
Copy-Item .env.example .env
npm ci
```

Set your own `DEMO_PASSWORD` with at least 12 characters in `.env`, then:

```powershell
npm run build
npm run start:local
```

Open http://127.0.0.1:4100. The local launcher starts a persistent MongoDB process on loopback port 27017, applies collection validators and indexes, seeds an empty development database if DEMO_PASSWORD is supplied, and starts the built application. Close the launcher to stop its services. Development data lives in `backend/data-mongo`; downloaded binaries live in `backend/.mongo-binaries`. Both are excluded from Git and Docker builds. This unauthenticated local database must never be exposed publicly.

Synthetic seeded accounts use the password you set:

| Role | Email |
| --- | --- |
| Administrator | admin@beacon.local |
| Volunteer | volunteer@beacon.local |
| Member | member@beacon.local |
| Donor | donor@beacon.local |

Existing PostgreSQL data in `backend/data` is preserved but is not automatically imported into MongoDB. The MongoDB development seed is a separate synthetic dataset. Back up and reconcile historical data before any real deployment; do not delete the old directory as a migration step.

## Existing MongoDB or Docker development database

Use an Atlas URI or start the optional local database with:

```powershell
docker compose -f docker-compose.mongo.yml up -d
```

Set `MONGODB_URI` and `MONGODB_DATABASE` in `.env`. For the provided Docker development database use `mongodb://127.0.0.1:27017/?replicaSet=rs0`. Then:

```powershell
npm run build
npm run db:migrate
npm run db:seed
npm start
```

`npm run dev` starts the API and Vite for source development against an already running database. Set APP_URL to the Vite origin, normally http://127.0.0.1:5173; set it back to http://127.0.0.1:4100 when serving the built application locally.

## MongoDB design

The native driver stores users, profiles, donations, surveys, responses, sessions, resetTokens, emailJobs, auditEvents, webhookEvents, rateLimits and schemaVersions. Receipt snapshots are embedded in donations, questions in surveys, and answers in responses. UUID strings and the existing REST response fields remain compatible with the frontend.

Unique and partial unique indexes protect email, linked account identity, request keys, provider sessions, receipts and survey participation. Multi-document transactions keep fulfilment, event deduplication, audit and email enqueue consistent. Standalone MongoDB servers are rejected at startup. Schema setup is repeatable and versioned.

Sessions store hashed opaque tokens and compare absolute expiry, account status and session version on every request. TTL cleanup does not grant access. Password recovery consumes tokens once. Roles, object ownership, CSRF and origin checks are enforced by the API. Email workers use atomic claims with recoverable ownership leases and up to five attempts; SMTP delivery remains at least once.

## Dummy payment gateway

The default `PAYMENT_GATEWAY_MODE=dummy` enables a clearly labelled demonstration checkout without Stripe keys. A normal donor chooses an amount and initiative, continues to `/checkout/:id`, and selects a simulated success, decline or cancellation. No card, expiry or CVV field is collected. The authenticated API validates ownership and saves the outcome in MongoDB. Repeated completion requests cannot issue duplicate receipts or change a completed outcome.

Dummy donations store `channel=sandbox` and `gateway=dummy`. Successful simulations receive a PDF explicitly marked as a sandbox acknowledgement. Failed/cancelled simulations receive no success receipt. All dummy amounts are excluded from confirmed fundraising totals, campaign/month summaries and supporter contribution totals. They remain visible as simulation records in the ledger. This feature is for demonstration, not payment processing.

Set `PAYMENT_GATEWAY_MODE=disabled` to disable dummy checkout. Set it to `stripe` and configure matching Stripe API/webhook secrets to use hosted provider checkout instead. The older `ALLOW_SANDBOX_PAYMENTS` switch governs a separate development-only immediate simulation; leave it false on Render. Dummy mode is independently available on the public testing deployment.

For Render: push the latest source, set `PAYMENT_GATEWAY_MODE` to `dummy` in Environment, and deploy the latest commit. Keep the existing cloud start command. No database data deletion or new secret is needed.

## Automated test commands

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Unit and integration tests use an isolated real MongoDB replica set managed by the test runner. Set TEST_MONGODB_URI to use an existing test replica set instead. Each integration suite creates and deletes only its own uniquely named database. Browser tests start an isolated seeded replica set and application on port 4200; Playwright covers desktop and mobile workflows. CI follows the same sequence.

For a runner that cannot launch child processes, start MongoDB separately, set TEST_MONGODB_URI, then run `node --test --test-isolation=none --test-concurrency=1 tests/unit.test.mjs tests/integration.test.mjs tests/mongodb.test.mjs`. Do not point test fixtures or load tools at production.

## GitHub

Push source files, package manifests and the lockfile. `.gitignore` excludes credentials, database files, executable downloads, dependencies and build output. Never upload `.env` or enter secrets into a commit message. GitHub Actions runs compilation, MongoDB tests, browser checks and a production dependency audit. Repository hosting alone does not run Express or MongoDB; GitHub Pages cannot host this full backend.

## Production deployment

For a free testing deployment with an included HTTPS hostname, follow [the Render and MongoDB Atlas guide](docs/free-deployment.md). The repository includes a free-plan `render.yaml` Blueprint and a cloud startup command that creates the first administrator without demo seeding.

Use a maintained MongoDB Atlas cluster or secured replica set with authentication, restricted network access, TLS and tested backups. Create a database identity with only the permissions needed by the application; run collection and index setup using a separate release identity when necessary.

Configure NODE_ENV=production, MONGODB_URI, MONGODB_DATABASE, an HTTPS APP_URL and ALLOW_SANDBOX_PAYMENTS=false. Keep secrets in the hosting provider's environment configuration. Build the supplied Dockerfile or run a locked install and `npm run build`. Execute `node backend/dist/database/cli.js migrate` before traffic, then start `node backend/dist/server.js`. The production application does not automatically migrate or seed data.

The main `docker-compose.yml` deploys the release job and application against your configured external MongoDB URI. Run `docker compose up --build -d` after configuring `.env`. Put a TLS reverse proxy in front of port 4000; the supplied Caddy example is optional. A hosting provider's HTTPS hostname can be used without purchasing a domain. Configure TRUST_PROXY only for the actual trusted proxy topology.

Create the first administrator using ADMIN_EMAIL, ADMIN_PASSWORD and optional ADMIN_NAME, then `node backend/dist/database/cli.js bootstrap`. Existing administrator access prevents another bootstrap. Never seed demo accounts in production.

Enable Stripe only with STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, and configure the signed webhook endpoint `/api/payments/webhook`. Only verified matching events authorise settlement. SMTP_HOST and sender credentials enable password recovery and receipt email; otherwise the interface reports these functions unavailable while PDF downloads remain usable. No real provider settlement or deliverability is implied by synthetic tests.

Before release, verify Docker startup, HTTPS, provider test callbacks, SMTP delivery, backup restoration, performance and sponsor approval of naming, membership, privacy, retention and receipt wording. See `docs/verification.md` for executed checks and remaining limitations.
