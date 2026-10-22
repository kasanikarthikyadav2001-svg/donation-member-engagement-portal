# DMEP requirements and decisions

Sources analysed: ICT802 assessment brief, DMEP project proposal and the ten-slide project progress presentation supplied by the project team. The presentation establishes the previous design stage, not evidence of completed implementation. The application uses React and TypeScript, Express REST APIs and native MongoDB persistence.

## Implemented requirements

| ID | Requirement | Implementation | Verification |
|---|---|---|---|
| AUTH-01 | Secure authentication and role permissions | Salted bcrypt passwords, opaque hashed session tokens, MongoDB sessions, CSRF checks, origin checks, rate limits | API integration and browser sign-in |
| AUTH-02 | Account lifecycle | Registration, account creation, role/status administration, logout, password change, SMTP-backed recovery | Unit, API and browser tests |
| DATA-01 | Donor and member records | Separate profiles/accounts, donor/member/both relationship, status, consent, notes, search and pagination | API and browser tests |
| PAY-01 | Record received donations | Authorised cash and bank-transfer recording, exact integer cents, request idempotency | API and browser tests |
| PAY-02 | Hosted card payments | Stripe Checkout, signed raw-body webhook, amount/currency checks, idempotent fulfilment | Webhook integration tests; provider end-to-end requires credentials |
| REC-01 | Donation/receipt traceability | One unique receipt per successful donation, immutable snapshot, authenticated PDF download | Database assertions and browser download |
| REC-02 | Receipt emails | SMTP-backed durable queue, retries, status view | Requires configured SMTP; never reports delivery as sent before acceptance |
| SUR-01 | Surveys | Draft builder, text/choice/rating questions, required answers, audience, closing time, publish/close | API and browser tests |
| SUR-02 | Responses and results | One submission per account, validated answers, aggregate results without respondent names | API and browser tests |
| RPT-01 | Dashboard and reports | SQL-derived totals, six-month activity, campaign breakdown, donor history, CSV exports | API tests and browser verification |
| SEC-01 | Security and operational accountability | Parameterised SQL, object ownership, audit events, restricted errors, security headers, secret redaction | API security tests and dependency audit |
| OPS-01 | Delivery | Separate frontend/backend, migrations, seed, Docker, health check, deployment documentation, tests and CI | Local build and tests; Docker not available in the build environment |

## Explicit defaults requiring business confirmation before live use

- Sydney Beacon is the configured display name; change ORGANISATION_NAME to the official name.
- Administrators manage accounts, permissions and audit history. Volunteers manage profiles, donations, surveys and reports. Members and donors access their own donations and audience-eligible surveys.
- The profile relationship, not the account-role label, determines survey membership eligibility. Administrators approve membership by editing a profile. Public registration creates donor records only.
- Accounts have one profile; profiles can exist without a login. Email is unique, and account-linked emails are immutable through profile editing.
- Surveys are identifiable at storage level, accept one submission and do not allow answer editing. Staff results omit names. Anonymous surveys are not claimed.
- Survey distribution is through the authorised portal. No mass mailing or campaign automation is included.
- Currency is AUD. Online payments use hosted Stripe Checkout. Staff cash and transfer recording is an acknowledgement that funds have been received; it does not perform bank reconciliation.
- Receipts are donation acknowledgements, without tax-deductibility claims. Reference, name, email, amount and initiative are stored as an immutable issuance snapshot.
- Sandbox simulation is optional development functionality, labelled throughout, excluded from totals, and prohibited in production.
- Historical migration, accounting, CRM, AI, native apps and multi-branch management remain outside the supplied business scope.
- No legal compliance certification is asserted. Club-specific privacy notices, legal obligations, retention periods and receipt wording require sponsor/legal review.

## Release boundaries

Live card processing requires merchant configuration and verified provider testing. Email requires an SMTP service and sender-domain configuration. Production deployment requires an HTTPS hosting address and MongoDB replica set or Atlas. The Docker configuration and external services cannot be verified in this environment without Docker and provider credentials. See verification.md for the exact checks performed.
