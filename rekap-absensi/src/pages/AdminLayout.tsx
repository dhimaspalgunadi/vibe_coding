import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function AdminLayout() {
  const { sesi, logout } = useAuth();

  return (
    <div className="tata-letak-admin">
      <header className="bilah-atas">
        <span className="judul-app">Rekap Absensi &middot; Admin</span>
        <div className="bilah-atas-kanan">
          <span className="teks-muted">{sesi?.nama}</span>
          <button className="tombol" onClick={logout}>
            Keluar
          </button>
        </div>
      </header>
      <div className="badan-admin">
        <nav className="nav-samping">
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? "aktif" : "")}>
            Rekap Bulanan
          </NavLink>
          <NavLink to="/admin/unggah" className={({ isActive }) => (isActive ? "aktif" : "")}>
            Unggah File
          </NavLink>
          <NavLink to="/admin/laporan-yayasan" className={({ isActive }) => (isActive ? "aktif" : "")}>
            Laporan ke Yayasan
          </NavLink>
          <NavLink to="/admin/log" className={({ isActive }) => (isActive ? "aktif" : "")}>
            Log Perubahan
          </NavLink>
        </nav>
        <main className="konten-admin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
