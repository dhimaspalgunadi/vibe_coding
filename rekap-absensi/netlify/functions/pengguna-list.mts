import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const database = db();

  const pengguna = await database.sql`
    SELECT id, nama, email, peran, status_aktif, dibuat_pada FROM pengguna ORDER BY nama
  `;

  // Hanya baris audit_log yang menyangkut menu ini (perubahan/penghapusan
  // akun) yang diambil di sini -- baris lain (koreksi rekap, dst.) sudah
  // ditampilkan di menu Log Perubahan.
  const audit = await database.sql`
    SELECT a.id, a.field_diubah, a.nilai_lama, a.nilai_baru, a.alasan, a.waktu,
           pg.nama AS admin_nama, pt.nama AS target_nama
    FROM audit_log a
    JOIN pengguna pg ON pg.id = a.pengguna_id
    LEFT JOIN pengguna pt ON pt.id = a.pengguna_target_id
    WHERE a.pengguna_target_id IS NOT NULL OR a.field_diubah = 'pengguna_dihapus'
    ORDER BY a.waktu DESC
    LIMIT 100
  `;

  return json({ pengguna, audit });
});

export const config: Config = { path: "/api/pengguna" };
