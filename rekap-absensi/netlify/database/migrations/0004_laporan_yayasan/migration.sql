-- Menu "Laporan ke Yayasan": rekap bulanan per pegawai diringkas ulang ke
-- format "PERFECT ATTENDANCE" yang dikirim ke Yayasan. Sebagian kolom bisa
-- dihitung otomatis dari rekap_bulanan/detail_harian saat digenerate;
-- sebagian lain (kupon konsumsi, insentif, agama, tanggal masuk, jabatan)
-- murni kebijakan HRD dan tidak ada di data mesin absensi, jadi disimpan
-- di sini supaya bisa diisi/dikoreksi manual oleh Admin dan dipakai lagi
-- di periode berikutnya.

ALTER TABLE pegawai ADD COLUMN jabatan TEXT;
ALTER TABLE pegawai ADD COLUMN agama TEXT;
ALTER TABLE pegawai ADD COLUMN tanggal_masuk DATE;

-- Satu laporan per (rentang tanggal periode, cabang) -- template sumber
-- berkepala "KAMPUS: ___" tunggal, sedangkan satu rentang tanggal upload
-- bisa mencakup beberapa cabang sekaligus (lih. catatan di
-- pimpinan-summary.mts), jadi cabang jadi bagian kunci laporan.
CREATE TABLE laporan_yayasan (
  id SERIAL PRIMARY KEY,
  judul TEXT NOT NULL DEFAULT 'PERFECT ATTENDANCE',
  cabang TEXT NOT NULL,
  tgl_mulai DATE NOT NULL,
  tgl_selesai DATE NOT NULL,
  keterangan_periode TEXT,
  total_hari_kerja INTEGER,
  mengetahui_nama TEXT,
  mengetahui_jabatan TEXT,
  dibuat_oleh_nama TEXT,
  dibuat_oleh_jabatan TEXT,
  dibuat_oleh INTEGER REFERENCES pengguna(id),
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tgl_mulai, tgl_selesai, cabang)
);

-- Baris per pegawai (pegawai_id NULL untuk baris manual yang ditambahkan
-- Admin, mis. pegawai yang belum/tidak ada di data unggahan absensi).
CREATE TABLE laporan_yayasan_baris (
  id SERIAL PRIMARY KEY,
  laporan_id INTEGER NOT NULL REFERENCES laporan_yayasan(id) ON DELETE CASCADE,
  pegawai_id INTEGER REFERENCES pegawai(id),
  urutan INTEGER NOT NULL DEFAULT 0,
  nim TEXT,
  unit TEXT,
  nama TEXT NOT NULL,
  jabatan TEXT,
  kupon_periode1 INTEGER NOT NULL DEFAULT 0,
  kupon_periode2 INTEGER NOT NULL DEFAULT 0,
  total_kerja_hari INTEGER NOT NULL DEFAULT 0,
  sakit_hari INTEGER NOT NULL DEFAULT 0,
  izin_hari INTEGER NOT NULL DEFAULT 0,
  izin_ket TEXT,
  alpa_hari INTEGER NOT NULL DEFAULT 0,
  cuti_hari INTEGER NOT NULL DEFAULT 0,
  cuti_ket TEXT,
  lembur_menit INTEGER NOT NULL DEFAULT 0,
  lembur_ket TEXT,
  telat_hari INTEGER NOT NULL DEFAULT 0,
  telat_menit INTEGER NOT NULL DEFAULT 0,
  telat_ket TEXT,
  izin_telat_hari INTEGER NOT NULL DEFAULT 0,
  izin_telat_menit INTEGER NOT NULL DEFAULT 0,
  izin_telat_ket TEXT,
  plg_cepat_hari INTEGER NOT NULL DEFAULT 0,
  plg_cepat_menit INTEGER NOT NULL DEFAULT 0,
  plg_cepat_ket TEXT,
  insentif NUMERIC(12, 2) NOT NULL DEFAULT 0,
  agama TEXT,
  tanggal_masuk DATE,
  catatan TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  diperbarui_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_laporan_yayasan_baris_laporan ON laporan_yayasan_baris(laporan_id);
CREATE INDEX idx_laporan_yayasan_baris_pegawai ON laporan_yayasan_baris(pegawai_id);

-- Riwayat perubahan baris Laporan Yayasan memakai audit_log yang sama
-- (bukan tabel baru) supaya "Log Perubahan" tetap satu sumber riwayat untuk
-- seluruh aplikasi. SET NULL saat baris dihapus karena baris memang boleh
-- dihapus permanen oleh Admin -- ringkasan datanya tetap terekam di
-- audit_log.nilai_lama (JSON) untuk entri penghapusan itu sendiri.
ALTER TABLE audit_log ADD COLUMN laporan_yayasan_baris_id INTEGER REFERENCES laporan_yayasan_baris(id) ON DELETE SET NULL;
CREATE INDEX idx_audit_log_laporan_yayasan_baris ON audit_log(laporan_yayasan_baris_id);
