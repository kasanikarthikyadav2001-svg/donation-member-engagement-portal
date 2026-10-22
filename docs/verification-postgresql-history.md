# Verification record

Verified locally on 30 September 2026 with Node.js 24.

## Executed checks

- Production compilation: frontend and backend TypeScript checks and Vite production bundle passed.
- Automated tests: 15 passed, zero failed. Unit tests and real SQL integration tests use an isolated embedded PostgreSQL engine (PGlite).
- API coverage: authentication, session hashing, CSRF/origin rejection, role and ownership boundaries, profile validation/search/pagination, atomic donation/receipt creation and retry idempotency, authenticated PDF download, sandbox exclusion from fundraising totals, survey audiences/validation/submission/closure, duplicate webhook handling and amount verification, session revocation, reporting and audit records.
- Browser workflows exercised against the running application: administrator login; supporter creation; received bank-transfer recording; generated receipt download; survey creation and publication; member login and survey submission; mobile navigation and dashboard at a 390 by 844 viewport. The records were synthetic and no money moved.
- Browser testing discovered an authentication-cache issue and inaccessible form labels; both were corrected and the affected login and survey workflows were checked again.
- Production dependency audit rerun with `npm audit --omit=dev --audit-level=high`: zero known vulnerabilities. The workspace lockfile matches both application manifests.
- The running built application returned HTTP 200 with `status: ok` from `/api/health`.

## Checks supplied but requiring an unrestricted runner

The repository includes Playwright desktop/mobile tests and GitHub Actions with PostgreSQL 17. The Playwright suite and CI workflow have not been executed here. Earlier native browser-launch attempts were restricted; a later attempt to reconnect through the browser tool was rejected by its URL policy, and no workaround was attempted. Tablet verification and a final screenshot capture therefore remain unverified.

Docker and a standalone PostgreSQL server were unavailable locally. Container deployment and the network PostgreSQL adapter must be verified using the supplied CI/deployment instructions. Local SQL tests used the actual PostgreSQL engine embedded through PGlite, rather than a mock database.

Stripe checkout and SMTP recovery/receipt delivery need organisation-owned credentials. Webhook business logic was tested with provider-shaped synthetic events; live signature delivery, settlement, email deliverability and HTTPS operation require staging acceptance tests. Those services show unavailable states until configured.

## Release acceptance

Before production release, run CI and the browser suite against staging, verify Docker startup and PostgreSQL backup restoration, connect and verify Stripe/SMTP, and obtain sponsor approval for organisation naming, membership rules, privacy/retention policy and receipt wording. The local preview is a development instance with synthetic data, not a deployed live service.
