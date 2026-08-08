import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { json } from "./lib/respond.js";

export default async (req: Request) => {
  const sesi = wajibLogin(req);
  if ("error" in sesi) return sesi.error;
  const rows = await db().sql`
    SELECT id, cabang, jenjang, jam_kerja_acuan FROM unit_kerja ORDER BY cabang, jenjang
  `;
  return json({ unitKerja: rows });
};

export const config: Config = { path: "/api/unit-kerja" };
