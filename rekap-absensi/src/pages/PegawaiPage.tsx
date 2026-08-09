import { Fragment, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import type { PegawaiRow, UnitKerja } from "../types";

function tglSaja(s: string): string {
  return s.slice(0, 10);
}

export default function PegawaiPage() {
  const [pegawai, setPegawai] = useState<PegawaiRow[]>([]);
  const [unitKerja, setUnitKerja] = useState<UnitKerja[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tambahBuka, setTambahBuka] = useState(false);
  const [tambahNip, setTambahNip] = useState("");
  const [tambahNama, setTambahNama] = useState("");
  const [tambahUnitKerjaId, setTambahUnitKerjaId] = useState("");
  const [tambahJabatan, setTambahJabatan] = useState("");
  const [tambahAgama, setTambahAgama] = useState("");
  const [tambahTanggalMasuk, setTambahTanggalMasuk] = useState("");
  const [menambah, setMenambah] = useState(false);
  const [errorTambah, setErrorTambah] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editNilai, setEditNilai] = useState<Record<string, string>>({});
  const [editStatusAktif, setEditStatusAktif] = useState(true);
  const [editAlasan, setEditAlasan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const [menghapusId, setMenghapusId] = useState<number | null>(null);

  function muat() {
    setLoading(true);
    setErrorMsg(null);
    api
      .pegawaiList(q)
      .then((r) => setPegawai(r.pegawai))
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : "Gagal memuat data pegawai."))
      .finally(() => setLoading(false));
  }

  useEffect(muat, [q]);

  useEffect(() => {
    api
      .unitKerja()
      .then((r) => setUnitKerja(r.unitKerja))
      .catch(() => {});
  }, []);

  async function tambahPegawai(e: FormEvent) {
    e.preventDefault();
    if (!tambahNip.trim() || !tambahNama.trim() || !tambahUnitKerjaId) return;
    setMenambah(true);
    setErrorTambah(null);
    try {
      await api.pegawaiTambah({
        nip: tambahNip.trim(),
        nama: tambahNama.trim(),
        unit_kerja_id: Number(tambahUnitKerjaId),
        jabatan: tambahJabatan.trim() || undefined,
        agama: tambahAgama.trim() || undefined,
        tanggal_masuk: tambahTanggalMasuk || undefined,
      });
      setTambahNip("");
      setTambahNama("");
      setTambahUnitKerjaId("");
      setTambahJabatan("");
      setTambahAgama("");
      setTambahTanggalMasuk("");
      setTambahBuka(false);
      muat();
    } catch (err) {
      setErrorTambah(err instanceof Error ? err.message : "Gagal menambah pegawai.");
    } finally {
      setMenambah(false);
    }
  }

  function mulaiKoreksi(p: PegawaiRow) {
    setEditId(p.id);
    setEditNilai({
      nama: p.nama,
      unit_kerja_id: String(p.unit_kerja_id),
      jabatan: p.jabatan ?? "",
      agama: p.agama ?? "",
      tanggal_masuk: p.tanggal_masuk ? tglSaja(p.tanggal_masuk) : "",
    });
    setEditStatusAktif(p.status_aktif);
    setEditAlasan("");
    setErrorEdit(null);
  }

  async function simpanKoreksi(e: FormEvent) {
    e.preventDefault();
    if (!editId || !editAlasan.trim()) return;
    setMenyimpan(true);
    setErrorEdit(null);
    try {
      await api.pegawaiUpdate(editId, { ...editNilai, status_aktif: editStatusAktif }, editAlasan.trim());
      setEditId(null);
      muat();
    } catch (err) {
      setErrorEdit(err instanceof Error ? err.message : "Gagal menyimpan koreksi.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapusPegawai(p: PegawaiRow) {
    const alasan = window.prompt(`Alasan menghapus pegawai "${p.nama}" (${p.nip})?`);
    if (!alasan || !alasan.trim()) return;
    setMenghapusId(p.id);
    try {
      await api.pegawaiHapus(p.id, alasan.trim());
      setPegawai((rows) => rows.filter((r) => r.id !== p.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menghapus pegawai.");
    } finally {
      setMenghapusId(null);
    }
  }

  return (
    <div>
      <h2>Data Pegawai</h2>
      <p className="teks-muted">
        Kelola Agama dan Tanggal Masuk guru &amp; staf di sini -- data ini tidak ada di file mesin absensi, jadi
        diisi manual dan dipakai lagi saat menyusun Laporan ke Yayasan.
      </p>

      <div className="bilah-filter">
        <input placeholder="Cari nama atau NIP..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="tombol" onClick={() => setTambahBuka((v) => !v)}>
          {tambahBuka ? "Batal Tambah" : "Tambah Pegawai"}
        </button>
      </div>

      {tambahBuka && (
        <form className="kartu formulir-edit" onSubmit={tambahPegawai}>
          <label>
            NIP <input value={tambahNip} onChange={(e) => setTambahNip(e.target.value)} required autoFocus />
          </label>
          <label>
            Nama <input value={tambahNama} onChange={(e) => setTambahNama(e.target.value)} required />
          </label>
          <label>
            Unit Kerja
            <select value={tambahUnitKerjaId} onChange={(e) => setTambahUnitKerjaId(e.target.value)} required>
              <option value="">Pilih...</option>
              {unitKerja.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.cabang} / {u.jenjang}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jabatan <input value={tambahJabatan} onChange={(e) => setTambahJabatan(e.target.value)} />
          </label>
          <label>
            Agama <input value={tambahAgama} onChange={(e) => setTambahAgama(e.target.value)} />
          </label>
          <label>
            Tanggal Masuk
            <input type="date" value={tambahTanggalMasuk} onChange={(e) => setTambahTanggalMasuk(e.target.value)} />
          </label>
          {errorTambah && <p className="pesan-error lebar-penuh">{errorTambah}</p>}
          <button type="submit" className="tombol tombol-primer" disabled={menambah}>
            {menambah ? "Menyimpan..." : "Simpan Pegawai Baru"}
          </button>
        </form>
      )}

      {errorMsg && <p className="pesan-error">{errorMsg}</p>}

      <div className="pembungkus-tabel">
        <table className="tabel">
          <thead>
            <tr>
              <th>NIP</th>
              <th>Nama</th>
              <th>Unit</th>
              <th>Jabatan</th>
              <th>Agama</th>
              <th>Tanggal Masuk</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pegawai.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td className="mono">{p.nip}</td>
                  <td>{p.nama}</td>
                  <td>
                    {p.cabang} / {p.jenjang}
                  </td>
                  <td>{p.jabatan ?? "-"}</td>
                  <td>{p.agama ?? "-"}</td>
                  <td className="mono">{p.tanggal_masuk ? tglSaja(p.tanggal_masuk) : "-"}</td>
                  <td>
                    {p.status_aktif ? (
                      <span className="chip chip-baik">aktif</span>
                    ) : (
                      <span className="chip chip-warn">nonaktif</span>
                    )}
                  </td>
                  <td>
                    <button type="button" className="tombol" onClick={() => (editId === p.id ? setEditId(null) : mulaiKoreksi(p))}>
                      {editId === p.id ? "Batal" : "Koreksi"}
                    </button>{" "}
                    <button type="button" className="tombol" disabled={menghapusId === p.id} onClick={() => hapusPegawai(p)}>
                      {menghapusId === p.id ? "Menghapus..." : "Hapus"}
                    </button>
                  </td>
                </tr>
                {editId === p.id && (
                  <tr>
                    <td colSpan={8}>
                      <form className="baris-koreksi baris-koreksi-lebar" onSubmit={simpanKoreksi}>
                        <label>
                          Nama <input value={editNilai.nama ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, nama: e.target.value }))} />
                        </label>
                        <label>
                          Unit Kerja
                          <select
                            value={editNilai.unit_kerja_id ?? ""}
                            onChange={(e) => setEditNilai((s) => ({ ...s, unit_kerja_id: e.target.value }))}
                          >
                            {unitKerja.map((u) => (
                              <option value={u.id} key={u.id}>
                                {u.cabang} / {u.jenjang}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Jabatan <input value={editNilai.jabatan ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, jabatan: e.target.value }))} />
                        </label>
                        <label>
                          Agama <input value={editNilai.agama ?? ""} onChange={(e) => setEditNilai((s) => ({ ...s, agama: e.target.value }))} />
                        </label>
                        <label>
                          Tanggal Masuk
                          <input
                            type="date"
                            value={editNilai.tanggal_masuk ?? ""}
                            onChange={(e) => setEditNilai((s) => ({ ...s, tanggal_masuk: e.target.value }))}
                          />
                        </label>
                        <label>
                          Status
                          <select value={editStatusAktif ? "1" : "0"} onChange={(e) => setEditStatusAktif(e.target.value === "1")}>
                            <option value="1">Aktif</option>
                            <option value="0">Nonaktif</option>
                          </select>
                        </label>
                        <label className="lebar-penuh">
                          Alasan koreksi (wajib)
                          <input
                            value={editAlasan}
                            onChange={(e) => setEditAlasan(e.target.value)}
                            placeholder="mis. update data dari HRD"
                            required
                            autoFocus
                          />
                        </label>
                        {errorEdit && <p className="pesan-error lebar-penuh">{errorEdit}</p>}
                        <button type="submit" className="tombol tombol-primer" disabled={menyimpan}>
                          {menyimpan ? "Menyimpan..." : "Simpan Koreksi"}
                        </button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!loading && pegawai.length === 0 && (
              <tr>
                <td colSpan={8} className="teks-muted">
                  Tidak ada data pegawai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
