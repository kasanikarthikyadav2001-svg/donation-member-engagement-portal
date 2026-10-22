# Free testing deployment

This configuration uses a Render free Node web service and an Atlas free MongoDB cluster. Neither requires buying a domain. Render supplies the HTTPS URL. Choose Free explicitly in both services and do not upgrade to a paid tier. Free services have limits and Render sleeps after 15 idle minutes; email queue processing also pauses while the application sleeps.

## 1 Create the free MongoDB database

1. Sign up at https://www.mongodb.com/cloud/atlas/register or sign in at https://cloud.mongodb.com.
2. Create a project and choose the Free cluster tier, formerly M0. Do not select Flex or a paid dedicated cluster. Choose a region close to the web service.
3. Under Database Access create a dedicated database user with a unique password and readWrite permissions for the dmep database. Your Atlas website login is different from this database user.
4. Under Connect choose Drivers and copy the mongodb+srv connection string. Replace the username and password placeholders with your database credentials. Percent-encode reserved characters in the password. Never commit or paste the completed URI into public chat or GitHub.

## 2 Create the free Render service

1. Sign up at https://dashboard.render.com using GitHub and authorise the project repository.
2. Choose New then Blueprint and select kasanikarthikyadav2001-svg/donation-member-engagement-portal. Render reads render.yaml. Confirm the web service uses the Free plan.
3. Supply MONGODB_URI privately in Render, ADMIN_EMAIL for your portal login, and a new ADMIN_PASSWORD with at least 12 characters including uppercase, lowercase and a number. This is a portal password, not your GitHub password. ADMIN_NAME defaults to Kartheek.
4. Apply the Blueprint. No paid database or disk is part of this Blueprint. It is normal for the first attempt to fail until Atlas permits the Render service network.
5. Open the service Connect menu and copy its outbound IP ranges. Add these ranges to Atlas Network Access. Avoid allowing every internet address when the service IP ranges can be used. Also add your own temporary IP only if needed for database administration.
6. Redeploy after saving network access. The build compiles both parts of the app. The cloud start command applies the MongoDB schema and creates the first administrator transactionally. Restarts never reset an existing administrator or seed public demo accounts.
7. Open the HTTPS address shown by Render and sign in using ADMIN_EMAIL and ADMIN_PASSWORD. The app derives its origin from RENDER_EXTERNAL_URL; do not set APP_URL to localhost. A custom APP_URL is only needed if you intentionally use another public HTTPS hostname.

## 3 Verify the deployed application

Visit /api/health and confirm status ok. Sign in as administrator, create a synthetic supporter, record an actual test fixture as a staff donation only in this testing environment, download its PDF, and create and publish a survey. Confirm anonymous visitors cannot open protected records. Do not enter real donor information while validating the deployment. Initial fundraising dashboards are empty because no demo accounts or fabricated fundraising data are seeded into the public deployment.

Without Stripe and SMTP configuration, card payments and email recovery/delivery are shown as unavailable; supporter management, received donation recording, PDF downloads, surveys, reports and role controls still work. Do not treat a test deployment as live fundraising until provider and organisational acceptance are complete.

## Troubleshooting

- Build failed: inspect the first build error, confirm Node 24, repository root and the exact build command from render.yaml.
- Startup database timeout: check Atlas username/password, encoded URI and the Render outbound IP ranges in the Atlas access list.
- Administrator configuration rejected: set a valid ADMIN_EMAIL and a password matching the stated rules. Do not include the password in screenshots.
- Login or CSRF failures: remove any localhost APP_URL from Render and redeploy. Use the exact HTTPS service address.
- Slow first request: free Render services sleep when idle. Wait for the service to wake; do not add paid upgrades unless you choose to.

Reference documentation: https://render.com/docs/free, https://render.com/docs/blueprint-spec, https://render.com/docs/environment-variables and https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/.
