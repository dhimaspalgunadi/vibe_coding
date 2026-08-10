import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Peran, Sesi } from "./types";

interface AuthState {
  sesi: Sesi | null;
  memuat: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  perbaruiSesi: (sesi: Sesi) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesi, setSesi] = useState<Sesi | null>(null);
  const [memuat, setMemuat] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(setSesi)
      .catch(() => setSesi(null))
      .finally(() => setMemuat(false));
  }, []);

  async function login(email: string, password: string) {
    const hasil = await api.login(email, password);
    setSesi({ nama: hasil.nama, email, peran: hasil.peran as Peran });
  }

  async function logout() {
    await api.logout();
    setSesi(null);
  }

  function perbaruiSesi(sesiBaru: Sesi) {
    setSesi(sesiBaru);
  }

  return <AuthContext.Provider value={{ sesi, memuat, login, logout, perbaruiSesi }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
