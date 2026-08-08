import type { Config } from "@netlify/functions";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req);
  if ("error" in sesi) return sesi.error;
  return json({ nama: sesi.user.nama, email: sesi.user.email, peran: sesi.user.peran });
});

export const config: Config = { path: "/api/auth/me" };
