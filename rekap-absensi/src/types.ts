export type Peran = "admin" | "pimpinan";

export interface Sesi {
  nama: string;
  email: string;
  peran: Peran;
}

export interface UnitKerja {
  id: number;
  cabang: string;
  jenjang: string;
  jam_kerja_acuan: string | null;
}

export interface Periode {
  id: number;
  cabang: string;
  jenjang: string;
  tgl_mulai: string;
  tgl_selesai: string;
  nama_file_asal: string;
  diunggah_pada: string;
}

export interface RekapRow {
  id: number;
  nip: string;
  nama: string;
  cabang: string;
  jenjang: string;
  total_hari: number;
  total_telat_menit: number;
  total_plg_cepat_menit: number;
  total_lembur_menit: number;
  validasi_cocok: boolean;
  status_anomali: "normal" | "perlu_tinjau";
  tgl_mulai: string;
  tgl_selesai: string;
}

export interface DetailHarianRow {
  id: number;
  tanggal: string;
  hari: string;
  libur: boolean;
  jam_kerja: string | null;
  masuk_jadwal: string | null;
  pulang_jadwal: string | null;
  masuk_aktual: string | null;
  pulang_aktual: string | null;
  total_jam_menit: number;
  telat_menit: number;
  plg_cepat_menit: number;
  lembur_menit: number;
  ket_abs_raw: string | null;
  ket_abs_kategori: string | null;
  koreksi_alasan: string | null;
}

export interface AuditRow {
  id: number;
  field_diubah: string;
  nilai_lama: string | null;
  nilai_baru: string | null;
  alasan: string;
  waktu: string;
  admin_nama: string;
  pegawai_nama?: string;
  nip?: string;
  tanggal_terkait?: string | null;
}

export interface HarianUpdateResult {
  ok: boolean;
  harian: { telat: number; plgCepat: number; lembur: number; totalJam: number; masukAktual: string | null; pulangAktual: string | null };
  rekapBulanan: { total_telat: number; total_plg_cepat: number; total_lembur: number; total_jam: number };
}

export interface RekapDetailResult {
  rekap: RekapRow & {
    total_jam_menit: number;
    validasi_catatan: string | null;
    anomali_catatan: string | null;
    nama_file_asal: string;
  };
  harian: DetailHarianRow[];
  audit: AuditRow[];
}

export interface UploadResult {
  unitKerja: { cabang: string; jenjang: string };
  periode: { mulai: string; selesai: string };
  pegawaiDiproses: number;
  validasiCocok: number;
  validasiSelisih: number;
  perluTinjau: number;
}

export interface PeriodeRingkasan {
  tgl_mulai: string;
  tgl_selesai: string;
  jumlah_unit: number;
  terakhir_diunggah: string;
}

export interface RingkasanCabang {
  cabang: string;
  jumlah_pegawai: number;
  rata_telat_menit: number;
  total_lembur_menit: number;
  perlu_tinjau: number;
}

export interface RingkasanUnit {
  cabang: string;
  jenjang: string;
  jumlah_pegawai: number;
  rata_telat_menit: number;
  total_lembur_menit: number;
}

export interface PimpinanSummary {
  total: RingkasanCabang | null;
  perCabang: RingkasanCabang[];
  perUnit: RingkasanUnit[];
}

export interface LaporanYayasanRingkas {
  id: number;
  judul: string;
  cabang: string;
  tgl_mulai: string;
  tgl_selesai: string;
  jumlah_baris: number;
  diperbarui_pada: string;
}

export interface LaporanYayasanHeader {
  id: number;
  judul: string;
  cabang: string;
  tgl_mulai: string;
  tgl_selesai: string;
  keterangan_periode: string | null;
  total_hari_kerja: number | null;
  mengetahui_nama: string | null;
  mengetahui_jabatan: string | null;
  dibuat_oleh_nama: string | null;
  dibuat_oleh_jabatan: string | null;
}

export interface LaporanYayasanBaris {
  id: number;
  laporan_id: number;
  pegawai_id: number | null;
  urutan: number;
  nim: string | null;
  unit: string | null;
  nama: string;
  jabatan: string | null;
  kupon_periode1: number;
  kupon_periode2: number;
  total_kerja_hari: number;
  sakit_hari: number;
  izin_hari: number;
  izin_ket: string | null;
  alpa_hari: number;
  cuti_hari: number;
  cuti_ket: string | null;
  lembur_menit: number;
  lembur_ket: string | null;
  telat_hari: number;
  telat_menit: number;
  telat_ket: string | null;
  izin_telat_hari: number;
  izin_telat_menit: number;
  izin_telat_ket: string | null;
  plg_cepat_hari: number;
  plg_cepat_menit: number;
  plg_cepat_ket: string | null;
  insentif: number;
  agama: string | null;
  tanggal_masuk: string | null;
  catatan: string | null;
}

export interface LaporanYayasanDetailResult {
  laporan: LaporanYayasanHeader;
  baris: LaporanYayasanBaris[];
  audit: AuditRow[];
}

export interface LaporanYayasanGenerateResult extends LaporanYayasanDetailResult {
  ditambahkan: number;
}
