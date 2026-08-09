import type { DatabaseConnection } from "@netlify/database";

const INSENTIF_GURU = 375000;

// Guru yang hadir penuh (total hari kerja aktualnya sama dengan Total Hari
// Kerja Kependidikan yang diisi Admin di header laporan) otomatis dapat
// insentif kehadiran Rp 375.000. "Guru" dikenali dari kolom Jabatan --
// mengandung kata "guru" atau disingkat "Gr" (dua pola yang konsisten
// dipakai di data jabatan sekolah ini; jabatan lain seperti Admin/Helper/
// Driver/OB tidak disentuh). Hanya baris yang insentifnya masih 0 yang
// diisi, supaya koreksi manual Admin (termasuk yang sengaja dikosongkan ke
// 0) tidak ketimpa tiap kali laporan disinkronkan atau Total Hari Kerja-nya
// diubah.
export async function sinkronkanInsentifGuru(database: DatabaseConnection, laporanId: number): Promise<void> {
  await database.sql`
    UPDATE laporan_yayasan_baris lyb
    SET insentif = ${INSENTIF_GURU}
    FROM laporan_yayasan ly
    WHERE ly.id = ${laporanId}
      AND lyb.laporan_id = ly.id
      AND lyb.insentif = 0
      AND ly.total_hari_kerja IS NOT NULL
      AND lyb.total_kerja_hari = ly.total_hari_kerja
      AND lyb.jabatan IS NOT NULL
      AND (lyb.jabatan ILIKE '%guru%' OR TRIM(LOWER(lyb.jabatan)) = 'gr')
  `;
}
