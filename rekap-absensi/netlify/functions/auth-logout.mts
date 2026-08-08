import type { Config } from "@netlify/functions";
import { hapusCookieHeader } from "./lib/cookies.js";
import { json } from "./lib/respond.js";

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  return json({ ok: true }, 200, { "set-cookie": hapusCookieHeader() });
};

export const config: Config = { path: "/api/auth/logout" };
