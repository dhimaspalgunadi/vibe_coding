-- Skema inti Rekap Absensi (lihat dokumen skema & wireframe yang disepakati
-- sebelum implementasi). Kolom durasi disimpan sebagai menit (integer) supaya
-- mudah dijumlah dan dibandingkan tanpa parsing ulang string "HH:MM".

CREATE TABLE unit_kerja (
  id SERIAL PRIMARY KEY,
  cabang TEXT NOT NULL,
  jenjang TEXT NOT NULL,
  jam_kerja_acuan TEXT,
  UNIQUE (cabang, jenjang)
);

CREATE TABLE pengguna (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  peran TEXT NOT NULL CHECK (peran IN ('admin', 'pimpinan')),
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pegawai (
  id SERIAL PRIMARY KEY,
  nip TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  unit_kerja_id INTEGER NOT NULL REFERENCES unit_kerja(id),
  status_aktif BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_pegawai_unit_kerja ON pegawai(unit_kerja_id);

CREATE TABLE periode_upload (
  id SERIAL PRIMARY KEY,
  unit_kerja_id INTEGER NOT NULL REFERENCES unit_kerja(id),
  tgl_mulai DATE NOT NULL,
  tgl_selesai DATE NOT NULL,
  nama_file_asal TEXT NOT NULL,
  diunggah_oleh INTEGER REFERENCES pengguna(id),
  diunggah_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_periode_unit_kerja ON periode_upload(unit_kerja_id);

CREATE TABLE ket_abs_kategori (
  id SERIAL PRIMARY KEY,
  pola_teks TEXT NOT NULL UNIQUE,
  kategori TEXT NOT NULL,
  pengaruh_insentif BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE rekap_bulanan (
  id SERIAL PRIMARY KEY,
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  periode_id INTEGER NOT NULL REFERENCES periode_upload(id),
  total_hari INTEGER NOT NULL DEFAULT 0,
  total_jam_menit INTEGER NOT NULL DEFAULT 0,
  total_telat_menit INTEGER NOT NULL DEFAULT 0,
  total_plg_cepat_menit INTEGER NOT NULL DEFAULT 0,
  total_lembur_menit INTEGER NOT NULL DEFAULT 0,
  validasi_cocok BOOLEAN NOT NULL DEFAULT true,
  validasi_catatan TEXT,
  status_anomali TEXT NOT NULL DEFAULT 'normal' CHECK (status_anomali IN ('normal', 'perlu_tinjau')),
  anomali_catatan TEXT,
  dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pegawai_id, periode_id)
);
CREATE INDEX idx_rekap_periode ON rekap_bulanan(periode_id);
CREATE INDEX idx_rekap_pegawai ON rekap_bulanan(pegawai_id);

CREATE TABLE detail_harian (
  id SERIAL PRIMARY KEY,
  rekap_id INTEGER NOT NULL REFERENCES rekap_bulanan(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  hari TEXT,
  libur BOOLEAN NOT NULL DEFAULT false,
  jam_kerja TEXT,
  masuk_jadwal TEXT,
  pulang_jadwal TEXT,
  masuk_aktual TEXT,
  pulang_aktual TEXT,
  total_jam_menit INTEGER NOT NULL DEFAULT 0,
  telat_menit INTEGER NOT NULL DEFAULT 0,
  plg_cepat_menit INTEGER NOT NULL DEFAULT 0,
  lembur_menit INTEGER NOT NULL DEFAULT 0,
  ket_abs_raw TEXT,
  ket_abs_kategori_id INTEGER REFERENCES ket_abs_kategori(id)
);
CREATE INDEX idx_detail_harian_rekap ON detail_harian(rekap_id);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id),
  rekap_id INTEGER REFERENCES rekap_bulanan(id),
  field_diubah TEXT NOT NULL,
  nilai_lama TEXT,
  nilai_baru TEXT,
  alasan TEXT NOT NULL,
  waktu TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_rekap ON audit_log(rekap_id);

-- 7 kategori Ket.Abs yang disepakati memengaruhi insentif. Pola teks lain
-- yang muncul di file mentah dan tidak ada di sini otomatis dianggap netral
-- (ket_abs_kategori_id tetap NULL pada detail_harian).
INSERT INTO ket_abs_kategori (pola_teks, kategori, pengaruh_insentif) VALUES
  ('Ijin Sakit', 'Ijin Sakit', true),
  ('Ijin', 'Ijin', true),
  ('Cuti, tahunan', 'Cuti Tahunan', true),
  ('Sakit, ada SI', 'Sakit (dengan surat)', true),
  ('Sakit, tdk ada srt dokter', 'Sakit (tanpa surat)', true),
  ('Dinas', 'Dinas', true),
  ('Dinas Luar Kota', 'Dinas Luar Kota', true)
ON CONFLICT (pola_teks) DO NOTHING;

-- Akun bootstrap. Password awal TIDAK disimpan di sini (hanya hash bcrypt) --
-- diberikan sekali ke pemilik proyek di luar kode sumber. Segera tambahkan
-- fitur ganti password dan rotasi kredensial ini setelah login pertama.
INSERT INTO pengguna (nama, email, password_hash, peran) VALUES
  ('Dhimas', 'dhimaspalgunadi@gmail.com', '$2a$10$Pw0C4sOaJ/GN6zZMDLZp5u0FixiMFm.wG4ia4rVhVXY3KPywWIKRq', 'admin'),
  ('Pimpinan', 'pimpinan@saintjohn.sch.id', '$2a$10$NZzA5sy6PW.dlKtLWkejcu3Wl2q46/wW.Z5rNTlGhskDYb2VQlVLe', 'pimpinan')
ON CONFLICT (email) DO NOTHING;
