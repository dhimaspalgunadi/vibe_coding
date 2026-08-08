import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req);
  if ("error" in sesi) return sesi.error;
  const rows = await db().sql`
    SELECT pu.id, pu.tgl_mulai, pu.tgl_selesai, pu.nama_file_asal, pu.diunggah_pada,
           uk.cabang, uk.jenjang
    FROM periode_upload pu
    JOIN unit_kerja uk ON uk.id = pu.unit_kerja_id
    ORDER BY pu.tgl_mulai DESC, uk.cabang, uk.jenjang
  `;
  return json({ periode: rows });
});

export const config: Config = { path: "/api/periode" };
