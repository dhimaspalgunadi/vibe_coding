import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import type { LaporanYayasanDetailResult } from "../types";

function formatRupiah(n: number): string {
  if (!n) return "-";
  return new Intl.NumberFormat("id-ID").format(n);
}

// Kolom DATE dari API kadang berupa timestamp ISO penuh (mis.
// "2026-05-16T00:00:00.000Z") -- dipotong ke "yyyy-mm-dd" untuk tampilan.
function tglSaja(s: string): string {
  return s.slice(0, 10);
}

export default function PimpinanLaporanDetailPage() {
  const { id } = useParams();
  const { sesi, logout } = useAuth();
  const [data, setData] = useState<LaporanYayasanDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .laporanYayasanDetail(Number(id))
      .then(setData)
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : "Gagal memuat laporan."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="tata-letak-pimpinan">
      <header className="bilah-atas">
        <span className="judul-app">Detail Laporan ke Yayasan</span>
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
        <p>
          <Link to="/pimpinan">&larr; Kembali ke Ringkasan Kehadiran</Link>
        </p>

        {loading && <p>Memuat...</p>}
        {errorMsg && !data && <p className="pesan-error">{errorMsg}</p>}

        {data && (
          <>
            <h2>
              {data.laporan.judul} &middot; {data.laporan.cabang}
              {data.laporan.jenjang && <> / {data.laporan.jenjang}</>}
            </h2>
            <p className="teks-muted mono">
              Periode {tglSaja(data.laporan.tgl_mulai)} s/d {tglSaja(data.laporan.tgl_selesai)}
            </p>
            {data.laporan.keterangan_periode && <p className="teks-muted">{data.laporan.keterangan_periode}</p>}
            {data.laporan.sumber_file && (
              <p className="teks-muted kecil">
                File sumber dari Rekap Bulanan: <span className="mono">{data.laporan.sumber_file}</span>
              </p>
            )}

            <div className="kartu">
              <p className="teks-muted">
                Total Hari Kerja Kependidikan: <strong>{data.laporan.total_hari_kerja ?? "-"}</strong>
              </p>
            </div>

            <div className="bilah-filter">
              <a className="tombol tombol-primer" href={api.laporanYayasanExportUrl(data.laporan.id)}>
                Unduh Excel
              </a>
            </div>

            <LaporanDetailIsi data={data} />
          </>
        )}
      </main>
    </div>
  );
}

function LaporanDetailIsi({ data }: { data: LaporanYayasanDetailResult }) {
  const { baris, audit } = data;
  return (
    <>
      <div className="pembungkus-tabel">
        <table className="tabel tabel-kecil">
          <thead>
            <tr>
              <th>No</th>
              <th>NIM</th>
              <th>Unit</th>
              <th>Nama</th>
              <th>Jabatan</th>
              <th>Agama</th>
              <th>Tgl Masuk</th>
              <th>Kupon Awal</th>
              <th>Kupon Akhir</th>
              <th>Total Kerja</th>
              <th>Insentif</th>
              <th>Sakit</th>
              <th>Izin</th>
              <th>Alpa</th>
              <th>Cuti</th>
              <th>Lembur</th>
              <th>Telat (hr)</th>
              <th>Telat (mnt)</th>
              <th>Izin Tlt (hr)</th>
              <th>Izin Tlt (mnt)</th>
              <th>Plg Cepat (hr)</th>
              <th>Plg Cepat (mnt)</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b, i) => (
              <Fragment key={b.id}>
                <tr>
                  <td>{i + 1}</td>
                  <td className="mono">{b.nim ?? "-"}</td>
                  <td>{b.unit ?? "-"}</td>
                  <td>{b.nama}</td>
                  <td>{b.jabatan ?? "-"}</td>
                  <td>{b.agama ?? "-"}</td>
                  <td className="mono">{b.tanggal_masuk ? tglSaja(b.tanggal_masuk) : "-"}</td>
                  <td className="mono">{b.kupon_periode1}</td>
                  <td className="mono">{b.kupon_periode2}</td>
                  <td className="mono">{b.total_kerja_hari}</td>
                  <td className="mono">{formatRupiah(b.insentif)}</td>
                  <td className="mono">{b.sakit_hari || "-"}</td>
                  <td className="mono">{b.izin_hari || "-"}</td>
                  <td className="mono">{b.alpa_hari || "-"}</td>
                  <td className="mono">{b.cuti_hari || "-"}</td>
                  <td className="mono">{b.lembur_menit || "-"}</td>
                  <td className="mono">{b.telat_hari || "-"}</td>
                  <td className="mono">{b.telat_menit || "-"}</td>
                  <td className="mono">{b.izin_telat_hari || "-"}</td>
                  <td className="mono">{b.izin_telat_menit || "-"}</td>
                  <td className="mono">{b.plg_cepat_hari || "-"}</td>
                  <td className="mono">{b.plg_cepat_menit || "-"}</td>
                </tr>
                {b.catatan && (
                  <tr>
                    <td></td>
                    <td colSpan={21} className="teks-muted kecil">
                      Catatan: {b.catatan}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={22} className="teks-muted">
                  Belum ada baris pada laporan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>Riwayat Perubahan</h3>
      {audit.length === 0 ? (
        <p className="teks-muted">Belum ada perubahan pada laporan ini.</p>
      ) : (
        <ul className="daftar-audit">
          {audit.map((a) => (
            <li key={a.id}>
              <span className="mono kecil">{new Date(a.waktu).toLocaleString("id-ID")}</span> &middot;{" "}
              <strong>{a.admin_nama}</strong>{" "}
              {a.field_diubah === "baris_ditambahkan" && (
                <>
                  menambahkan baris <span className="mono">{a.pegawai_nama}</span>.
                </>
              )}
              {a.field_diubah === "baris_dihapus" && (
                <>
                  menghapus baris <span className="mono">{a.nilai_lama}</span>.
                </>
              )}
              {a.field_diubah !== "baris_ditambahkan" && a.field_diubah !== "baris_dihapus" && (
                <>
                  mengubah <span className="mono">{a.field_diubah}</span>
                  {a.pegawai_nama && (
                    <>
                      {" "}
                      milik <span className="mono">{a.pegawai_nama}</span>
                    </>
                  )}{" "}
                  dari <span className="mono">{a.nilai_lama ?? "-"}</span> ke <span className="mono">{a.nilai_baru ?? "-"}</span>.
                </>
              )}
              <div className="teks-muted kecil">Alasan: {a.alasan}</div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
