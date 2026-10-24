# MongoDB verification record

## Dummy gateway verification on 24 October 2026

Production build and frontend/backend TypeScript compilation passed. All 30 unit and MongoDB/API integration tests passed. Five additional gateway tests cover durable pending checkout, role/ownership and CSRF boundaries, duplicate creation/completion, simulated PDF receipts, rejection of real card fields, failed/cancelled states, disabled mode, and exclusion from dashboards, monthly/campaign summaries, reports and supporter totals. A built local instance started against an isolated seeded MongoDB database with dummy mode enabled.

Browser workflows for all three outcomes are supplied for desktop, tablet and mobile. Execution was blocked because the Windows test environment refused the browser downloader subprocess; the in-app browser also could not load its configuration. No visual or automated browser pass is claimed for the dummy checkout. Native browser review remains a deployment acceptance step.

Verified locally on 22 October 2026 with Node.js 24.19.0 and a real MongoDB 7.0.24 single-node replica set.

## Passed

- Backend and frontend TypeScript compilation and Vite production build.
- 22 automated unit and API/database integration tests, zero failures and zero skipped tests.
- Authentication, role and ownership restrictions, CSRF/origin validation, search, pagination, duplicate email, donation idempotency and immutable receipt PDF access.
- Survey audience and answer checks, concurrent single-response enforcement, closure and aggregate results.
- Webhook amount validation, atomic rollback, duplicate event delivery and one-time fulfilment.
- Repeatable validators/index setup, partial unique fields, rollback across collections, TTL-independent expiry, session-version revocation, lease claims/recovery and single-use reset tokens.
- Production dependency audit: zero reported vulnerabilities at this check.
- Local synthetic seed on MongoDB; HTTP 200 from /api/health and /login at port 4100.

## Limits

Automated browser execution, Docker deployment, replica failover, load benchmarks and backup restoration have not yet been verified in this migration. Stripe live callbacks and SMTP delivery require organisation-owned credentials and staging acceptance. The local database is for development only and binds to loopback.

The historical PostgreSQL verification record is retained separately in verification-postgresql-history.md. Old PostgreSQL data is preserved on disk and has not been imported. New MongoDB seed records are synthetic. No production readiness or provider acceptance is inferred from local checks.
