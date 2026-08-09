import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const qPattern = `%${q}%`;

  const rows = await db().sql`
    SELECT p.id, p.nip, p.nama, p.jabatan, p.agama, p.tanggal_masuk, p.status_aktif,
           uk.id AS unit_kerja_id, uk.cabang, uk.jenjang
    FROM pegawai p
    JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
    WHERE (${q} = '' OR p.nama ILIKE ${qPattern} OR p.nip ILIKE ${qPattern})
    ORDER BY uk.cabang, uk.jenjang, p.nama
  `;
  return json({ pegawai: rows });
});

export const config: Config = { path: "/api/pegawai" };
