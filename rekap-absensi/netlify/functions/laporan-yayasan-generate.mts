import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";
import { sinkronkanInsentifKehadiran } from "./lib/insentif.js";

// Kategori Ket.Abs (lihat seed di migrasi 0001) dipetakan ke kolom-kolom
// "Attendance Leave" pada format Perfect Attendance. Pola lain yang tidak
// ada di sini tidak memengaruhi kolom manapun secara otomatis -- Admin bisa
// mengoreksinya manual di baris laporan.
const KATEGORI_SAKIT = ["Sakit (dengan surat)", "Sakit (tanpa surat)", "Ijin Sakit"];
const KATEGORI_IZIN = ["Ijin"];
const KATEGORI_CUTI = ["Cuti Tahunan"];

interface FileRow {
  id: number;
  tgl_mulai: string | Date;
  tgl_selesai: string | Date;
  nama_file_asal: string;
  cabang: string;
  jenjang: string;
}

interface RekapBaseRow {
  rekap_id: number;
  pegawai_id: number;
  nip: string;
  nama: string;
  jabatan: string | null;
  agama: string | null;
  tanggal_masuk: string | null;
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

// Kolom DATE dikembalikan driver sebagai objek Date (bukan string "yyyy-mm-dd").
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
  const periodeUploadId = Number(body?.periodeUploadId);
  if (!periodeUploadId) {
    return json({ error: "Parameter 'periodeUploadId' wajib diisi." }, 400);
  }

  const database = db();

  // Satu Laporan Yayasan = satu file unggahan (periode_upload), bukan lagi
  // gabungan lintas jenjang -- jadi Kampus/Cabang & jenjangnya persis sama
  // dengan file itu, dan datanya diambil lewat rekap_bulanan.periode_id
  // yang memang FK langsung ke file ini (bukan tebakan cabang+tanggal lagi).
  const fileRows = (await database.sql`
    SELECT pu.id, pu.tgl_mulai, pu.tgl_selesai, pu.nama_file_asal, uk.cabang, uk.jenjang
    FROM periode_upload pu
    JOIN unit_kerja uk ON uk.id = pu.unit_kerja_id
    WHERE pu.id = ${periodeUploadId}
  `) as FileRow[];
  const file = fileRows[0];
  if (!file) return json({ error: "File unggahan (periode) tidak ditemukan." }, 404);

  const tglMulai = keTanggalIso(file.tgl_mulai);
  const tglSelesai = keTanggalIso(file.tgl_selesai);

  const headerRows = (await database.sql`
    INSERT INTO laporan_yayasan (periode_upload_id, cabang, jenjang, tgl_mulai, tgl_selesai, sumber_file, dibuat_oleh)
    VALUES (${periodeUploadId}, ${file.cabang}, ${file.jenjang}, ${tglMulai}, ${tglSelesai}, ${file.nama_file_asal}, ${sesi.user.id})
    ON CONFLICT (periode_upload_id) DO UPDATE SET
      cabang = EXCLUDED.cabang,
      jenjang = EXCLUDED.jenjang,
      tgl_mulai = EXCLUDED.tgl_mulai,
      tgl_selesai = EXCLUDED.tgl_selesai,
      sumber_file = EXCLUDED.sumber_file,
      diperbarui_pada = now()
    RETURNING id
  `) as { id: number }[];
  const laporanId = headerRows[0].id;

  const dasar = (await database.sql`
    SELECT r.id AS rekap_id, p.id AS pegawai_id, p.nip, p.nama, p.jabatan, p.agama,
           p.tanggal_masuk,
           r.total_hari, r.total_telat_menit, r.total_plg_cepat_menit, r.total_lembur_menit
    FROM rekap_bulanan r
    JOIN pegawai p ON p.id = r.pegawai_id
    WHERE r.periode_id = ${periodeUploadId}
    ORDER BY p.nama
  `) as RekapBaseRow[];

  // Baris yang sudah ada sebelumnya (dibuat sebelum Agama/Tanggal Masuk/
  // Jabatan diisi lewat menu Data Pegawai, mis.) tidak pernah otomatis
  // dapat nilai barunya karena hanya baris BARU yang di-insert dengan
  // salinan data pegawai. Disamakan di sini setiap kali disinkronkan --
  // tapi hanya untuk kolom yang masih NULL (belum pernah diisi), supaya
  // koreksi manual Admin (termasuk yang sengaja dikosongkan) tidak ketimpa.
  await database.sql`
    UPDATE laporan_yayasan_baris lyb
    SET agama = COALESCE(lyb.agama, p.agama),
        tanggal_masuk = COALESCE(lyb.tanggal_masuk, p.tanggal_masuk),
        jabatan = COALESCE(lyb.jabatan, p.jabatan)
    FROM pegawai p
    WHERE lyb.laporan_id = ${laporanId}
      AND lyb.pegawai_id = p.id
      AND (lyb.agama IS NULL OR lyb.tanggal_masuk IS NULL OR lyb.jabatan IS NULL)
  `;

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
      LEFT JOIN ket_abs_kategori kk ON kk.id = dh.ket_abs_kategori_id
      WHERE r.periode_id = ${periodeUploadId}
    `) as DetailRow[];

    const bulanAwal = tglMulai.slice(0, 7); // yyyy-mm

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
          ${laporanId}, ${r.pegawai_id}, ${urutan}, ${r.nip}, ${file.jenjang}, ${r.nama}, ${r.jabatan},
          ${a.kuponPeriode1}, ${a.kuponPeriode2}, ${r.total_hari},
          ${a.sakitHari}, ${a.izinHari}, ${a.alpaHari}, ${a.cutiHari},
          ${r.total_lembur_menit}, ${a.telatHari}, ${r.total_telat_menit},
          ${a.plgCepatHari}, ${r.total_plg_cepat_menit},
          ${r.agama}, ${r.tanggal_masuk}
        )
      `;
    }
  }

  await sinkronkanInsentifKehadiran(database, laporanId);

  const laporanRows = await database.sql`SELECT * FROM laporan_yayasan WHERE id = ${laporanId}`;
  const barisRows = await database.sql`
    SELECT * FROM laporan_yayasan_baris WHERE laporan_id = ${laporanId} ORDER BY urutan, nama
  `;

  return json({ laporan: laporanRows[0], baris: barisRows, audit: [], ditambahkan: baru.length });
});

export const config: Config = { path: "/api/laporan-yayasan-generate" };
