import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";
import { durasiKeMenit } from "./lib/parser.js";

const RE_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

interface BarisHarian {
  id: number;
  rekap_id: number;
  masuk_jadwal: string | null;
  pulang_jadwal: string | null;
  masuk_aktual: string | null;
  pulang_aktual: string | null;
}

function validasiJam(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string" && RE_JAM.test(v)) return v;
  return undefined; // tidak valid
}

// Meniru logika mesin absensi: telat = keterlambatan dari jadwal masuk,
// pulang cepat = kekurangan dari jadwal pulang, lembur = kelebihan dari
// jadwal pulang. Catatan: mesin sumber tampak mensyaratkan sesi lembur
// terpisah/disetujui untuk kolom "Lembur"-nya sendiri -- formula sederhana
// di sini (selisih waktu semata) adalah pendekatan, bukan jaminan sama
// persis dengan aturan lembur resmi sekolah.
function hitungUlang(masukJadwal: string | null, pulangJadwal: string | null, masukAktual: string | null, pulangAktual: string | null) {
  const mj = masukJadwal ? durasiKeMenit(masukJadwal) : null;
  const pj = pulangJadwal ? durasiKeMenit(pulangJadwal) : null;
  const ma = masukAktual ? durasiKeMenit(masukAktual) : null;
  const pa = pulangAktual ? durasiKeMenit(pulangAktual) : null;

  const telat = mj !== null && ma !== null ? Math.max(0, ma - mj) : 0;
  const plgCepat = pj !== null && pa !== null ? Math.max(0, pj - pa) : 0;
  const lembur = pj !== null && pa !== null ? Math.max(0, pa - pj) : 0;
  const totalJam = ma !== null && pa !== null ? Math.max(0, pa - ma) : 0;

  return { telat, plgCepat, lembur, totalJam };
}

export default amankan(async (req: Request) => {
  if (req.method !== "PATCH") return json({ error: "Metode tidak didukung." }, 405);
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const body = await req.json().catch(() => null);
  const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
  if (!alasan) return json({ error: "Alasan perubahan wajib diisi." }, 400);

  const masukBaru = validasiJam(body?.masukAktual);
  const pulangBaru = validasiJam(body?.pulangAktual);
  if (masukBaru === undefined || pulangBaru === undefined) {
    return json({ error: "Format jam harus HH:MM (24 jam) atau dikosongkan." }, 400);
  }

  const database = db();

  const rows = (await database.sql`
    SELECT id, rekap_id, masuk_jadwal, pulang_jadwal, masuk_aktual, pulang_aktual
    FROM detail_harian WHERE id = ${id}
  `) as BarisHarian[];
  const sebelum = rows[0];
  if (!sebelum) return json({ error: "Baris rincian harian tidak ditemukan." }, 404);

  // body boleh hanya mengirim salah satu field; kunci yang tidak dikirim berarti
  // "tidak diubah", sedangkan nilai null berarti "kosongkan" (mis. tidak ada scan).
  const masukFinal = "masukAktual" in (body ?? {}) ? masukBaru : sebelum.masuk_aktual;
  const pulangFinal = "pulangAktual" in (body ?? {}) ? pulangBaru : sebelum.pulang_aktual;

  const hitung = hitungUlang(sebelum.masuk_jadwal, sebelum.pulang_jadwal, masukFinal, pulangFinal);

  await database.sql`
    UPDATE detail_harian SET
      masuk_aktual = ${masukFinal},
      pulang_aktual = ${pulangFinal},
      telat_menit = ${hitung.telat},
      plg_cepat_menit = ${hitung.plgCepat},
      lembur_menit = ${hitung.lembur},
      total_jam_menit = ${hitung.totalJam},
      koreksi_alasan = ${alasan}
    WHERE id = ${id}
  `;

  const perubahan: Array<[string, string | null, string | null]> = [];
  if (masukFinal !== sebelum.masuk_aktual) perubahan.push(["masuk_aktual", sebelum.masuk_aktual, masukFinal]);
  if (pulangFinal !== sebelum.pulang_aktual) perubahan.push(["pulang_aktual", sebelum.pulang_aktual, pulangFinal]);

  for (const [field, lama, baru] of perubahan) {
    await database.sql`
      INSERT INTO audit_log (pengguna_id, rekap_id, detail_harian_id, field_diubah, nilai_lama, nilai_baru, alasan)
      VALUES (${sesi.user.id}, ${sebelum.rekap_id}, ${id}, ${field}, ${lama}, ${baru}, ${alasan})
    `;
  }

  const agregatRows = (await database.sql`
    SELECT
      COALESCE(SUM(telat_menit), 0)::int AS total_telat,
      COALESCE(SUM(plg_cepat_menit), 0)::int AS total_plg_cepat,
      COALESCE(SUM(lembur_menit), 0)::int AS total_lembur,
      COALESCE(SUM(total_jam_menit), 0)::int AS total_jam
    FROM detail_harian WHERE rekap_id = ${sebelum.rekap_id}
  `) as { total_telat: number; total_plg_cepat: number; total_lembur: number; total_jam: number }[];
  const agregat = agregatRows[0];

  await database.sql`
    UPDATE rekap_bulanan SET
      total_telat_menit = ${agregat.total_telat},
      total_plg_cepat_menit = ${agregat.total_plg_cepat},
      total_lembur_menit = ${agregat.total_lembur},
      total_jam_menit = ${agregat.total_jam},
      validasi_cocok = true,
      validasi_catatan = NULL
    WHERE id = ${sebelum.rekap_id}
  `;

  return json({ ok: true, harian: { ...hitung, masukAktual: masukFinal, pulangAktual: pulangFinal }, rekapBulanan: agregat });
});

export const config: Config = { path: "/api/harian-update" };
