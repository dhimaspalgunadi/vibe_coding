import type {
  AuditRow,
  HarianUpdateResult,
  LaporanYayasanBaris,
  LaporanYayasanDetailResult,
  LaporanYayasanGenerateResult,
  LaporanYayasanHeader,
  LaporanYayasanRingkas,
  Periode,
  PeriodeRingkasan,
  PimpinanSummary,
  RekapDetailResult,
  RekapRow,
  Sesi,
  UnitKerja,
  UploadResult,
} from "./types";

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body && !isForm ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Terjadi kesalahan (${res.status}).` }));
    throw new Error(data.error ?? `Terjadi kesalahan (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    req<{ nama: string; peran: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => req<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  me: () => req<Sesi>("/api/auth/me"),
  unitKerja: () => req<{ unitKerja: UnitKerja[] }>("/api/unit-kerja"),
  periode: () => req<{ periode: Periode[] }>("/api/periode"),
  upload: (form: FormData) => req<UploadResult>("/api/upload", { method: "POST", body: form }),
  rekapList: (params: { periodeId?: number; q?: string }) => {
    const usp = new URLSearchParams();
    if (params.periodeId) usp.set("periodeId", String(params.periodeId));
    if (params.q) usp.set("q", params.q);
    return req<{ rekap: RekapRow[] }>(`/api/rekap?${usp.toString()}`);
  },
  rekapDetail: (id: number) => req<RekapDetailResult>(`/api/rekap-detail?id=${id}`),
  rekapUpdate: (id: number, field: string, nilaiBaru: string | number, alasan: string) =>
    req<{ ok: boolean }>(`/api/rekap-detail?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, nilaiBaru, alasan }),
    }),
  auditLog: () => req<{ log: AuditRow[] }>("/api/audit-log"),
  harianUpdate: (id: number, masukAktual: string | null, pulangAktual: string | null, alasan: string) =>
    req<HarianUpdateResult>(`/api/harian-update?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ masukAktual, pulangAktual, alasan }),
    }),
  periodeRingkasan: () => req<{ periode: PeriodeRingkasan[] }>("/api/periode-ringkasan"),
  pimpinanSummary: (tglMulai: string, tglSelesai: string) =>
    req<PimpinanSummary>(`/api/pimpinan-summary?tglMulai=${tglMulai}&tglSelesai=${tglSelesai}`),

  laporanYayasanList: () => req<{ laporan: LaporanYayasanRingkas[] }>("/api/laporan-yayasan"),
  laporanYayasanGenerate: (tglMulai: string, tglSelesai: string, cabang: string) =>
    req<LaporanYayasanGenerateResult>("/api/laporan-yayasan-generate", {
      method: "POST",
      body: JSON.stringify({ tglMulai, tglSelesai, cabang }),
    }),
  laporanYayasanDetail: (id: number) => req<LaporanYayasanDetailResult>(`/api/laporan-yayasan-detail?id=${id}`),
  laporanYayasanUpdateHeader: (id: number, field: string, nilaiBaru: string | number | null) =>
    req<{ laporan: LaporanYayasanHeader }>(`/api/laporan-yayasan-detail?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ field, nilaiBaru }),
    }),
  laporanYayasanHapus: (id: number) => req<{ ok: boolean }>(`/api/laporan-yayasan-detail?id=${id}`, { method: "DELETE" }),
  laporanYayasanTambahBaris: (laporanId: number, data: { nim?: string; unit?: string; nama: string; jabatan?: string }) =>
    req<{ baris: LaporanYayasanBaris }>("/api/laporan-yayasan-baris", {
      method: "POST",
      body: JSON.stringify({ laporanId, ...data }),
    }),
  laporanYayasanUpdateBaris: (id: number, perubahan: Record<string, unknown>, alasan: string) =>
    req<{ ok: boolean; baris: LaporanYayasanBaris }>(`/api/laporan-yayasan-baris?id=${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...perubahan, alasan }),
    }),
  laporanYayasanHapusBaris: (id: number, alasan: string) =>
    req<{ ok: boolean }>(`/api/laporan-yayasan-baris?id=${id}`, {
      method: "DELETE",
      body: JSON.stringify({ alasan }),
    }),
  laporanYayasanExportUrl: (id: number) => `/api/laporan-yayasan-export?id=${id}`,
};
