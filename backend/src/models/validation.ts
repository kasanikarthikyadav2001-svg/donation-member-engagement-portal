import { z } from "zod";
export const uuid = z.string().uuid();
export const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
export const password = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");
export const loginSchema = z
  .object({ email, password: z.string().min(1).max(128) })
  .strict();
export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email,
    password,
    kind: z.literal("donor").default("donor"),
    consent: z.literal(true),
  })
  .strict();
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email,
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+\d\s().-]*$/)
      .default(""),
    kind: z.enum(["donor", "member", "both"]),
    status: z.enum(["active", "inactive"]).default("active"),
    consent: z.boolean(),
    notes: z.string().trim().max(2000).default(""),
  })
  .strict();
export const donationSchema = z
  .object({
    profileId: uuid,
    amount: z
      .number()
      .min(1)
      .max(1000000)
      .refine(
        (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001,
        "Use at most two decimal places",
      ),
    channel: z.enum(["cash", "bank_transfer", "sandbox", "stripe", "dummy"]),
    campaign: z.string().trim().min(2).max(120).default("Community fund"),
    note: z.string().trim().max(1000).default(""),
    idempotencyKey: uuid,
  })
  .strict();
export const questionSchema = z
  .object({
    id: uuid.optional(),
    label: z.string().trim().min(2).max(500),
    type: z.enum(["text", "choice", "rating"]),
    required: z.boolean().default(true),
    options: z.array(z.string().trim().min(1).max(150)).max(12).default([]),
  })
  .superRefine((q, c) => {
    if (
      q.type === "choice" &&
      (q.options.length < 2 || new Set(q.options).size !== q.options.length)
    )
      c.addIssue({
        code: "custom",
        message: "Choice questions need 2–12 unique options",
        path: ["options"],
      });
  });
export const surveySchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).default(""),
    audience: z.enum(["members", "all"]).default("members"),
    closesAt: z.string().datetime().nullable().default(null),
    questions: z.array(questionSchema).min(1).max(50),
  })
  .strict();
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().max(120).default(""),
  status: z.string().max(30).default(""),
  kind: z.enum(["donor", "member", "both", ""]).default(""),
});
