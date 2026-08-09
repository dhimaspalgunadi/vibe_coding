import type { DatabaseConnection } from "@netlify/database";

const INSENTIF_KEHADIRAN = 375000;
const BATAS_TELAT_MENIT = 15;

// Insentif kehadiran Rp 375.000 berlaku untuk semua pegawai di laporan
// (Guru maupun Staf, tidak lagi disaring lewat Jabatan) kalau KEDUA syarat
// ini terpenuhi dalam satu periode bulan:
//   1. Total Kerja (hari hadir aktual) >= Total Hari Kerja Kependidikan
//      yang diisi Admin di header laporan.
//   2. Total Telat (menit) < 15 menit.
// Hanya baris yang insentifnya masih 0 yang diisi, supaya koreksi manual
// Admin (termasuk yang sengaja dikosongkan ke 0) tidak ketimpa tiap kali
// laporan disinkronkan atau Total Hari Kerja-nya diubah.
export async function sinkronkanInsentifKehadiran(database: DatabaseConnection, laporanId: number): Promise<void> {
  await database.sql`
    UPDATE laporan_yayasan_baris lyb
    SET insentif = ${INSENTIF_KEHADIRAN}
    FROM laporan_yayasan ly
    WHERE ly.id = ${laporanId}
      AND lyb.laporan_id = ly.id
      AND lyb.insentif = 0
      AND ly.total_hari_kerja IS NOT NULL
      AND lyb.total_kerja_hari >= ly.total_hari_kerja
      AND lyb.telat_menit < ${BATAS_TELAT_MENIT}
  `;
}
