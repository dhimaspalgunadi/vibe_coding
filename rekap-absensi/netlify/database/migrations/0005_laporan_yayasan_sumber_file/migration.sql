-- Mencatat nama file unggahan (nama_file_asal dari periode_upload) yang
-- benar-benar menjadi dasar tiap Laporan Yayasan, supaya Admin bisa
-- memverifikasi kecocokan sumber data tanpa menebak dari kombinasi
-- tanggal+cabang saja. Diisi ulang setiap kali laporan digenerate/disinkron.
ALTER TABLE laporan_yayasan ADD COLUMN sumber_file TEXT;
