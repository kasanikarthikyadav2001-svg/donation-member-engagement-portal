# MongoDB application architecture

React and TypeScript call the Express REST API using the existing snake_case JSON contracts. The backend uses the native MongoDB Node.js driver, not Mongoose or a SQL compatibility layer. UUID identifiers remain strings. Financial amounts are integer AUD cents.

Collections: users, profiles, donations, surveys, responses, sessions, resetTokens, emailJobs, auditEvents, webhookEvents, rateLimits and schemaVersions. Donations embed immutable receiptSnapshot; surveys embed bounded questions; responses embed answers. Profiles and participation records remain independent because their lifecycles differ.

Transactions require a replica set or Atlas. Donation fulfilment, receipt snapshot, event deduplication, audit and email outbox commit together. External Stripe and SMTP calls run outside transaction callbacks. Unique indexes protect normalised email, linked profile account, idempotency keys, receipt identity and survey/user pairs. Optional unique fields use partial indexes. Services check references explicitly; MongoDB does not provide foreign keys.

Authentication compares the hashed opaque token, absolute expiry, account active status and session version. TTL indexes clean up expired data but never decide authentication. Survey closure and response submission both write control_version on the same aggregate so simultaneous operations conflict and retry safely.

Email workers atomically claim leased jobs; completion requires matching unexpired ownership. SMTP acceptance followed by process failure may still cause duplicate delivery after recovery. Delivery is at least once, not exactly once.

Local development uses a real MongoDB process with WiredTiger and persistent backend/data-mongo files, bound to loopback. The mongodb-memory-server package manages its executable and replica-set lifecycle; it does not mock MongoDB. Production uses a separately secured MongoDB replica set or Atlas URI and HTTPS. The production container never starts the development database launcher.
