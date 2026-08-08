import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Periode, RekapRow } from "../types";

function formatJam(menit: number): string {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return `${String(jam).padStart(2, "0")}:${String(sisa).padStart(2, "0")}`;
}

export default function RekapListPage() {
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [periodeId, setPeriodeId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RekapRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.periode().then((r) => {
      setPeriodeList(r.periode);
      if (r.periode.length > 0) setPeriodeId(r.periode[0].id);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .rekapList({ periodeId: periodeId ?? undefined, q })
      .then((r) => setRows(r.rekap))
      .finally(() => setLoading(false));
  }, [periodeId, q]);

  return (
    <div>
      <h2>Rekap Bulanan</h2>
      <div className="bilah-filter">
        <select
          value={periodeId ?? ""}
          onChange={(e) => setPeriodeId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Semua unggahan</option>
          {periodeList.map((p) => (
            <option value={p.id} key={p.id}>
              {p.cabang} &middot; {p.jenjang} ({p.tgl_mulai} s/d {p.tgl_selesai})
            </option>
          ))}
        </select>
        <input placeholder="Cari nama atau NIP..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="pembungkus-tabel">
        <table className="tabel">
          <thead>
            <tr>
              <th>Nama</th>
              <th>NIP</th>
              <th>Unit</th>
              <th>Hari</th>
              <th>Telat</th>
              <th>Pulang Cepat</th>
              <th>Lembur</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/admin/rekap/${r.id}`}>{r.nama}</Link>
                </td>
                <td className="mono">{r.nip}</td>
                <td>
                  {r.cabang} &middot; {r.jenjang}
                </td>
                <td>{r.total_hari}</td>
                <td className="mono">{formatJam(r.total_telat_menit)}</td>
                <td className="mono">{formatJam(r.total_plg_cepat_menit)}</td>
                <td className="mono">{formatJam(r.total_lembur_menit)}</td>
                <td>
                  {!r.validasi_cocok && <span className="chip chip-warn">selisih</span>}
                  {r.status_anomali === "perlu_tinjau" && <span className="chip chip-warn">perlu tinjau</span>}
                  {r.validasi_cocok && r.status_anomali === "normal" && <span className="chip chip-baik">normal</span>}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="teks-muted">
                  Tidak ada data. Unggah file dulu di menu &ldquo;Unggah File&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
