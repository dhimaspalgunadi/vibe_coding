import { useEffect, useState } from "react";
import { api } from "../api";
import type { AuditRow } from "../types";

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .auditLog()
      .then((r) => setRows(r.log))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Log Perubahan</h2>
      <p className="teks-muted">Setiap koreksi manual pada rekap tercatat di sini dan tidak bisa dihapus.</p>
      {loading ? (
        <p>Memuat...</p>
      ) : (
        <div className="pembungkus-tabel">
          <table className="tabel">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Admin</th>
                <th>Pegawai</th>
                <th>Tanggal Terkait</th>
                <th>Field</th>
                <th>Lama</th>
                <th>Baru</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono kecil">{new Date(r.waktu).toLocaleString("id-ID")}</td>
                  <td>{r.admin_nama}</td>
                  <td>
                    {r.pegawai_nama ?? "-"} <span className="teks-muted mono kecil">{r.nip}</span>
                  </td>
                  <td className="mono">{r.tanggal_terkait ?? "-"}</td>
                  <td className="mono">{r.field_diubah}</td>
                  <td className="mono">{r.nilai_lama}</td>
                  <td className="mono">{r.nilai_baru}</td>
                  <td>{r.alasan}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="teks-muted">
                    Belum ada perubahan tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
