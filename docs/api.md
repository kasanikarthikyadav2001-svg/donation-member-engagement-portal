# REST API

Base: /api. Responses are JSON except receipt PDF downloads. Authentication uses the dmep_session cookie. Login/me return csrfToken; authenticated POST/PATCH operations require X-CSRF-Token. Error shape: `{ "error": { "code": "VALIDATION", "message": "...", "fields": {} } }`. Common statuses: 401 unauthenticated, 403 unauthorised/CSRF, 404 unavailable record, 409 conflict, 422 invalid input, 429 rate limit, 503 unavailable integration.

## Dummy checkout

`GET /config` includes `paymentMode` and `dummyPaymentsEnabled`. In dummy mode, submit `POST /donations` with `channel: "dummy"`, the existing donation fields and a unique request key. The response contains a pending sandbox donation and its local `checkoutUrl`. No provider is contacted.

`GET /donations/:id/checkout` returns the authorised dummy checkout summary. `POST /donations/:id/checkout` accepts only `{ "outcome": "succeeded" }`, `failed` or `cancelled`, with the normal cookie and CSRF requirements. No card fields are accepted. A repeated identical outcome returns the existing result; attempting another outcome after completion returns 409. Owner or authorised staff access applies. Disabling dummy mode returns 503 on both checkout routes and blocks new dummy donations.

Successful completion atomically updates the donation, embeds one sandbox receipt and writes its audit event. Storage uses `channel: "sandbox"` with `gateway: "dummy"`, so all existing confirmed fundraising queries exclude it. These records are simulations and are not evidence of payment.

| Method | Path | Purpose |
|---|---|---|
| GET | /health | Database readiness |
| GET | /config | Public availability flags and organisation |
| POST | /auth/login | Email/password sign-in |
| POST | /auth/register | Donor registration with collection consent |
| GET | /auth/me | Current account and CSRF token |
| POST | /auth/logout | Revoke current session |
| PATCH | /auth/account | Update own name |
| POST | /auth/password | Change password using current password |
| POST | /auth/forgot-password | Queue recovery email when SMTP enabled |
| POST | /auth/reset-password | Consume reset token and update password |
| GET | /profiles | Staff paginated profile list |
| POST | /profiles | Staff profile creation |
| GET/PATCH | /profiles/mine | Own profile and communication settings |
| GET/PATCH | /profiles/:id | Read owned/staff profile; staff edit |
| POST | /profiles/:id/account | Administrator creates portal access |
| GET | /donations | Paginated donations, staff-all or own |
| POST | /donations | Record donation or create hosted checkout |
| GET | /receipts/:id/download | Authorised PDF download |
| POST | /receipts/:id/email | Queue receipt email |
| POST | /payments/webhook | Stripe signature-verified event ingestion |
| GET/POST | /surveys | Eligible paginated list / staff creation |
| GET/PATCH | /surveys/:id | Detail / staff edit draft |
| POST | /surveys/:id/status | Staff publish or close |
| POST | /surveys/:id/responses | Submit validated answers once |
| GET | /surveys/:id/results | Staff results |
| GET | /dashboard | Role-scoped aggregate metrics |
| GET | /reports?from=YYYY-MM-DD&to=YYYY-MM-DD | Staff donation ledger |
| GET | /accounts | Administrator account list |
| PATCH | /accounts/:id | Administrator role/status change |
| GET | /audit | Administrator paginated audit events |
| GET | /email-jobs | Latest 50 email delivery jobs |

List parameters: page (1+), limit (1–100, default 10), search, status, and kind for profiles. List responses: `{data, total, page, limit}`. All identifiers are UUIDs except provider event IDs and opaque reset tokens.

Example donation body: `{ "profileId": "uuid", "amount": 50.25, "channel": "bank_transfer", "campaign": "Community fund", "note": "", "idempotencyKey": "uuid" }`. Reuse the request key when retrying the same operation. Reusing it with different content yields 409. Card donations return checkoutUrl; offline/sandbox success creates the receipt immediately.

Survey body: title, description, audience (members/all), closesAt (ISO timestamp or null), and questions [{label,type,required,options}]. Types are text, choice and rating. Choice requires 2–12 unique options. Responses use `{answers:[{questionId,value}]}` with ratings stored as strings 1–5.
