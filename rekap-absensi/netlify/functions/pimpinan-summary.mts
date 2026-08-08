import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

// Pimpinan memilih rentang tanggal (bukan satu periode_upload), karena tiap
// cabang/jenjang diunggah sebagai file terpisah dengan periode_upload sendiri
// meski tanggalnya sama. Agregasi lintas cabang harus menggabungkan semua
// unit yang berbagi rentang tanggal yang sama, bukan satu unit saja.
export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin", "pimpinan"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const tglMulai = url.searchParams.get("tglMulai");
  const tglSelesai = url.searchParams.get("tglSelesai");
  if (!tglMulai || !tglSelesai) {
    return json({ error: "Parameter 'tglMulai' dan 'tglSelesai' wajib diisi." }, 400);
  }

  const database = db();

  const perCabang = await database.sql`
    SELECT uk.cabang,
           COUNT(*)::int AS jumlah_pegawai,
           ROUND(AVG(r.total_telat_menit))::int AS rata_telat_menit,
           SUM(r.total_lembur_menit)::int AS total_lembur_menit,
           SUM(CASE WHEN r.status_anomali = 'perlu_tinjau' THEN 1 ELSE 0 END)::int AS perlu_tinjau
    FROM rekap_bulanan r
    JOIN periode_upload pu ON pu.id = r.periode_id
    JOIN pegawai p ON p.id = r.pegawai_id
    JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
    WHERE pu.tgl_mulai = ${tglMulai} AND pu.tgl_selesai = ${tglSelesai}
    GROUP BY uk.cabang
    ORDER BY uk.cabang
  `;

  const perUnit = await database.sql`
    SELECT uk.cabang, uk.jenjang,
           COUNT(*)::int AS jumlah_pegawai,
           ROUND(AVG(r.total_telat_menit))::int AS rata_telat_menit,
           SUM(r.total_lembur_menit)::int AS total_lembur_menit
    FROM rekap_bulanan r
    JOIN periode_upload pu ON pu.id = r.periode_id
    JOIN pegawai p ON p.id = r.pegawai_id
    JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
    WHERE pu.tgl_mulai = ${tglMulai} AND pu.tgl_selesai = ${tglSelesai}
    GROUP BY uk.cabang, uk.jenjang
    ORDER BY uk.cabang, uk.jenjang
  `;

  const totalRows = await database.sql`
    SELECT COUNT(*)::int AS jumlah_pegawai,
           ROUND(AVG(r.total_telat_menit))::int AS rata_telat_menit,
           SUM(r.total_lembur_menit)::int AS total_lembur_menit,
           SUM(CASE WHEN r.status_anomali = 'perlu_tinjau' THEN 1 ELSE 0 END)::int AS perlu_tinjau
    FROM rekap_bulanan r
    JOIN periode_upload pu ON pu.id = r.periode_id
    WHERE pu.tgl_mulai = ${tglMulai} AND pu.tgl_selesai = ${tglSelesai}
  `;

  return json({ total: totalRows[0] ?? null, perCabang, perUnit });
});

export const config: Config = { path: "/api/pimpinan-summary" };
