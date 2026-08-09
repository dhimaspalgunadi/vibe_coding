import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const rows = await db().sql`
    SELECT ly.id, ly.judul, ly.cabang, ly.tgl_mulai, ly.tgl_selesai, ly.sumber_file, ly.diperbarui_pada,
           COUNT(lyb.id)::int AS jumlah_baris
    FROM laporan_yayasan ly
    LEFT JOIN laporan_yayasan_baris lyb ON lyb.laporan_id = ly.id
    GROUP BY ly.id
    ORDER BY ly.tgl_mulai DESC, ly.cabang
  `;
  return json({ laporan: rows });
});

export const config: Config = { path: "/api/laporan-yayasan" };
