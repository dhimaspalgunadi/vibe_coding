import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const rows = await db().sql`
    SELECT a.id, a.field_diubah, a.nilai_lama, a.nilai_baru, a.alasan, a.waktu,
           pg.nama AS admin_nama,
           COALESCE(p.nama, lyb.nama, p2.nama) AS pegawai_nama,
           COALESCE(p.nip, lyb.nim, p2.nip) AS nip,
           dh.tanggal AS tanggal_terkait
    FROM audit_log a
    JOIN pengguna pg ON pg.id = a.pengguna_id
    LEFT JOIN rekap_bulanan r ON r.id = a.rekap_id
    LEFT JOIN pegawai p ON p.id = r.pegawai_id
    LEFT JOIN detail_harian dh ON dh.id = a.detail_harian_id
    LEFT JOIN laporan_yayasan_baris lyb ON lyb.id = a.laporan_yayasan_baris_id
    LEFT JOIN pegawai p2 ON p2.id = a.pegawai_id
    ORDER BY a.waktu DESC
    LIMIT 200
  `;
  return json({ log: rows });
});

export const config: Config = { path: "/api/audit-log" };
