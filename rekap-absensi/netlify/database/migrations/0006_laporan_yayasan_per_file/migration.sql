-- Laporan Yayasan dipisah satu-satu per file sumber (periode_upload),
-- selaras dengan kenyataan "satu file = satu cabang x satu jenjang" di alur
-- unggah -- sebelumnya beberapa file jenjang berbeda dengan cabang+tanggal
-- yang sama digabung jadi satu laporan, sekarang tiap file punya laporan
-- sendiri supaya nama Kampus/Cabang & jenjangnya persis mengikuti file itu.
ALTER TABLE laporan_yayasan ADD COLUMN periode_upload_id INTEGER REFERENCES periode_upload(id);
ALTER TABLE laporan_yayasan ADD COLUMN jenjang TEXT;

-- Lepas UNIQUE lama (tgl_mulai, tgl_selesai, cabang) -- dicari dinamis
-- karena nama constraint auto-generated Postgres tidak dijamin persis sama
-- di semua environment.
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'laporan_yayasan'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) LIKE '%tgl_mulai%tgl_selesai%cabang%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE laporan_yayasan DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE laporan_yayasan ADD CONSTRAINT laporan_yayasan_periode_upload_id_key UNIQUE (periode_upload_id);
