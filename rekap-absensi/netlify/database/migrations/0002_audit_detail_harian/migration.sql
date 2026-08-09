-- Menautkan audit_log ke baris detail_harian tertentu, untuk mendukung
-- koreksi manual pada jam masuk/pulang per hari (bukan cuma total bulanan).
ALTER TABLE audit_log ADD COLUMN detail_harian_id INTEGER REFERENCES detail_harian(id);
CREATE INDEX idx_audit_log_detail_harian ON audit_log(detail_harian_id);
