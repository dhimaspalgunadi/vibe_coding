-- Menautkan audit_log ke pegawai supaya perubahan data pegawai (unit,
-- jabatan, agama, tanggal masuk) dari menu Data Pegawai tercatat di Log
-- Perubahan yang sama, seperti histori rekap_bulanan/detail_harian/
-- laporan_yayasan_baris yang sudah ada. SET NULL saat pegawai dihapus --
-- pegawai memang boleh dihapus permanen kalau belum punya riwayat rekap.
ALTER TABLE audit_log ADD COLUMN pegawai_id INTEGER REFERENCES pegawai(id) ON DELETE SET NULL;
CREATE INDEX idx_audit_log_pegawai ON audit_log(pegawai_id);
