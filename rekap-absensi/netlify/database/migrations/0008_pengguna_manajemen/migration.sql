-- Menu "Manajemen User" di dashboard Admin: insert/edit/nonaktifkan/hapus
-- akun login. status_aktif dipakai sebagai jalan aman kalau hard-delete
-- diblokir foreign key (akun itu tercatat sebagai pengunggah file di
-- periode_upload atau aktor di audit_log) -- login ditolak untuk akun
-- nonaktif. pengguna_target_id menautkan audit_log ke akun YANG DIUBAH,
-- terpisah dari pengguna_id yang sejak awal berarti akun yang MELAKUKAN
-- perubahan (NOT NULL, dipakai di seluruh tabel ini) -- meniru pola
-- pegawai_id/laporan_yayasan_baris_id yang sudah ada.
ALTER TABLE pengguna ADD COLUMN status_aktif BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE audit_log ADD COLUMN pengguna_target_id INTEGER REFERENCES pengguna(id) ON DELETE SET NULL;
CREATE INDEX idx_audit_log_pengguna_target ON audit_log(pengguna_target_id);
