import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

// Kategori Ket.Abs (lihat seed di migrasi 0001) dipetakan ke kolom-kolom
// "Attendance Leave" pada format Perfect Attendance. Pola lain yang tidak
// ada di sini tidak memengaruhi kolom manapun secara otomatis -- Admin bisa
// mengoreksinya manual di baris laporan.
const KATEGORI_SAKIT = ["Sakit (dengan surat)", "Sakit (tanpa surat)", "Ijin Sakit"];
const KATEGORI_IZIN = ["Ijin"];
const KATEGORI_CUTI = ["Cuti Tahunan"];

interface RekapBaseRow {
  rekap_id: number;
  pegawai_id: number;
  nip: string;
  nama: string;
  jabatan: string | null;
  agama: string | null;
  tanggal_masuk: string | null;
  cabang: string;
  jenjang: string;
  nama_file_asal: string;
  total_hari: number;
  total_telat_menit: number;
  total_plg_cepat_menit: number;
  total_lembur_menit: number;
}

interface DetailRow {
  rekap_id: number;
  tanggal: string | Date;
  libur: boolean;
  masuk_aktual: string | null;
  telat_menit: number;
  plg_cepat_menit: number;
  kategori: string | null;
}

// Kolom DATE dikembalikan driver sebagai objek Date (bukan string "yyyy-mm-dd"),
// sedangkan tglMulai/tglSelesai dari body request selalu string JSON (bisa
// berupa "yyyy-mm-dd" polos atau timestamp ISO penuh) -- disamakan di sini
// supaya perbandingan/pemotongan "yyyy-mm" konsisten untuk keduanya.
function keTanggalIso(v: string | Date): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return v.slice(0, 10);
}

interface Agregat {
  telatHari: number;
  plgCepatHari: number;
  sakitHari: number;
  izinHari: number;
  cutiHari: number;
  alpaHari: number;
  kuponPeriode1: number;
  kuponPeriode2: number;
}

function agregatKosong(): Agregat {
  return {
    telatHari: 0,
    plgCepatHari: 0,
    sakitHari: 0,
    izinHari: 0,
    cutiHari: 0,
    alpaHari: 0,
    kuponPeriode1: 0,
    kuponPeriode2: 0,
  };
}

export default amankan(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const body = await req.json().catch(() => null);
  const tglMulaiRaw = typeof body?.tglMulai === "string" ? body.tglMulai : "";
  const tglSelesaiRaw = typeof body?.tglSelesai === "string" ? body.tglSelesai : "";
  const cabang = typeof body?.cabang === "string" ? body.cabang.trim() : "";
  const tglMulai = tglMulaiRaw ? keTanggalIso(tglMulaiRaw) : "";
  const tglSelesai = tglSelesaiRaw ? keTanggalIso(tglSelesaiRaw) : "";
  if (!tglMulai || !tglSelesai || !cabang) {
    return json({ error: "Parameter 'tglMulai', 'tglSelesai', dan 'cabang' wajib diisi." }, 400);
  }

  const database = db();

  const headerRows = (await database.sql`
    INSERT INTO laporan_yayasan (cabang, tgl_mulai, tgl_selesai, dibuat_oleh)
    VALUES (${cabang}, ${tglMulai}, ${tglSelesai}, ${sesi.user.id})
    ON CONFLICT (tgl_mulai, tgl_selesai, cabang) DO UPDATE SET diperbarui_pada = now()
    RETURNING id
  `) as { id: number }[];
  const laporanId = headerRows[0].id;

  // Cabang/jenjang diambil dari unit_kerja milik periode_upload (file) itu
  // sendiri, BUKAN dari pegawai.unit_kerja_id -- pegawai.unit_kerja_id bisa
  // "bergeser" ke unit terbaru tiap kali NIP itu muncul lagi di unggahan
  // lain, sehingga rekap_bulanan lama bisa salah atribusi kampus kalau
  // dijoin lewat pegawai. Menjoin lewat periode_upload memastikan Kampus/
  // Cabang dan nama file yang tercatat benar-benar yang jadi dasar baris ini.
  const dasar = (await database.sql`
    SELECT r.id AS rekap_id, p.id AS pegawai_id, p.nip, p.nama, p.jabatan, p.agama,
           p.tanggal_masuk, uk.cabang, uk.jenjang, pu.nama_file_asal,
           r.total_hari, r.total_telat_menit, r.total_plg_cepat_menit, r.total_lembur_menit
    FROM rekap_bulanan r
    JOIN pegawai p ON p.id = r.pegawai_id
    JOIN periode_upload pu ON pu.id = r.periode_id
    JOIN unit_kerja uk ON uk.id = pu.unit_kerja_id
    WHERE pu.tgl_mulai = ${tglMulai} AND pu.tgl_selesai = ${tglSelesai} AND uk.cabang = ${cabang}
    ORDER BY uk.jenjang, p.nama
  `) as RekapBaseRow[];

  const sumberFile = [...new Set(dasar.map((r) => r.nama_file_asal))].sort().join(", ");
  await database.sql`UPDATE laporan_yayasan SET sumber_file = ${sumberFile || null} WHERE id = ${laporanId}`;

  const sudahAda = (await database.sql`
    SELECT pegawai_id FROM laporan_yayasan_baris WHERE laporan_id = ${laporanId} AND pegawai_id IS NOT NULL
  `) as { pegawai_id: number }[];
  const idSudahAda = new Set(sudahAda.map((r) => r.pegawai_id));

  const baru = dasar.filter((r) => !idSudahAda.has(r.pegawai_id));

  if (baru.length > 0) {
    const detail = (await database.sql`
      SELECT dh.rekap_id, dh.tanggal, dh.libur, dh.masuk_aktual, dh.telat_menit, dh.plg_cepat_menit,
             kk.kategori
      FROM detail_harian dh
      JOIN rekap_bulanan r ON r.id = dh.rekap_id
      JOIN periode_upload pu ON pu.id = r.periode_id
      JOIN unit_kerja uk ON uk.id = pu.unit_kerja_id
      LEFT JOIN ket_abs_kategori kk ON kk.id = dh.ket_abs_kategori_id
      WHERE pu.tgl_mulai = ${tglMulai} AND pu.tgl_selesai = ${tglSelesai} AND uk.cabang = ${cabang}
    `) as DetailRow[];

    const bulanAwal = keTanggalIso(tglMulai).slice(0, 7); // yyyy-mm

    const agregatPerRekap = new Map<number, Agregat>();
    for (const d of detail) {
      const a = agregatPerRekap.get(d.rekap_id) ?? agregatKosong();
      if (d.telat_menit > 0) a.telatHari += 1;
      if (d.plg_cepat_menit > 0) a.plgCepatHari += 1;
      if (d.kategori && KATEGORI_SAKIT.includes(d.kategori)) a.sakitHari += 1;
      else if (d.kategori && KATEGORI_IZIN.includes(d.kategori)) a.izinHari += 1;
      else if (d.kategori && KATEGORI_CUTI.includes(d.kategori)) a.cutiHari += 1;
      else if (!d.libur && !d.masuk_aktual && !d.kategori) a.alpaHari += 1;
      if (d.masuk_aktual) {
        if (keTanggalIso(d.tanggal).slice(0, 7) === bulanAwal) a.kuponPeriode1 += 1;
        else a.kuponPeriode2 += 1;
      }
      agregatPerRekap.set(d.rekap_id, a);
    }

    const maxUrutan = (await database.sql`
      SELECT COALESCE(MAX(urutan), 0)::int AS m FROM laporan_yayasan_baris WHERE laporan_id = ${laporanId}
    `) as { m: number }[];
    let urutan = maxUrutan[0].m;

    for (const r of baru) {
      urutan += 1;
      const a = agregatPerRekap.get(r.rekap_id) ?? agregatKosong();
      await database.sql`
        INSERT INTO laporan_yayasan_baris (
          laporan_id, pegawai_id, urutan, nim, unit, nama, jabatan,
          kupon_periode1, kupon_periode2, total_kerja_hari,
          sakit_hari, izin_hari, alpa_hari, cuti_hari,
          lembur_menit, telat_hari, telat_menit,
          plg_cepat_hari, plg_cepat_menit,
          agama, tanggal_masuk
        ) VALUES (
          ${laporanId}, ${r.pegawai_id}, ${urutan}, ${r.nip}, ${r.jenjang}, ${r.nama}, ${r.jabatan},
          ${a.kuponPeriode1}, ${a.kuponPeriode2}, ${r.total_hari},
          ${a.sakitHari}, ${a.izinHari}, ${a.alpaHari}, ${a.cutiHari},
          ${r.total_lembur_menit}, ${a.telatHari}, ${r.total_telat_menit},
          ${a.plgCepatHari}, ${r.total_plg_cepat_menit},
          ${r.agama}, ${r.tanggal_masuk}
        )
      `;
    }
  }

  const laporanRows = await database.sql`SELECT * FROM laporan_yayasan WHERE id = ${laporanId}`;
  const barisRows = await database.sql`
    SELECT * FROM laporan_yayasan_baris WHERE laporan_id = ${laporanId} ORDER BY urutan, nama
  `;

  return json({ laporan: laporanRows[0], baris: barisRows, audit: [], ditambahkan: baru.length });
});

export const config: Config = { path: "/api/laporan-yayasan-generate" };
