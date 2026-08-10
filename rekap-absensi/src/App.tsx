import type { ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import type { Peran } from "./types";
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./pages/AdminLayout";
import UploadPage from "./pages/UploadPage";
import RekapListPage from "./pages/RekapListPage";
import RekapDetailPage from "./pages/RekapDetailPage";
import AuditLogPage from "./pages/AuditLogPage";
import PimpinanPage from "./pages/PimpinanPage";
import LaporanYayasanListPage from "./pages/LaporanYayasanListPage";
import LaporanYayasanDetailPage from "./pages/LaporanYayasanDetailPage";
import PegawaiPage from "./pages/PegawaiPage";
import ProfilPage from "./pages/ProfilPage";

function Gerbang({ children, peranDiizinkan }: { children: ReactElement; peranDiizinkan: Peran[] }) {
  const { sesi, memuat } = useAuth();
  if (memuat) return <div className="layar-tengah">Memuat...</div>;
  if (!sesi) return <Navigate to="/login" replace />;
  if (!peranDiizinkan.includes(sesi.peran)) {
    return <Navigate to={sesi.peran === "admin" ? "/admin" : "/pimpinan"} replace />;
  }
  return children;
}

function Beranda() {
  const { sesi, memuat } = useAuth();
  if (memuat) return <div className="layar-tengah">Memuat...</div>;
  if (!sesi) return <Navigate to="/login" replace />;
  return <Navigate to={sesi.peran === "admin" ? "/admin" : "/pimpinan"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Beranda />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <Gerbang peranDiizinkan={["admin"]}>
                <AdminLayout />
              </Gerbang>
            }
          >
            <Route index element={<RekapListPage />} />
            <Route path="unggah" element={<UploadPage />} />
            <Route path="rekap/:id" element={<RekapDetailPage />} />
            <Route path="pegawai" element={<PegawaiPage />} />
            <Route path="laporan-yayasan" element={<LaporanYayasanListPage />} />
            <Route path="laporan-yayasan/:id" element={<LaporanYayasanDetailPage />} />
            <Route path="log" element={<AuditLogPage />} />
          </Route>
          <Route
            path="/pimpinan"
            element={
              <Gerbang peranDiizinkan={["admin", "pimpinan"]}>
                <PimpinanPage />
              </Gerbang>
            }
          />
          <Route
            path="/profil"
            element={
              <Gerbang peranDiizinkan={["admin", "pimpinan"]}>
                <ProfilPage />
              </Gerbang>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
