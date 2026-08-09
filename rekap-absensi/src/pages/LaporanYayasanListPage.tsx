import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { LaporanYayasanRingkas, Periode } from "../types";

// Kolom DATE dari API kadang berupa timestamp ISO penuh (mis.
// "2026-05-16T00:00:00.000Z"), bukan "yyyy-mm-dd" polos -- dipotong di sini
// khusus untuk tampilan, tanpa mengubah nilai yang dipakai sebagai kunci.
function tglSaja(s: string): string {
  return s.slice(0, 10);
}

export default function LaporanYayasanListPage() {
  const navigate = useNavigate();
  const [laporan, setLaporan] = useState<LaporanYayasanRingkas[]>([]);
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [loading, setLoading] = useState(true);

  const [tglTerpilih, setTglTerpilih] = useState("");
  const [periodeUploadId, setPeriodeUploadId] = useState<number | null>(null);
  const [membuat, setMembuat] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [menghapusId, setMenghapusId] = useState<number | null>(null);

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

  // Setiap unggahan (satu file = satu cabang x satu jenjang) jadi satu opsi
  // sendiri di sini, dilabeli dengan nama filenya -- supaya Laporan Yayasan
  // yang dibuat benar-benar terpisah per file, bukan digabung lintas jenjang.
  const opsiFile = useMemo(() => {
    if (!tglTerpilih) return [];
    const [mulai, selesai] = tglTerpilih.split("|");
    return periodeList
      .filter((p) => p.tgl_mulai === mulai && p.tgl_selesai === selesai)
      .sort((a, b) => a.cabang.localeCompare(b.cabang) || a.jenjang.localeCompare(b.jenjang));
  }, [tglTerpilih, periodeList]);

  const fileTerpilih = opsiFile.find((p) => p.id === periodeUploadId) ?? null;

  useEffect(() => {
    if (opsiPeriode.length > 0 && !tglTerpilih) setTglTerpilih(`${opsiPeriode[0][0]}`);
  }, [opsiPeriode, tglTerpilih]);

  useEffect(() => {
    if (opsiFile.length > 0) setPeriodeUploadId(opsiFile[0].id);
    else setPeriodeUploadId(null);
  }, [opsiFile]);

  async function buatLaporan() {
    if (!periodeUploadId) return;
    setMembuat(true);
    setErrorMsg(null);
    try {
      const hasil = await api.laporanYayasanGenerate(periodeUploadId);
      navigate(`/admin/laporan-yayasan/${hasil.laporan.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuat laporan.");
    } finally {
      setMembuat(false);
    }
  }

  async function hapusLaporan(l: LaporanYayasanRingkas) {
    const label = `${l.cabang}${l.jenjang ? ` / ${l.jenjang}` : ""} (${tglSaja(l.tgl_mulai)} s/d ${tglSaja(l.tgl_selesai)})`;
    if (!window.confirm(`Hapus Laporan Yayasan "${label}" beserta semua barisnya? Tindakan ini tidak bisa dibatalkan.`)) return;
    setMenghapusId(l.id);
    try {
      await api.laporanYayasanHapus(l.id);
      setLaporan((rows) => rows.filter((r) => r.id !== l.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menghapus laporan.");
    } finally {
      setMenghapusId(null);
    }
  }

  return (
    <div>
      <h2>Laporan ke Yayasan</h2>
      <p className="teks-muted">
        Laporan format &ldquo;Perfect Attendance&rdquo; yang dikirim ke Yayasan, diringkas otomatis dari Rekap
        Bulanan. Setiap laporan dipisah per file sumber (satu file unggahan = satu Kampus/Cabang x satu jenjang),
        lalu semua baris bisa dikoreksi, ditambah, atau dihapus oleh Admin sebelum diunduh sebagai file Excel.
      </p>

      <div className="kartu formulir-edit">
        <label>
          Periode
          <select value={tglTerpilih} onChange={(e) => setTglTerpilih(e.target.value)}>
            {opsiPeriode.length === 0 && <option value="">Belum ada data unggahan</option>}
            {opsiPeriode.map(([key, p]) => (
              <option value={key} key={key}>
                {tglSaja(p.tgl_mulai)} s/d {tglSaja(p.tgl_selesai)}
              </option>
            ))}
          </select>
        </label>
        <label>
          File Sumber (Kampus/Cabang)
          <select value={periodeUploadId ?? ""} onChange={(e) => setPeriodeUploadId(e.target.value ? Number(e.target.value) : null)}>
            {opsiFile.length === 0 && <option value="">-</option>}
            {opsiFile.map((p) => (
              <option value={p.id} key={p.id}>
                {p.nama_file_asal} &middot; {p.cabang} / {p.jenjang}
              </option>
            ))}
          </select>
        </label>
        {fileTerpilih && (
          <p className="teks-muted kecil lebar-penuh">
            Kampus: <strong>{fileTerpilih.cabang}</strong> &middot; Jenjang: <strong>{fileTerpilih.jenjang}</strong>{" "}
            &middot; File: <span className="mono">{fileTerpilih.nama_file_asal}</span>
          </p>
        )}
        {errorMsg && <p className="pesan-error lebar-penuh">{errorMsg}</p>}
        <button type="button" className="tombol tombol-primer" disabled={!periodeUploadId || membuat} onClick={buatLaporan}>
          {membuat ? "Membuat..." : "Buat / Perbarui Laporan"}
        </button>
      </div>

      <h3>Laporan Tersimpan</h3>
      <div className="pembungkus-tabel">
        <table className="tabel">
          <thead>
            <tr>
              <th>Kampus</th>
              <th>Jenjang</th>
              <th>Periode</th>
              <th>File Sumber</th>
              <th>Jumlah Baris</th>
              <th>Terakhir Diperbarui</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {laporan.map((l) => (
              <tr key={l.id}>
                <td>{l.cabang}</td>
                <td>{l.jenjang ?? "-"}</td>
                <td className="mono">
                  {tglSaja(l.tgl_mulai)} s/d {tglSaja(l.tgl_selesai)}
                </td>
                <td className="teks-muted kecil">{l.sumber_file ?? "-"}</td>
                <td>{l.jumlah_baris}</td>
                <td className="teks-muted kecil">{new Date(l.diperbarui_pada).toLocaleString("id-ID")}</td>
                <td>
                  <Link to={`/admin/laporan-yayasan/${l.id}`}>Buka</Link>{" "}
                  <button
                    type="button"
                    className="tombol"
                    disabled={menghapusId === l.id}
                    onClick={() => hapusLaporan(l)}
                  >
                    {menghapusId === l.id ? "Menghapus..." : "Hapus"}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && laporan.length === 0 && (
              <tr>
                <td colSpan={7} className="teks-muted">
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
