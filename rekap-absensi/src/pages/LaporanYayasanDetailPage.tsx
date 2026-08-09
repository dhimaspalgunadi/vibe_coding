import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { LaporanYayasanBaris, LaporanYayasanDetailResult } from "../types";

function formatRupiah(n: number): string {
  if (!n) return "-";
  return new Intl.NumberFormat("id-ID").format(n);
}

// Kolom DATE dari API kadang berupa timestamp ISO penuh (mis.
// "2026-05-16T00:00:00.000Z") -- dipotong ke "yyyy-mm-dd" untuk tampilan
// dan supaya <input type="date"> menerimanya.
function tglSaja(s: string): string {
  return s.slice(0, 10);
}

const FIELD_ANGKA: (keyof LaporanYayasanBaris)[] = [
  "kupon_periode1",
  "kupon_periode2",
  "total_kerja_hari",
  "sakit_hari",
  "izin_hari",
  "alpa_hari",
  "cuti_hari",
  "lembur_menit",
  "telat_hari",
  "telat_menit",
  "izin_telat_hari",
  "izin_telat_menit",
  "plg_cepat_hari",
  "plg_cepat_menit",
  "insentif",
];

const FIELD_TEKS: (keyof LaporanYayasanBaris)[] = [
  "nim",
  "unit",
  "nama",
  "jabatan",
  "izin_ket",
  "cuti_ket",
  "lembur_ket",
  "telat_ket",
  "izin_telat_ket",
  "plg_cepat_ket",
  "agama",
  "catatan",
];

const HEADER_FIELD_LABEL: Record<string, string> = {
  judul: "Judul Laporan",
  keterangan_periode: "Keterangan Periode",
  mengetahui_nama: "Nama (Mengetahui)",
  mengetahui_jabatan: "Jabatan (Mengetahui)",
  dibuat_oleh_nama: "Nama (Dibuat oleh)",
  dibuat_oleh_jabatan: "Jabatan (Dibuat oleh)",
};

export default function LaporanYayasanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<LaporanYayasanDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editBarisId, setEditBarisId] = useState<number | null>(null);
  const [editNilai, setEditNilai] = useState<Record<string, string>>({});
  const [editAlasan, setEditAlasan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [errorBaris, setErrorBaris] = useState<string | null>(null);

  const [tambahBuka, setTambahBuka] = useState(false);
  const [tambahNama, setTambahNama] = useState("");
  const [tambahNim, setTambahNim] = useState("");
  const [tambahUnit, setTambahUnit] = useState("");
  const [tambahJabatan, setTambahJabatan] = useState("");

  const [headerField, setHeaderField] = useState("keterangan_periode");
  const [headerNilai, setHeaderNilai] = useState("");
  const [headerMenyimpan, setHeaderMenyimpan] = useState(false);

  const [totalHariKerja, setTotalHariKerja] = useState("");
  const [menyimpanTotalHariKerja, setMenyimpanTotalHariKerja] = useState(false);
  const [errorTotalHariKerja, setErrorTotalHariKerja] = useState<string | null>(null);

  function muat() {
    if (!id) return;
    setLoading(true);
    api
      .laporanYayasanDetail(Number(id))
      .then((r) => {
        setData(r);
        setTotalHariKerja(r.laporan.total_hari_kerja == null ? "" : String(r.laporan.total_hari_kerja));
      })
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : "Gagal memuat laporan."))
      .finally(() => setLoading(false));
  }

  useEffect(muat, [id]);

  async function simpanTotalHariKerja(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setMenyimpanTotalHariKerja(true);
    setErrorTotalHariKerja(null);
    try {
      await api.laporanYayasanUpdateHeader(Number(id), "total_hari_kerja", totalHariKerja === "" ? null : Number(totalHariKerja));
      muat();
    } catch (err) {
      setErrorTotalHariKerja(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setMenyimpanTotalHariKerja(false);
    }
  }

  function mulaiKoreksi(b: LaporanYayasanBaris) {
    setEditBarisId(b.id);
    const nilai: Record<string, string> = {};
    for (const f of [...FIELD_ANGKA, ...FIELD_TEKS]) {
      const v = b[f];
      nilai[f] = v === null || v === undefined ? "" : String(v);
    }
    nilai.tanggal_masuk = b.tanggal_masuk ? tglSaja(b.tanggal_masuk) : "";
    setEditNilai(nilai);
    setEditAlasan("");
    setErrorBaris(null);
  }

  async function simpanKoreksi(e: FormEvent) {
    e.preventDefault();
    if (!editBarisId || !editAlasan.trim()) return;
    setMenyimpan(true);
    setErrorBaris(null);
    try {
      const perubahan: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editNilai)) perubahan[k] = v;
      await api.laporanYayasanUpdateBaris(editBarisId, perubahan, editAlasan.trim());
      setEditBarisId(null);
      muat();
    } catch (err) {
      setErrorBaris(err instanceof Error ? err.message : "Gagal menyimpan koreksi.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapusBaris(b: LaporanYayasanBaris) {
    const alasan = window.prompt(`Alasan menghapus baris "${b.nama}"?`);
    if (!alasan || !alasan.trim()) return;
    try {
      await api.laporanYayasanHapusBaris(b.id, alasan.trim());
      muat();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menghapus baris.");
    }
  }

  async function tambahBaris(e: FormEvent) {
    e.preventDefault();
    if (!id || !tambahNama.trim()) return;
    try {
      await api.laporanYayasanTambahBaris(Number(id), {
        nama: tambahNama.trim(),
        nim: tambahNim.trim() || undefined,
        unit: tambahUnit.trim() || undefined,
        jabatan: tambahJabatan.trim() || undefined,
      });
      setTambahNama("");
      setTambahNim("");
      setTambahUnit("");
      setTambahJabatan("");
      setTambahBuka(false);
      muat();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menambah baris.");
    }
  }

  async function simpanHeader(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setHeaderMenyimpan(true);
    try {
      const nilai = headerField === "total_hari_kerja" ? (headerNilai === "" ? null : Number(headerNilai)) : headerNilai;
      await api.laporanYayasanUpdateHeader(Number(id), headerField, nilai);
      setHeaderNilai("");
      muat();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menyimpan.");
    } finally {
      setHeaderMenyimpan(false);
    }
  }

  async function sinkronkan() {
    if (!data?.laporan.periode_upload_id) return;
    try {
      const hasil = await api.laporanYayasanGenerate(data.laporan.periode_upload_id);
      window.alert(hasil.ditambahkan > 0 ? `${hasil.ditambahkan} pegawai baru ditambahkan dari Rekap Bulanan.` : "Tidak ada pegawai baru di Rekap Bulanan.");
      muat();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menyinkronkan.");
    }
  }

  async function hapusLaporan() {
    if (!id) return;
    if (!window.confirm("Hapus seluruh Laporan Yayasan ini beserta semua barisnya? Tindakan ini tidak bisa dibatalkan.")) return;
    try {
      await api.laporanYayasanHapus(Number(id));
      navigate("/admin/laporan-yayasan");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menghapus laporan.");
    }
  }

  if (loading) return <p>Memuat...</p>;
  if (errorMsg && !data) return <p className="pesan-error">{errorMsg}</p>;
  if (!data) return null;

  const { laporan, baris, audit } = data;

  return (
    <div>
      <h2>
        {laporan.judul} &middot; {laporan.cabang}
        {laporan.jenjang && <> / {laporan.jenjang}</>}
      </h2>
      <p className="teks-muted mono">
        Periode {tglSaja(laporan.tgl_mulai)} s/d {tglSaja(laporan.tgl_selesai)}
      </p>
      {laporan.keterangan_periode && <p className="teks-muted">{laporan.keterangan_periode}</p>}
      {laporan.sumber_file && (
        <p className="teks-muted kecil">
          File sumber dari Rekap Bulanan: <span className="mono">{laporan.sumber_file}</span>
        </p>
      )}

      <form className="kartu formulir-edit" onSubmit={simpanTotalHariKerja}>
        <label>
          Total Hari Kerja Kependidikan
          <input
            type="number"
            min={0}
            value={totalHariKerja}
            onChange={(e) => setTotalHariKerja(e.target.value)}
            placeholder="mis. 21"
          />
        </label>
        <p className="teks-muted kecil lebar-penuh">
          Dipakai sebagai patokan hari kerja penuh sebulan. Insentif Rp 375.000 terisi otomatis (untuk Guru maupun
          Staf) kalau Total Kerja &ge; angka ini DAN Total Telat &lt; 15 menit dalam periode ini.
        </p>
        {errorTotalHariKerja && <p className="pesan-error lebar-penuh">{errorTotalHariKerja}</p>}
        <button type="submit" className="tombol tombol-primer" disabled={menyimpanTotalHariKerja}>
          {menyimpanTotalHariKerja ? "Menyimpan..." : "Simpan"}
        </button>
      </form>

      <div className="bilah-filter">
        <a className="tombol tombol-primer" href={api.laporanYayasanExportUrl(laporan.id)}>
          Unduh Excel
        </a>
        <button type="button" className="tombol" onClick={sinkronkan} disabled={!laporan.periode_upload_id}>
          Sinkronkan dari Rekap Bulanan
        </button>
        <button type="button" className="tombol" onClick={() => setTambahBuka((v) => !v)}>
          {tambahBuka ? "Batal Tambah" : "Tambah Baris"}
        </button>
        <button type="button" className="tombol" onClick={hapusLaporan}>
          Hapus Laporan
        </button>
      </div>

      {tambahBuka && (
        <form className="kartu formulir-edit" onSubmit={tambahBaris}>
          <label>
            Nama <input value={tambahNama} onChange={(e) => setTambahNama(e.target.value)} required autoFocus />
          </label>
          <label>
            NIM/NIP <input value={tambahNim} onChange={(e) => setTambahNim(e.target.value)} />
          </label>
          <label>
            Unit <input value={tambahUnit} onChange={(e) => setTambahUnit(e.target.value)} placeholder="mis. TK, SD, Umum" />
          </label>
          <label>
            Jabatan <input value={tambahJabatan} onChange={(e) => setTambahJabatan(e.target.value)} />
          </label>
          <button type="submit" className="tombol tombol-primer">
            Simpan Baris Baru
          </button>
        </form>
      )}

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
              <th>Aksi</th>
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
                  <td>
                    <button type="button" className="tombol" onClick={() => (editBarisId === b.id ? setEditBarisId(null) : mulaiKoreksi(b))}>
                      {editBarisId === b.id ? "Batal" : "Koreksi"}
                    </button>{" "}
                    <button type="button" className="tombol" onClick={() => hapusBaris(b)}>
                      Hapus
                    </button>
                  </td>
                </tr>
                {b.catatan && (
                  <tr>
                    <td></td>
                    <td colSpan={22} className="teks-muted kecil">
                      Catatan: {b.catatan}
                    </td>
                  </tr>
                )}
                {editBarisId === b.id && (
                  <tr>
                    <td colSpan={23}>
                      <form className="baris-koreksi baris-koreksi-lebar" onSubmit={simpanKoreksi}>
                        <label>
                          NIM/NIP <input value={editNilai.nim ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, nim: e.target.value }))} />
                        </label>
                        <label>
                          Unit <input value={editNilai.unit ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, unit: e.target.value }))} />
                        </label>
                        <label>
                          Nama <input value={editNilai.nama ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, nama: e.target.value }))} />
                        </label>
                        <label>
                          Jabatan <input value={editNilai.jabatan ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, jabatan: e.target.value }))} />
                        </label>
                        <label>
                          Agama <input value={editNilai.agama ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, agama: e.target.value }))} />
                        </label>
                        <label>
                          Tanggal Masuk
                          <input type="date" value={editNilai.tanggal_masuk ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, tanggal_masuk: e.target.value }))} />
                        </label>
                        <label>
                          Kupon Awal Periode
                          <input type="number" value={editNilai.kupon_periode1 ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, kupon_periode1: e.target.value }))} />
                        </label>
                        <label>
                          Kupon Akhir Periode
                          <input type="number" value={editNilai.kupon_periode2 ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, kupon_periode2: e.target.value }))} />
                        </label>
                        <label>
                          Total Hari Kerja
                          <input type="number" value={editNilai.total_kerja_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, total_kerja_hari: e.target.value }))} />
                        </label>
                        <label>
                          Sakit (hari)
                          <input type="number" value={editNilai.sakit_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, sakit_hari: e.target.value }))} />
                        </label>
                        <label>
                          Izin (hari)
                          <input type="number" value={editNilai.izin_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, izin_hari: e.target.value }))} />
                        </label>
                        <label>
                          Ket. Izin <input value={editNilai.izin_ket ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, izin_ket: e.target.value }))} />
                        </label>
                        <label>
                          Alpa (hari)
                          <input type="number" value={editNilai.alpa_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, alpa_hari: e.target.value }))} />
                        </label>
                        <label>
                          Cuti (hari)
                          <input type="number" value={editNilai.cuti_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, cuti_hari: e.target.value }))} />
                        </label>
                        <label>
                          Ket. Cuti <input value={editNilai.cuti_ket ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, cuti_ket: e.target.value }))} />
                        </label>
                        <label>
                          Lembur (menit)
                          <input type="number" value={editNilai.lembur_menit ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, lembur_menit: e.target.value }))} />
                        </label>
                        <label>
                          Ket. Lembur <input value={editNilai.lembur_ket ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, lembur_ket: e.target.value }))} />
                        </label>
                        <label>
                          Telat (hari)
                          <input type="number" value={editNilai.telat_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, telat_hari: e.target.value }))} />
                        </label>
                        <label>
                          Telat (menit)
                          <input type="number" value={editNilai.telat_menit ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, telat_menit: e.target.value }))} />
                        </label>
                        <label>
                          Ket. Telat <input value={editNilai.telat_ket ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, telat_ket: e.target.value }))} />
                        </label>
                        <label>
                          Izin Telat (hari)
                          <input type="number" value={editNilai.izin_telat_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, izin_telat_hari: e.target.value }))} />
                        </label>
                        <label>
                          Izin Telat (menit)
                          <input type="number" value={editNilai.izin_telat_menit ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, izin_telat_menit: e.target.value }))} />
                        </label>
                        <label>
                          Ket. Izin Telat <input value={editNilai.izin_telat_ket ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, izin_telat_ket: e.target.value }))} />
                        </label>
                        <label>
                          Pulang Cepat (hari)
                          <input type="number" value={editNilai.plg_cepat_hari ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, plg_cepat_hari: e.target.value }))} />
                        </label>
                        <label>
                          Pulang Cepat (menit)
                          <input type="number" value={editNilai.plg_cepat_menit ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, plg_cepat_menit: e.target.value }))} />
                        </label>
                        <label>
                          Ket. Pulang Cepat <input value={editNilai.plg_cepat_ket ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, plg_cepat_ket: e.target.value }))} />
                        </label>
                        <label>
                          Insentif Kehadiran (Rp)
                          <input type="number" value={editNilai.insentif ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, insentif: e.target.value }))} />
                        </label>
                        <label className="lebar-penuh">
                          Catatan (mis. info mutasi) <input value={editNilai.catatan ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, catatan: e.target.value }))} />
                        </label>
                        <label className="lebar-penuh">
                          Alasan koreksi (wajib)
                          <input value={editAlasan} onChange={(e) => setEditAlasan(e.target.value)} required placeholder="mis. koreksi data dari HRD" />
                        </label>
                        {errorBaris && <p className="pesan-error lebar-penuh">{errorBaris}</p>}
                        <button type="submit" className="tombol tombol-primer" disabled={menyimpan}>
                          {menyimpan ? "Menyimpan..." : "Simpan Koreksi"}
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {baris.length === 0 && (
              <tr>
                <td colSpan={23} className="teks-muted">
                  Belum ada baris. Klik &ldquo;Sinkronkan dari Rekap Bulanan&rdquo; atau &ldquo;Tambah Baris&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>Detail Laporan</h3>
      <form className="kartu formulir-edit" onSubmit={simpanHeader}>
        <label>
          Field
          <select value={headerField} onChange={(e) => setHeaderField(e.target.value)}>
            {Object.entries(HEADER_FIELD_LABEL).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nilai Baru
          <input
            type={headerField === "total_hari_kerja" ? "number" : "text"}
            value={headerNilai}
            onChange={(e) => setHeaderNilai(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="tombol tombol-primer" disabled={headerMenyimpan}>
          {headerMenyimpan ? "Menyimpan..." : "Simpan"}
        </button>
      </form>

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
    </div>
  );
}
