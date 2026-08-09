import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { LaporanYayasanRingkas, Periode } from "../types";

export default function LaporanYayasanListPage() {
  const navigate = useNavigate();
  const [laporan, setLaporan] = useState<LaporanYayasanRingkas[]>([]);
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [loading, setLoading] = useState(true);

  const [tglTerpilih, setTglTerpilih] = useState("");
  const [cabang, setCabang] = useState("");
  const [membuat, setMembuat] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function muat() {
    setLoading(true);
    Promise.all([api.laporanYayasanList(), api.periode()])
      .then(([l, p]) => {
        setLaporan(l.laporan);
        setPeriodeList(p.periode);
      })
      .finally(() => setLoading(false));
  }

  useEffect(muat, []);

  const opsiPeriode = useMemo(() => {
    const map = new Map<string, { tgl_mulai: string; tgl_selesai: string }>();
    for (const p of periodeList) {
      const key = `${p.tgl_mulai}|${p.tgl_selesai}`;
      if (!map.has(key)) map.set(key, { tgl_mulai: p.tgl_mulai, tgl_selesai: p.tgl_selesai });
    }
    return [...map.entries()];
  }, [periodeList]);

  const opsiCabang = useMemo(() => {
    if (!tglTerpilih) return [];
    const [mulai, selesai] = tglTerpilih.split("|");
    const set = new Set(periodeList.filter((p) => p.tgl_mulai === mulai && p.tgl_selesai === selesai).map((p) => p.cabang));
    return [...set];
  }, [tglTerpilih, periodeList]);

  useEffect(() => {
    if (opsiPeriode.length > 0 && !tglTerpilih) setTglTerpilih(`${opsiPeriode[0][0]}`);
  }, [opsiPeriode, tglTerpilih]);

  useEffect(() => {
    if (opsiCabang.length > 0) setCabang(opsiCabang[0]);
    else setCabang("");
  }, [opsiCabang]);

  async function buatLaporan() {
    if (!tglTerpilih || !cabang) return;
    const [mulai, selesai] = tglTerpilih.split("|");
    setMembuat(true);
    setErrorMsg(null);
    try {
      const hasil = await api.laporanYayasanGenerate(mulai, selesai, cabang);
      navigate(`/admin/laporan-yayasan/${hasil.laporan.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuat laporan.");
    } finally {
      setMembuat(false);
    }
  }

  return (
    <div>
      <h2>Laporan ke Yayasan</h2>
      <p className="teks-muted">
        Laporan format &ldquo;Perfect Attendance&rdquo; yang dikirim ke Yayasan, diringkas otomatis dari Rekap
        Bulanan tiap unit sekolah. Setelah dibuat, semua baris bisa dikoreksi, ditambah, atau dihapus oleh Admin
        sebelum diunduh sebagai file Excel.
      </p>

      <div className="kartu formulir-edit">
        <label>
          Periode
          <select value={tglTerpilih} onChange={(e) => setTglTerpilih(e.target.value)}>
            {opsiPeriode.length === 0 && <option value="">Belum ada data unggahan</option>}
            {opsiPeriode.map(([key, p]) => (
              <option value={key} key={key}>
                {p.tgl_mulai} s/d {p.tgl_selesai}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kampus / Cabang
          <select value={cabang} onChange={(e) => setCabang(e.target.value)}>
            {opsiCabang.length === 0 && <option value="">-</option>}
            {opsiCabang.map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        {errorMsg && <p className="pesan-error lebar-penuh">{errorMsg}</p>}
        <button type="button" className="tombol tombol-primer" disabled={!tglTerpilih || !cabang || membuat} onClick={buatLaporan}>
          {membuat ? "Membuat..." : "Buat / Perbarui Laporan"}
        </button>
      </div>

      <h3>Laporan Tersimpan</h3>
      <div className="pembungkus-tabel">
        <table className="tabel">
          <thead>
            <tr>
              <th>Kampus</th>
              <th>Periode</th>
              <th>Jumlah Baris</th>
              <th>Terakhir Diperbarui</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {laporan.map((l) => (
              <tr key={l.id}>
                <td>{l.cabang}</td>
                <td className="mono">
                  {l.tgl_mulai} s/d {l.tgl_selesai}
                </td>
                <td>{l.jumlah_baris}</td>
                <td className="teks-muted kecil">{new Date(l.diperbarui_pada).toLocaleString("id-ID")}</td>
                <td>
                  <Link to={`/admin/laporan-yayasan/${l.id}`}>Buka</Link>
                </td>
              </tr>
            ))}
            {!loading && laporan.length === 0 && (
              <tr>
                <td colSpan={5} className="teks-muted">
                  Belum ada laporan. Buat laporan baru di atas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
