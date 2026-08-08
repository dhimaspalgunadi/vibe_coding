import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { UnitKerja, UploadResult } from "../types";

export default function UploadPage() {
  const [unitKerja, setUnitKerja] = useState<UnitKerja[]>([]);
  const [cabang, setCabang] = useState("");
  const [jenjang, setJenjang] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasil, setHasil] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .unitKerja()
      .then((r) => setUnitKerja(r.unitKerja))
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || !cabang.trim() || !jenjang.trim()) return;
    setLoading(true);
    setError(null);
    setHasil(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("cabang", cabang.trim());
      form.append("jenjang", jenjang.trim());
      const res = await api.upload(form);
      setHasil(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengunggah.");
    } finally {
      setLoading(false);
    }
  }

  const cabangUnik = Array.from(new Set(unitKerja.map((u) => u.cabang)));
  const jenjangUnik = Array.from(new Set(unitKerja.map((u) => u.jenjang)));

  return (
    <div>
      <h2>Unggah Laporan Absensi</h2>
      <p className="teks-muted">
        Satu file = satu cabang &times; satu jenjang (format sama seperti export mesin absensi). Cabang
        dan jenjang dikonfirmasi di sini sebagai penjaga bila nama file keliru; periode dan data pegawai
        dibaca otomatis dari isi file. Pegawai shift khusus (satpam, cleaning service, dll.) tidak
        termasuk cakupan sistem ini.
      </p>
      <form className="kartu formulir-unggah" onSubmit={submit}>
        <label>
          Cabang
          <input
            list="daftar-cabang"
            value={cabang}
            onChange={(e) => setCabang(e.target.value)}
            placeholder="mis. SAINT JOHN BSD"
            required
          />
          <datalist id="daftar-cabang">
            {cabangUnik.map((c) => (
              <option value={c} key={c} />
            ))}
          </datalist>
        </label>
        <label>
          Jenjang
          <input
            list="daftar-jenjang"
            value={jenjang}
            onChange={(e) => setJenjang(e.target.value)}
            placeholder="mis. SHS, PRIMARY, TK Icon"
            required
          />
          <datalist id="daftar-jenjang">
            {jenjangUnik.map((j) => (
              <option value={j} key={j} />
            ))}
          </datalist>
        </label>
        <label>
          File (.xls)
          <input type="file" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </label>
        {error && <p className="pesan-error">{error}</p>}
        <button type="submit" className="tombol tombol-primer" disabled={loading}>
          {loading ? "Memproses..." : "Unggah & Proses"}
        </button>
      </form>

      {hasil && (
        <div className="kartu hasil-unggah">
          <h3>Berhasil diproses</h3>
          <dl className="daftar-hasil">
            <div>
              <dt>Unit kerja</dt>
              <dd>
                {hasil.unitKerja.cabang} &middot; {hasil.unitKerja.jenjang}
              </dd>
            </div>
            <div>
              <dt>Periode</dt>
              <dd>
                {hasil.periode.mulai} s/d {hasil.periode.selesai}
              </dd>
            </div>
            <div>
              <dt>Pegawai diproses</dt>
              <dd>{hasil.pegawaiDiproses}</dd>
            </div>
            <div>
              <dt>Validasi cocok</dt>
              <dd>
                {hasil.validasiCocok} dari {hasil.pegawaiDiproses}
                {hasil.validasiSelisih > 0 && (
                  <span className="chip chip-warn" style={{ marginLeft: "0.5rem" }}>
                    {hasil.validasiSelisih} selisih
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>Perlu ditinjau</dt>
              <dd>{hasil.perluTinjau}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
