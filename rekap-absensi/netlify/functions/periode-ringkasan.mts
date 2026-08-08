import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { json } from "./lib/respond.js";

// Daftar rentang tanggal unik (bisa mencakup beberapa cabang/jenjang sekaligus)
// untuk dropdown periode di dashboard Pimpinan.
export default async (req: Request) => {
  const sesi = wajibLogin(req);
  if ("error" in sesi) return sesi.error;

  const rows = await db().sql`
    SELECT tgl_mulai, tgl_selesai,
           COUNT(DISTINCT unit_kerja_id)::int AS jumlah_unit,
           MAX(diunggah_pada) AS terakhir_diunggah
    FROM periode_upload
    GROUP BY tgl_mulai, tgl_selesai
    ORDER BY tgl_mulai DESC
  `;
  return json({ periode: rows });
};

export const config: Config = { path: "/api/periode-ringkasan" };
