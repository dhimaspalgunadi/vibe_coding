import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import type { RekapDetailResult } from "../types";

function formatJam(menit: number): string {
  const tanda = menit < 0 ? "-" : "";
  const abs = Math.abs(menit);
  const jam = Math.floor(abs / 60);
  const sisa = abs % 60;
  return `${tanda}${String(jam).padStart(2, "0")}:${String(sisa).padStart(2, "0")}`;
}

const JAM_12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MENIT_60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

// Input <input type="time"> mengikuti format jam 12 jam (AM/PM) di sebagian
// browser tapi menyimpan/menampilkan nilai 24 jam ("06:40", "18:01") --
// diganti dengan 3 dropdown eksplisit (Jam/Menit/AM-PM) supaya konsisten di
// semua browser, lalu dikonversi ke format 24 jam saat disimpan.
function jamKeBagian(v: string): { jam12: string; menit: string; periode: "AM" | "PM" } {
  if (!v) return { jam12: "", menit: "", periode: "AM" };
  const [hStr, mStr] = v.split(":");
  const h = parseInt(hStr, 10);
  const periode: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  let jam12 = h % 12;
  if (jam12 === 0) jam12 = 12;
  return { jam12: String(jam12).padStart(2, "0"), menit: (mStr ?? "00").padStart(2, "0"), periode };
}

function bagianKeJam(jam12: string, menit: string, periode: "AM" | "PM"): string {
  if (!jam12 || !menit) return "";
  let h = parseInt(jam12, 10) % 12;
  if (periode === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${menit}`;
}

function PilihJam({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const b = jamKeBagian(value);
  function ubah(jam12: string, menit: string, periode: "AM" | "PM") {
    onChange(bagianKeJam(jam12, menit, periode));
  }
  return (
    <div className="pilih-jam">
      <select value={b.jam12} onChange={(e) => ubah(e.target.value, b.menit || "00", b.periode)}>
        <option value="">Jam</option>
        {JAM_12.map((j) => (
          <option value={j} key={j}>
            {j}
          </option>
        ))}
      </select>
      <span>:</span>
      <select value={b.menit} onChange={(e) => ubah(b.jam12 || "12", e.target.value, b.periode)}>
        <option value="">Menit</option>
        {MENIT_60.map((m) => (
          <option value={m} key={m}>
            {m}
          </option>
        ))}
      </select>
      <select value={b.periode} onChange={(e) => ubah(b.jam12 || "12", b.menit || "00", e.target.value as "AM" | "PM")}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

const PILIHAN_ALASAN_KOREKSI = [
  "Lupa Absensi Masuk",
  "Lupa Absensi Pulang",
  "Ijin Tanpa Ket. Dokter",
  "Ijin Ket. Dokter",
  "Cuti Tahunan",
  "Cuti Melahirkan",
  "Cuti Menikah",
  "Dinas Kantor",
  "Alpha",
];

const FIELD_LABEL: Record<string, string> = {
  total_hari: "Total Hari",
  total_jam_menit: "Total Jam (menit)",
  total_telat_menit: "Total Telat (menit)",
  total_plg_cepat_menit: "Total Pulang Cepat (menit)",
  total_lembur_menit: "Total Lembur (menit)",
  status_anomali: "Status Anomali",
};

export default function RekapDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<RekapDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [field, setField] = useState("total_telat_menit");
  const [nilaiBaru, setNilaiBaru] = useState("");
  const [alasan, setAlasan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  const [editHarianId, setEditHarianId] = useState<number | null>(null);
  const [editMasuk, setEditMasuk] = useState("");
  const [editPulang, setEditPulang] = useState("");
  const [editAlasan, setEditAlasan] = useState("");
  const [menyimpanHarian, setMenyimpanHarian] = useState(false);
  const [errorHarian, setErrorHarian] = useState<string | null>(null);

  function mulaiKoreksi(h: RekapDetailResult["harian"][number]) {
    setEditHarianId(h.id);
    setEditMasuk(h.masuk_aktual ?? "");
    setEditPulang(h.pulang_aktual ?? "");
    setEditAlasan("");
    setErrorHarian(null);
  }

  function batalKoreksi() {
    setEditHarianId(null);
  }

  async function simpanKoreksiHarian(e: FormEvent) {
    e.preventDefault();
    if (!editHarianId || !editAlasan.trim()) return;
    setMenyimpanHarian(true);
    setErrorHarian(null);
    try {
      await api.harianUpdate(editHarianId, editMasuk || null, editPulang || null, editAlasan.trim());
      setEditHarianId(null);
      muat();
    } catch (err) {
      setErrorHarian(err instanceof Error ? err.message : "Gagal menyimpan koreksi.");
    } finally {
      setMenyimpanHarian(false);
    }
  }

  function muat() {
    if (!id) return;
    setLoading(true);
    api
      .rekapDetail(Number(id))
      .then(setData)
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : "Gagal memuat data."))
      .finally(() => setLoading(false));
  }

  useEffect(muat, [id]);

  async function simpanPerubahan(e: FormEvent) {
    e.preventDefault();
    if (!id || !alasan.trim() || nilaiBaru === "") return;
    setMenyimpan(true);
    setErrorMsg(null);
    try {
      await api.rekapUpdate(Number(id), field, field === "status_anomali" ? nilaiBaru : Number(nilaiBaru), alasan.trim());
      setNilaiBaru("");
      setAlasan("");
      muat();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan perubahan.");
    } finally {
      setMenyimpan(false);
    }
  }

  if (loading) return <p>Memuat...</p>;
  if (errorMsg && !data) return <p className="pesan-error">{errorMsg}</p>;
  if (!data) return null;

  const { rekap, harian, audit } = data;

  return (
    <div>
      <h2>{rekap.nama}</h2>
      <p className="teks-muted mono">
        {rekap.nip} &middot; {rekap.cabang} &middot; {rekap.jenjang}
      </p>
      <p className="teks-muted">
        Periode {rekap.tgl_mulai} s/d {rekap.tgl_selesai} &middot; sumber: {rekap.nama_file_asal}
      </p>

      <div className="baris-kpi">
        <div className="kartu kpi">
          <span className="kpi-nilai">{rekap.total_hari}</span>
          <span className="kpi-label">Hari</span>
        </div>
        <div className="kartu kpi">
          <span className="kpi-nilai mono">{formatJam(rekap.total_telat_menit)}</span>
          <span className="kpi-label">Telat</span>
        </div>
        <div className="kartu kpi">
          <span className="kpi-nilai mono">{formatJam(rekap.total_plg_cepat_menit)}</span>
          <span className="kpi-label">Pulang Cepat</span>
        </div>
        <div className="kartu kpi">
          <span className="kpi-nilai mono">{formatJam(rekap.total_lembur_menit)}</span>
          <span className="kpi-label">Lembur</span>
        </div>
      </div>

      {!rekap.validasi_cocok && (
        <div className="kartu peringatan">
          <strong>Selisih validasi.</strong> Jumlah harian tidak sama persis dengan total dari mesin absensi.
          <pre className="mono kecil">{rekap.validasi_catatan}</pre>
        </div>
      )}
      {rekap.status_anomali === "perlu_tinjau" && (
        <div className="kartu peringatan">
          <strong>Perlu ditinjau.</strong> {rekap.anomali_catatan}
        </div>
      )}

      <h3>Rincian Harian</h3>
      <p className="teks-muted">
        Klik <strong>Koreksi</strong> pada baris yang perlu diperbaiki. Telat/pulang cepat/lembur hari itu
        dan total bulanan akan dihitung ulang otomatis, dan tercatat di Riwayat Perubahan.
      </p>
      <div className="pembungkus-tabel">
        <table className="tabel tabel-kecil">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Hari</th>
              <th>Jam Kerja</th>
              <th>Masuk</th>
              <th>Pulang</th>
              <th>Telat</th>
              <th>Pulang Cepat</th>
              <th>Lembur</th>
              <th>Ket.</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {harian.map((h) => (
              <Fragment key={h.id}>
                <tr className={h.libur ? "baris-libur" : ""}>
                  <td className="mono">{h.tanggal}</td>
                  <td>{h.hari}</td>
                  <td>{h.jam_kerja ?? "-"}</td>
                  <td className="mono">{h.masuk_aktual ?? "-"}</td>
                  <td className="mono">{h.pulang_aktual ?? "-"}</td>
                  <td className="mono">{formatJam(h.telat_menit)}</td>
                  <td className="mono">{formatJam(h.plg_cepat_menit)}</td>
                  <td className="mono">{formatJam(h.lembur_menit)}</td>
                  <td>
                    {h.ket_abs_raw && <div title={h.ket_abs_kategori ?? undefined}>{h.ket_abs_raw}</div>}
                    {h.koreksi_alasan && <div className="teks-muted kecil">Dikoreksi: {h.koreksi_alasan}</div>}
                  </td>
                  <td>
                    {editHarianId === h.id ? (
                      <button type="button" className="tombol" onClick={batalKoreksi}>
                        Batal
                      </button>
                    ) : (
                      <button type="button" className="tombol" onClick={() => mulaiKoreksi(h)}>
                        Koreksi
                      </button>
                    )}
                  </td>
                </tr>
                {editHarianId === h.id && (
                  <tr>
                    <td colSpan={10}>
                      <form className="baris-koreksi" onSubmit={simpanKoreksiHarian}>
                        <label>
                          Jam Masuk
                          <PilihJam value={editMasuk} onChange={setEditMasuk} />
                        </label>
                        <label>
                          Jam Pulang
                          <PilihJam value={editPulang} onChange={setEditPulang} />
                        </label>
                        <label className="lebar-penuh">
                          Alasan koreksi (wajib)
                          <select value={editAlasan} onChange={(e) => setEditAlasan(e.target.value)} required autoFocus>
                            <option value="">Pilih alasan...</option>
                            {PILIHAN_ALASAN_KOREKSI.map((a) => (
                              <option value={a} key={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </label>
                        {errorHarian && <p className="pesan-error lebar-penuh">{errorHarian}</p>}
                        <button type="submit" className="tombol tombol-primer" disabled={menyimpanHarian}>
                          {menyimpanHarian ? "Menyimpan..." : "Simpan Koreksi"}
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Koreksi Manual</h3>
      <form className="kartu formulir-edit" onSubmit={simpanPerubahan}>
        <label>
          Field
          <select value={field} onChange={(e) => setField(e.target.value)}>
            {Object.entries(FIELD_LABEL).map(([k, v]) => (
              <option value={k} key={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nilai Baru
          {field === "status_anomali" ? (
            <select value={nilaiBaru} onChange={(e) => setNilaiBaru(e.target.value)} required>
              <option value="">Pilih...</option>
              <option value="normal">normal</option>
              <option value="perlu_tinjau">perlu_tinjau</option>
            </select>
          ) : (
            <input type="number" value={nilaiBaru} onChange={(e) => setNilaiBaru(e.target.value)} required />
          )}
        </label>
        <label className="lebar-penuh">
          Alasan Perubahan (wajib)
          <input
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="mis. koreksi setelah cek fisik dengan pegawai"
            required
          />
        </label>
        {errorMsg && <p className="pesan-error lebar-penuh">{errorMsg}</p>}
        <button type="submit" className="tombol tombol-primer" disabled={menyimpan}>
          {menyimpan ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>

      <h3>Riwayat Perubahan</h3>
      {audit.length === 0 ? (
        <p className="teks-muted">Belum ada perubahan pada rekap ini.</p>
      ) : (
        <ul className="daftar-audit">
          {audit.map((a) => (
            <li key={a.id}>
              <span className="mono kecil">{new Date(a.waktu).toLocaleString("id-ID")}</span> &middot;{" "}
              <strong>{a.admin_nama}</strong> mengubah <span className="mono">{a.field_diubah}</span>
              {a.tanggal_terkait && (
                <>
                  {" "}
                  (tanggal <span className="mono">{a.tanggal_terkait}</span>)
                </>
              )}{" "}
              dari <span className="mono">{a.nilai_lama}</span> ke <span className="mono">{a.nilai_baru}</span>.
              <div className="teks-muted kecil">Alasan: {a.alasan}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
