import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
export const token = () => randomBytes(32).toString("hex");
export const hashToken = (t: string) =>
  createHash("sha256").update(t).digest("hex");
export const hashPassword = (s: string) => bcrypt.hash(s, 12);
export const checkPassword = (s: string, h: string) => bcrypt.compare(s, h);
