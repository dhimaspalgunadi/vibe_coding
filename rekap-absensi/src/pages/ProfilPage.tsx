import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function ProfilPage() {
  const { sesi, logout, perbaruiSesi } = useAuth();

  const [nama, setNama] = useState(sesi?.nama ?? "");
  const [menyimpanNama, setMenyimpanNama] = useState(false);
  const [errorNama, setErrorNama] = useState<string | null>(null);
  const [suksesNama, setSuksesNama] = useState(false);

  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [passwordKonfirmasi, setPasswordKonfirmasi] = useState("");
  const [menyimpanPassword, setMenyimpanPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [suksesPassword, setSuksesPassword] = useState(false);

  async function simpanNama(e: FormEvent) {
    e.preventDefault();
    if (!nama.trim()) return;
    setMenyimpanNama(true);
    setErrorNama(null);
    setSuksesNama(false);
    try {
      const hasil = await api.profilUpdate(nama.trim());
      perbaruiSesi(hasil);
      setSuksesNama(true);
    } catch (err) {
      setErrorNama(err instanceof Error ? err.message : "Gagal menyimpan nama.");
    } finally {
      setMenyimpanNama(false);
    }
  }

  async function simpanPassword(e: FormEvent) {
    e.preventDefault();
    setErrorPassword(null);
    setSuksesPassword(false);
    if (passwordBaru !== passwordKonfirmasi) {
      setErrorPassword("Konfirmasi password baru tidak sama dengan password baru.");
      return;
    }
    setMenyimpanPassword(true);
    try {
      await api.passwordUbah(passwordLama, passwordBaru);
      setPasswordLama("");
      setPasswordBaru("");
      setPasswordKonfirmasi("");
      setSuksesPassword(true);
    } catch (err) {
      setErrorPassword(err instanceof Error ? err.message : "Gagal mengubah password.");
    } finally {
      setMenyimpanPassword(false);
    }
  }

  const tautanKembali = sesi?.peran === "admin" ? "/admin" : "/pimpinan";

  return (
    <div className="tata-letak-admin">
      <header className="bilah-atas">
        <span className="judul-app">Profil Saya</span>
        <div className="bilah-atas-kanan">
          <Link to={tautanKembali} className="tombol">
            Kembali
          </Link>
          <button className="tombol" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>
      <main className="konten-admin">
        <div className="kartu">
          <h3>Informasi Akun</h3>
          <p className="teks-muted">
            Email: <strong>{sesi?.email}</strong> &middot; Peran: <strong>{sesi?.peran}</strong>
          </p>
          <form className="formulir-edit" onSubmit={simpanNama}>
            <label>
              Nama
              <input value={nama} onChange={(e) => setNama(e.target.value)} required />
            </label>
            {errorNama && <p className="pesan-error lebar-penuh">{errorNama}</p>}
            {suksesNama && <p className="teks-muted lebar-penuh">Nama berhasil diperbarui.</p>}
            <button type="submit" className="tombol tombol-primer" disabled={menyimpanNama}>
              {menyimpanNama ? "Menyimpan..." : "Simpan Nama"}
            </button>
          </form>
        </div>

        <div className="kartu">
          <h3>Ganti Password</h3>
          <form className="formulir-edit" onSubmit={simpanPassword}>
            <label>
              Password Lama
              <input
                type="password"
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            <label>
              Password Baru
              <input
                type="password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <label>
              Konfirmasi Password Baru
              <input
                type="password"
                value={passwordKonfirmasi}
                onChange={(e) => setPasswordKonfirmasi(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            {errorPassword && <p className="pesan-error lebar-penuh">{errorPassword}</p>}
            {suksesPassword && <p className="teks-muted lebar-penuh">Password berhasil diubah.</p>}
            <button type="submit" className="tombol tombol-primer" disabled={menyimpanPassword}>
              {menyimpanPassword ? "Menyimpan..." : "Ubah Password"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
