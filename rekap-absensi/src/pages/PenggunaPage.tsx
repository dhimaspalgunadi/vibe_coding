import { Fragment, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import type { Peran, PenggunaAuditRow, PenggunaRow } from "../types";

export default function PenggunaPage() {
  const { sesi } = useAuth();
  const [pengguna, setPengguna] = useState<PenggunaRow[]>([]);
  const [audit, setAudit] = useState<PenggunaAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tambahBuka, setTambahBuka] = useState(false);
  const [tambahNama, setTambahNama] = useState("");
  const [tambahEmail, setTambahEmail] = useState("");
  const [tambahPassword, setTambahPassword] = useState("");
  const [tambahPeran, setTambahPeran] = useState<Peran>("pimpinan");
  const [menambah, setMenambah] = useState(false);
  const [errorTambah, setErrorTambah] = useState<string | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editNama, setEditNama] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPeran, setEditPeran] = useState<Peran>("pimpinan");
  const [editStatusAktif, setEditStatusAktif] = useState(true);
  const [editPasswordBaru, setEditPasswordBaru] = useState("");
  const [editAlasan, setEditAlasan] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const [menghapusId, setMenghapusId] = useState<number | null>(null);

  function muat() {
    setLoading(true);
    setErrorMsg(null);
    api
      .penggunaList()
      .then((r) => {
        setPengguna(r.pengguna);
        setAudit(r.audit);
      })
      .catch((e) => setErrorMsg(e instanceof Error ? e.message : "Gagal memuat data pengguna."))
      .finally(() => setLoading(false));
  }

  useEffect(muat, []);

  async function tambahPengguna(e: FormEvent) {
    e.preventDefault();
    if (!tambahNama.trim() || !tambahEmail.trim() || tambahPassword.length < 8) return;
    setMenambah(true);
    setErrorTambah(null);
    try {
      await api.penggunaTambah({
        nama: tambahNama.trim(),
        email: tambahEmail.trim(),
        password: tambahPassword,
        peran: tambahPeran,
      });
      setTambahNama("");
      setTambahEmail("");
      setTambahPassword("");
      setTambahPeran("pimpinan");
      setTambahBuka(false);
      muat();
    } catch (err) {
      setErrorTambah(err instanceof Error ? err.message : "Gagal menambah akun.");
    } finally {
      setMenambah(false);
    }
  }

  function mulaiKoreksi(p: PenggunaRow) {
    setEditId(p.id);
    setEditNama(p.nama);
    setEditEmail(p.email);
    setEditPeran(p.peran);
    setEditStatusAktif(p.status_aktif);
    setEditPasswordBaru("");
    setEditAlasan("");
    setErrorEdit(null);
  }

  async function simpanKoreksi(e: FormEvent) {
    e.preventDefault();
    if (!editId || !editAlasan.trim()) return;
    setMenyimpan(true);
    setErrorEdit(null);
    try {
      const perubahan: Record<string, unknown> = {
        nama: editNama.trim(),
        email: editEmail.trim(),
        peran: editPeran,
        status_aktif: editStatusAktif,
      };
      if (editPasswordBaru.trim()) perubahan.passwordBaru = editPasswordBaru.trim();
      await api.penggunaUpdate(editId, perubahan, editAlasan.trim());
      setEditId(null);
      muat();
    } catch (err) {
      setErrorEdit(err instanceof Error ? err.message : "Gagal menyimpan koreksi.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapusPengguna(p: PenggunaRow) {
    const alasan = window.prompt(`Alasan menghapus akun "${p.nama}" (${p.email})?`);
    if (!alasan || !alasan.trim()) return;
    setMenghapusId(p.id);
    try {
      await api.penggunaHapus(p.id, alasan.trim());
      setPengguna((rows) => rows.filter((r) => r.id !== p.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Gagal menghapus akun.");
    } finally {
      setMenghapusId(null);
    }
  }

  const emailSendiri = sesi?.email?.toLowerCase();

  return (
    <div>
      <h2>Manajemen User</h2>
      <p className="teks-muted">
        Kelola akun login (Admin &amp; Pimpinan) yang bisa mengakses aplikasi ini -- tambah akun baru, ubah
        email/peran/status, atau atur ulang passwordnya.
      </p>

      <div className="bilah-filter">
        <button type="button" className="tombol" onClick={() => setTambahBuka((v) => !v)}>
          {tambahBuka ? "Batal Tambah" : "Tambah User"}
        </button>
      </div>

      {tambahBuka && (
        <form className="kartu formulir-edit" onSubmit={tambahPengguna}>
          <label>
            Nama <input value={tambahNama} onChange={(e) => setTambahNama(e.target.value)} required autoFocus />
          </label>
          <label>
            Email
            <input type="email" value={tambahEmail} onChange={(e) => setTambahEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={tambahPassword}
              onChange={(e) => setTambahPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            Peran
            <select value={tambahPeran} onChange={(e) => setTambahPeran(e.target.value as Peran)}>
              <option value="admin">Admin</option>
              <option value="pimpinan">Pimpinan</option>
            </select>
          </label>
          {errorTambah && <p className="pesan-error lebar-penuh">{errorTambah}</p>}
          <button type="submit" className="tombol tombol-primer" disabled={menambah}>
            {menambah ? "Menyimpan..." : "Simpan User Baru"}
          </button>
        </form>
      )}

      {errorMsg && <p className="pesan-error">{errorMsg}</p>}

      <div className="pembungkus-tabel">
        <table className="tabel">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Status</th>
              <th>Dibuat</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {pengguna.map((p) => {
              const iniAkunSendiri = p.email.toLowerCase() === emailSendiri;
              return (
                <Fragment key={p.id}>
                  <tr>
                    <td>
                      {p.nama} {iniAkunSendiri && <span className="teks-muted kecil">(Anda)</span>}
                    </td>
                    <td className="mono">{p.email}</td>
                    <td>{p.peran}</td>
                    <td>
                      {p.status_aktif ? (
                        <span className="chip chip-baik">aktif</span>
                      ) : (
                        <span className="chip chip-warn">nonaktif</span>
                      )}
                    </td>
                    <td className="teks-muted kecil">{new Date(p.dibuat_pada).toLocaleDateString("id-ID")}</td>
                    <td>
                      <button
                        type="button"
                        className="tombol"
                        onClick={() => (editId === p.id ? setEditId(null) : mulaiKoreksi(p))}
                      >
                        {editId === p.id ? "Batal" : "Koreksi"}
                      </button>{" "}
                      <button
                        type="button"
                        className="tombol"
                        disabled={menghapusId === p.id || iniAkunSendiri}
                        title={iniAkunSendiri ? "Tidak bisa menghapus akun sendiri" : undefined}
                        onClick={() => hapusPengguna(p)}
                      >
                        {menghapusId === p.id ? "Menghapus..." : "Hapus"}
                      </button>
                    </td>
                  </tr>
                  {editId === p.id && (
                    <tr>
                      <td colSpan={6}>
                        <form className="baris-koreksi baris-koreksi-lebar" onSubmit={simpanKoreksi}>
                          <label>
                            Nama <input value={editNama} onChange={(e) => setEditNama(e.target.value)} required />
                          </label>
                          <label>
                            Email
                            <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
                          </label>
                          <label>
                            Peran
                            <select
                              value={editPeran}
                              onChange={(e) => setEditPeran(e.target.value as Peran)}
                              disabled={iniAkunSendiri}
                            >
                              <option value="admin">Admin</option>
                              <option value="pimpinan">Pimpinan</option>
                            </select>
                          </label>
                          <label>
                            Status
                            <select
                              value={editStatusAktif ? "1" : "0"}
                              onChange={(e) => setEditStatusAktif(e.target.value === "1")}
                              disabled={iniAkunSendiri}
                            >
                              <option value="1">Aktif</option>
                              <option value="0">Nonaktif</option>
                            </select>
                          </label>
                          <label>
                            Password Baru (opsional)
                            <input
                              type="password"
                              value={editPasswordBaru}
                              onChange={(e) => setEditPasswordBaru(e.target.value)}
                              placeholder="kosongkan bila tidak diubah"
                              minLength={8}
                              autoComplete="new-password"
                            />
                          </label>
                          <label className="lebar-penuh">
                            Alasan koreksi (wajib)
                            <input
                              value={editAlasan}
                              onChange={(e) => setEditAlasan(e.target.value)}
                              required
                              placeholder="mis. reset password atas permintaan pengguna"
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
              );
            })}
            {!loading && pengguna.length === 0 && (
              <tr>
                <td colSpan={6} className="teks-muted">
                  Tidak ada data pengguna.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>Riwayat Perubahan</h3>
      {audit.length === 0 ? (
        <p className="teks-muted">Belum ada perubahan akun tercatat.</p>
      ) : (
        <ul className="daftar-audit">
          {audit.map((a) => (
            <li key={a.id}>
              <span className="mono kecil">{new Date(a.waktu).toLocaleString("id-ID")}</span> &middot;{" "}
              <strong>{a.admin_nama}</strong>{" "}
              {a.field_diubah === "pengguna_ditambahkan" && (
                <>
                  menambahkan akun <span className="mono">{a.target_nama ?? a.nilai_baru}</span>.
                </>
              )}
              {a.field_diubah === "pengguna_dihapus" && (
                <>
                  menghapus akun <span className="mono">{a.nilai_lama}</span>.
                </>
              )}
              {a.field_diubah !== "pengguna_ditambahkan" && a.field_diubah !== "pengguna_dihapus" && (
                <>
                  mengubah <span className="mono">{a.field_diubah}</span>
                  {a.target_nama && (
                    <>
                      {" "}
                      milik <span className="mono">{a.target_nama}</span>
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
