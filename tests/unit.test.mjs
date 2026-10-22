import { test } from "node:test";
import assert from "node:assert/strict";
import {
  donationSchema,
  registerSchema,
  surveySchema,
} from "../backend/dist/models/validation.js";
import {
  hashPassword,
  checkPassword,
  hashToken,
  token,
} from "../backend/dist/utils/security.js";
import { randomUUID } from "node:crypto";
test("donations reject fractional cents, negative amounts and unexpected input", () => {
  const v = {
    profileId: randomUUID(),
    amount: 10,
    channel: "cash",
    idempotencyKey: randomUUID(),
  };
  assert.equal(donationSchema.safeParse(v).success, true);
  for (const amount of [-1, 0, 1.001, 1000001])
    assert.equal(donationSchema.safeParse({ ...v, amount }).success, false);
  assert.equal(
    donationSchema.safeParse({ ...v, status: "succeeded" }).success,
    false,
  );
});
test("public registration cannot choose an administrator role", () => {
  const v = {
    name: "Test User",
    email: "test@example.org",
    password: "LongPassword123!",
    consent: true,
  };
  assert.equal(registerSchema.safeParse(v).success, true);
  assert.equal(
    registerSchema.safeParse({ ...v, role: "admin" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...v, password: "short" }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({ ...v, consent: false }).success,
    false,
  );
});
test("surveys require questions and unique choice options", () => {
  const v = {
    title: "Test survey",
    questions: [{ label: "Pick one", type: "choice", options: ["A", "B"] }],
  };
  assert.equal(surveySchema.safeParse(v).success, true);
  assert.equal(surveySchema.safeParse({ ...v, questions: [] }).success, false);
  assert.equal(
    surveySchema.safeParse({
      ...v,
      questions: [{ label: "Pick one", type: "choice", options: ["A", "A"] }],
    }).success,
    false,
  );
});
test("passwords are salted and session tokens are hashed", async () => {
  const h = await hashPassword("LongPassword123!");
  assert.notEqual(h, "LongPassword123!");
  assert.equal(await checkPassword("LongPassword123!", h), true);
  assert.equal(await checkPassword("WrongPassword", h), false);
  const t = token();
  assert.equal(t.length, 64);
  assert.notEqual(hashToken(t), t);
  assert.notEqual(token(), t);
});
