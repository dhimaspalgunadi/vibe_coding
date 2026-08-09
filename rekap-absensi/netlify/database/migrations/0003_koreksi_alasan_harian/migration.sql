-- Menyimpan alasan koreksi manual terakhir per hari, terpisah dari
-- ket_abs_raw (yang berasal dari mesin absensi), supaya keduanya bisa
-- ditampilkan tanpa saling menimpa di kolom Ket. pada Rincian Harian.
ALTER TABLE detail_harian ADD COLUMN koreksi_alasan TEXT;
