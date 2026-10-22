# MongoDB verification record

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
