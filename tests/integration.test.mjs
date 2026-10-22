import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { randomUUID } from "node:crypto";
process.env.LOG_LEVEL = "silent";
const { createDatabase, db: unusedDb } =
  await import("../backend/dist/database/index.js");
const { migrate } = await import("../backend/dist/database/migrate.js");
const { createApp } = await import("../backend/dist/app.js");
const { config } = await import("../backend/dist/config.js");
const { hashPassword, hashToken } =
  await import("../backend/dist/utils/security.js");
const { handleWebhook } = await import("../backend/dist/routes/donations.js");
const db = createDatabase(process.env.TEST_MONGODB_URI, "dmep_test_" + randomUUID().replaceAll("-", ""));
let app, admin, member, donor, volunteer;
let profileId, memberProfile;
const pwd = "IntegrationPassword123!";
async function signIn(email) {
  const agent = request.agent(app);
  const r = await agent.post("/api/auth/login").send({ email, password: pwd });
  assert.equal(r.status, 200);
  return { agent, csrf: r.body.csrfToken, user: r.body.user };
}
const post = (u, p, b) =>
  u.agent
    .post("/api" + p)
    .set("X-CSRF-Token", u.csrf)
    .send(b);
before(async () => {
  await migrate(db);
  config.allowSandbox = true;
  const h = await hashPassword(pwd);
  for (const [name, role, kind] of [
    ["Admin", "admin", "both"],
    ["Member", "member", "member"],
    ["Donor", "donor", "donor"],
    ["Volunteer", "volunteer", "member"],
  ]) {
    const uid = randomUUID(),
      pid = randomUUID();
    await db.insert('users', {id:uid,name,email:role+'@test.org',password_hash:h,role,status:'active',session_version:0,created_at:new Date(),updated_at:new Date()});
    await db.insert('profiles', {id:pid,user_id:uid,name,email:role+'@test.org',kind,status:'active',consent:true,phone:'',notes:'',created_at:new Date(),updated_at:new Date()});
    if (role === "donor") profileId = pid;
    if (role === "member") memberProfile = pid;
  }
  app = createApp(db);
  admin = await signIn("admin@test.org");
  member = await signIn("member@test.org");
  donor = await signIn("donor@test.org");
  volunteer = await signIn("volunteer@test.org");
});
after(async () => {
  await db.native.dropDatabase();
  await db.close();
  await unusedDb.close();
});
test("health check and unauthenticated access", async () => {
  assert.equal((await request(app).get("/api/health")).status, 200);
  assert.equal((await request(app).get("/api/dashboard")).status, 401);
});
test("CSRF and cross-origin requests are denied", async () => {
  assert.equal((await admin.agent.post("/api/profiles").send({})).status, 403);
  assert.equal(
    (
      await post(admin, "/profiles", {}).set(
        "Origin",
        "https://attacker.example",
      )
    ).status,
    403,
  );
});
test("profiles support creation, search, update, pagination and email uniqueness", async () => {
  const body = {
    name: "New Person",
    email: "person@test.org",
    kind: "both",
    consent: true,
  };
  const r = await post(admin, "/profiles", body);
  assert.equal(r.status, 201);
  const q = await admin.agent.get("/api/profiles?search=New%20Person&limit=1");
  assert.equal(q.body.total, 1);
  assert.equal(q.body.data[0].name, "New Person");
  assert.equal((await post(admin, "/profiles", body)).status, 409);
  const update = await admin.agent
    .patch("/api/profiles/" + r.body.id)
    .set("X-CSRF-Token", admin.csrf)
    .send({ ...body, status: "inactive" });
  assert.equal(update.status, 200);
  assert.equal(
    (await admin.agent.get("/api/profiles?status=inactive")).body.total,
    1,
  );
});
test("donors cannot list other profiles or manage accounts", async () => {
  assert.equal((await donor.agent.get("/api/profiles")).status, 403);
  assert.equal(
    (await donor.agent.get("/api/profiles/" + memberProfile)).status,
    404,
  );
  assert.equal((await donor.agent.get("/api/accounts")).status, 403);
  assert.equal((await volunteer.agent.get("/api/accounts")).status, 403);
});
test("donation and receipt creation is atomic, idempotent and access-controlled", async () => {
  const v = {
    profileId,
    amount: 123.45,
    channel: "bank_transfer",
    campaign: "Test campaign",
    idempotencyKey: randomUUID(),
  };
  const [a, b] = await Promise.all([
    post(admin, "/donations", v),
    post(admin, "/donations", v),
  ]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.body.donation.id, b.body.donation.id);
  const receipt = (await db.one('donations',{id:a.body.donation.id})).receiptSnapshot;
  assert.equal(receipt.amount_cents,12345);
  assert.equal(await db.count('donations',{id:a.body.donation.id,'receiptSnapshot.id':{$exists:true}}),1);
  assert.equal(
    (await post(admin, "/donations", { ...v, amount: 99 })).status,
    409,
  );
  assert.equal(
    (await member.agent.get("/api/receipts/" + receipt.id + "/download"))
      .status,
    404,
  );
  const pdf = await donor.agent.get(
    "/api/receipts/" + receipt.id + "/download",
  );
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers["content-type"], /pdf/);
  assert.ok(pdf.body.length > 500);
  assert.equal(
    (await post(donor, "/donations", { ...v, idempotencyKey: randomUUID() }))
      .status,
    403,
  );
});
test("sandbox donations work for own profile but never inflate confirmed totals", async () => {
  const r = await post(donor, "/donations", {
    profileId,
    amount: 50,
    channel: "sandbox",
    idempotencyKey: randomUUID(),
  });
  assert.equal(r.status, 201);
  assert.equal(
    (
      await post(donor, "/donations", {
        profileId: memberProfile,
        amount: 50,
        channel: "sandbox",
        idempotencyKey: randomUUID(),
      })
    ).status,
    404,
  );
  const s = await donor.agent.get("/api/dashboard");
  assert.equal(Number(s.body.summary.raised), 12345);
  assert.equal(s.body.monthly.length, 6);
  assert.equal(
    (await db.one('donations',{id:r.body.donation.id})).receiptSnapshot.sandbox,
    true,
  );
});
test("surveys enforce drafts, audience, choice validation, single submission and closure", async () => {
  const create = await post(admin, "/surveys", {
    title: "Integration survey",
    audience: "members",
    questions: [
      { label: "Pick a colour", type: "choice", options: ["Blue", "Green"] },
      { label: "Your rating", type: "rating" },
    ],
  });
  assert.equal(create.status, 201);
  const id = create.body.id;
  assert.equal((await member.agent.get("/api/surveys/" + id)).status, 404);
  assert.equal(
    (await post(admin, "/surveys/" + id + "/status", { status: "published" }))
      .status,
    200,
  );
  const s = (await member.agent.get("/api/surveys/" + id)).body;
  assert.equal((await donor.agent.get("/api/surveys/" + id)).status, 404);
  assert.equal(
    (await post(donor, "/surveys/" + id + "/responses", { answers: [] }))
      .status,
    403,
  );
  const answers = [
    { questionId: s.questions[0].id, value: "Blue" },
    { questionId: s.questions[1].id, value: "5" },
  ];
  assert.equal(
    (
      await post(member, "/surveys/" + id + "/responses", {
        answers: [...answers, { questionId: randomUUID(), value: "extra" }],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post(member, "/surveys/" + id + "/responses", {
        answers: [{ ...answers[0], value: "Red" }, answers[1]],
      })
    ).status,
    400,
  );
  assert.equal(
    (await post(member, "/surveys/" + id + "/responses", { answers })).status,
    201,
  );
  assert.equal(
    (await post(member, "/surveys/" + id + "/responses", { answers })).status,
    409,
  );
  assert.equal(
    (await admin.agent.get("/api/surveys/" + id + "/results")).body
      .responseCount,
    1,
  );
  assert.equal(
    (await post(admin, "/surveys/" + id + "/status", { status: "closed" }))
      .status,
    200,
  );
  assert.equal(
    (await post(volunteer, "/surveys/" + id + "/responses", { answers }))
      .status,
    409,
  );
});
test("webhook processing checks amounts and duplicate events create one receipt", async () => {
  const id = randomUUID();
  await db.insert('donations',{id,profile_id:profileId,amount_cents:5000,currency:'AUD',status:'pending',channel:'stripe',campaign:'Community fund',note:'',idempotency_key:randomUUID(),created_by:admin.user.id,stripe_session_id:'cs_test',created_at:new Date(),updated_at:new Date()});
  const event = {
    id: "evt_test",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test",
        metadata: { donationId: id },
        payment_status: "paid",
        amount_total: 5000,
        currency: "aud",
      },
    },
  };
  await handleWebhook(db, event);
  await handleWebhook(db, event);
  assert.equal(await db.count('donations',{id,'receiptSnapshot.id':{$exists:true}}),1);
  assert.equal((await db.one('donations',{id})).status,'succeeded');
  const bad = randomUUID();
  await db.insert('donations',{id:bad,profile_id:profileId,amount_cents:1000,currency:'AUD',status:'pending',channel:'stripe',campaign:'Community fund',note:'',idempotency_key:randomUUID(),created_by:admin.user.id,created_at:new Date(),updated_at:new Date()});
  await assert.rejects(() =>
    handleWebhook(db, {
      ...event,
      id: "evt_bad",
      data: { object: { ...event.data.object, metadata: { donationId: bad } } },
    }),
  );
  assert.equal(
    (await db.one('donations',{id:bad})).status,
    "pending",
  );
  assert.equal(
    (await request(app).post("/api/payments/webhook").send(event)).status,
    503,
  );
});
test("account access changes revoke sessions; own admin cannot be removed", async () => {
  assert.equal(
    (
      await admin.agent
        .patch("/api/accounts/" + admin.user.id)
        .set("X-CSRF-Token", admin.csrf)
        .send({ role: "donor", status: "active" })
    ).status,
    400,
  );
  assert.equal(
    (
      await admin.agent
        .patch("/api/accounts/" + member.user.id)
        .set("X-CSRF-Token", admin.csrf)
        .send({ role: "member", status: "inactive" })
    ).status,
    200,
  );
  assert.equal((await member.agent.get("/api/dashboard")).status, 401);
});
test("audit records exist and Literal searches cannot bypass filters", async () => {
  const a = await admin.agent.get("/api/audit");
  assert.ok(a.body.total > 5);
  assert.equal((await donor.agent.get("/api/audit")).status, 403);
  const p = await admin.agent
    .get("/api/profiles")
    .query({ search: "' OR 1=1 --" });
  assert.equal(p.status, 200);
  assert.equal(p.body.total, 0);
});
test("reports and password change preserve real data and revoke old credentials", async () => {
  const r = await admin.agent.get("/api/reports?from=2020-01-01&to=2030-12-31");
  assert.equal(r.status, 200);
  assert.equal(r.body.summary.raised, 17345);
  assert.equal(
    (await donor.agent.get("/api/reports?from=2020-01-01&to=2030-12-31"))
      .status,
    403,
  );
  const change = await post(donor, "/auth/password", {
    currentPassword: pwd,
    newPassword: "NewIntegrationPass123!",
  });
  assert.equal(change.status, 200);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "donor@test.org", password: pwd })
    ).status,
    401,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .send({ email: "donor@test.org", password: "NewIntegrationPass123!" })
    ).status,
    200,
  );
});
