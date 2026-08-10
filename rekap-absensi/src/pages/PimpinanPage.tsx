import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import type { LaporanYayasanRingkas, PeriodeRingkasan, PimpinanSummary } from "../types";

function formatJam(menit: number): string {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return `${jam}j ${sisa}m`;
}

// Kolom DATE dari API kadang berupa timestamp ISO penuh, dipotong ke
// "yyyy-mm-dd" supaya bisa dicocokkan dengan aman terhadap tglMulai/tglSelesai.
function tglSaja(s: string): string {
  return s.slice(0, 10);
}

export default function PimpinanPage() {
  const { sesi, logout } = useAuth();
  const [periodeList, setPeriodeList] = useState<PeriodeRingkasan[]>([]);
  const [terpilih, setTerpilih] = useState<string>("");
  const [ringkasan, setRingkasan] = useState<PimpinanSummary | null>(null);
  const [laporanList, setLaporanList] = useState<LaporanYayasanRingkas[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.periodeRingkasan().then((r) => {
      setPeriodeList(r.periode);
      if (r.periode.length > 0) setTerpilih(`${r.periode[0].tgl_mulai}|${r.periode[0].tgl_selesai}`);
    });
  }, []);

  useEffect(() => {
    if (!terpilih) return;
    const [tglMulai, tglSelesai] = terpilih.split("|");
    setLoading(true);
    Promise.all([api.pimpinanSummary(tglMulai, tglSelesai), api.laporanYayasanList()])
      .then(([s, l]) => {
        setRingkasan(s);
        setLaporanList(l.laporan);
      })
      .finally(() => setLoading(false));
  }, [terpilih]);

  const perCabang = ringkasan?.perCabang ?? [];
  const maxTelat = Math.max(1, ...perCabang.map((c) => c.rata_telat_menit));

  // Peta cabang|jenjang -> id Laporan ke Yayasan yang sudah dibuat Admin
  // untuk periode yang sedang dipilih, dipakai supaya Pimpinan bisa langsung
  // membuka detail per unit sekolah yang sama seperti dilihat Admin.
  const petaLaporan = useMemo(() => {
    const map = new Map<string, number>();
    if (!terpilih) return map;
    const [mulai, selesai] = terpilih.split("|");
    for (const l of laporanList) {
      if (tglSaja(l.tgl_mulai) === mulai && tglSaja(l.tgl_selesai) === selesai) {
        map.set(`${l.cabang}|${l.jenjang ?? ""}`, l.id);
      }
    }
    return map;
  }, [terpilih, laporanList]);

  return (
    <div className="tata-letak-pimpinan">
      <header className="bilah-atas">
        <span className="judul-app">Ringkasan Kehadiran</span>
        <div className="bilah-atas-kanan">
          <span className="teks-muted">{sesi?.nama}</span>
          <Link to="/profil" className="tombol">
            Profil
          </Link>
          <button className="tombol" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>
      <main className="konten-pimpinan">
        <select value={terpilih} onChange={(e) => setTerpilih(e.target.value)}>
          {periodeList.map((p) => (
            <option value={`${p.tgl_mulai}|${p.tgl_selesai}`} key={`${p.tgl_mulai}-${p.tgl_selesai}`}>
              {p.tgl_mulai} s/d {p.tgl_selesai} ({p.jumlah_unit} unit kerja)
            </option>
          ))}
        </select>

        {loading && <p>Memuat...</p>}

        {ringkasan?.total && (
          <div className="baris-kpi">
            <div className="kartu kpi">
              <span className="kpi-nilai">{ringkasan.total.jumlah_pegawai}</span>
              <span className="kpi-label">Pegawai</span>
            </div>
            <div className="kartu kpi">
              <span className="kpi-nilai mono">{formatJam(ringkasan.total.rata_telat_menit)}</span>
              <span className="kpi-label">Rata-rata Telat</span>
            </div>
            <div className="kartu kpi">
              <span className="kpi-nilai mono">{formatJam(ringkasan.total.total_lembur_menit)}</span>
              <span className="kpi-label">Total Lembur</span>
            </div>
            <div className="kartu kpi">
              <span className="kpi-nilai">{ringkasan.total.perlu_tinjau}</span>
              <span className="kpi-label">Perlu Ditinjau</span>
            </div>
          </div>
        )}

        {perCabang.length > 0 && (
          <>
            <h3>Rata-rata Telat per Cabang</h3>
            <div className="grafik-batang">
              {perCabang.map((c) => (
                <div
                  className="batang"
                  key={c.cabang}
                  style={{ height: `${Math.max(6, (c.rata_telat_menit / maxTelat) * 100)}%` }}
                  data-label={c.cabang}
                  title={`${c.cabang}: ${formatJam(c.rata_telat_menit)}`}
                />
              ))}
            </div>
          </>
        )}

        <h3>Per Unit Kerja</h3>
        <div className="pembungkus-tabel">
          <table className="tabel">
            <thead>
              <tr>
                <th>Cabang</th>
                <th>Jenjang</th>
                <th>Pegawai</th>
                <th>Rata-rata Telat</th>
                <th>Total Lembur</th>
                <th>Laporan ke Yayasan</th>
              </tr>
            </thead>
            <tbody>
              {(ringkasan?.perUnit ?? []).map((u) => {
                const laporanId = petaLaporan.get(`${u.cabang}|${u.jenjang}`);
                return (
                  <tr key={`${u.cabang}-${u.jenjang}`}>
                    <td>{u.cabang}</td>
                    <td>{u.jenjang}</td>
                    <td>{u.jumlah_pegawai}</td>
                    <td className="mono">{formatJam(u.rata_telat_menit)}</td>
                    <td className="mono">{formatJam(u.total_lembur_menit)}</td>
                    <td>
                      {laporanId ? (
                        <Link to={`/pimpinan/laporan-yayasan/${laporanId}`}>Lihat Detail</Link>
                      ) : (
                        <span className="teks-muted kecil">Belum dibuat</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(!ringkasan || ringkasan.perUnit.length === 0) && !loading && (
                <tr>
                  <td colSpan={6} className="teks-muted">
                    Belum ada data untuk periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
