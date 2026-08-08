// Port dari prototipe Python (parse_absensi.py) yang sudah diuji terhadap
// 196 pegawai lintas 5 file laporan asli. Lihat catatan di sana untuk
// alasan tiap keputusan parsing (blok berulang per pegawai, jeda halaman
// cetak yang terselip, baris lanjutan sesi ganda bertanda '*').
import * as XLSX from "xlsx";

export interface HarianRow {
  tanggal: string; // ISO yyyy-mm-dd
  hari: string;
  libur: boolean;
  jamKerja: string | null;
  masukJadwal: string | null;
  pulangJadwal: string | null;
  masukAktual: string | null;
  pulangAktual: string | null;
  totalJamMenit: number;
  telatMenit: number;
  plgCepatMenit: number;
  lemburMenit: number;
  ketAbsRaw: string | null;
  sesiTambahan: number;
}

export interface TotalPegawai {
  totalHari: number;
  totalJamMenit: number;
  totalTelatMenit: number;
  totalPlgCepatMenit: number;
  totalLemburMenit: number;
}

export interface PegawaiBlok {
  nip: string;
  nama: string;
  harian: HarianRow[];
  total: TotalPegawai | null;
}

export interface MetaFile {
  divisi: string | null;
  departemen: string | null;
  periodeMulai: string | null; // dd/mm/yyyy
  periodeSelesai: string | null;
}

export interface HasilValidasi {
  cocok: boolean;
  selisih: Record<string, { dihitung: number; dilaporkan: number }>;
  statusAnomali: "normal" | "perlu_tinjau";
  catatan: string | null;
}

const RE_NIP = /NIP\s*:\s*(\S+)\s+Nama\s*:\s*(.+)/;
const RE_TOTAL_HARI = /Total hari\s*:\s*(\d+)/;
const RE_TANGGAL = /^\d{2}\/\d{2}$/;
const RE_PERIODE = /Periode\s+(\d{2}\/\d{2}\/\d{4})\s+s\/d\s*(\d{2}\/\d{2}\/\d{4})/;
const RE_DURASI = /^(\d+):(\d{2})$/;
const RE_JAM_PREFIX = /^([A-Z])\s+(\d{2}:\d{2})$/;

function cell(row: unknown[], i: number): string {
  const v = row[i];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function durasiKeMenit(s: string): number {
  const m = RE_DURASI.exec(s.trim());
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function pisahPrefixJam(s: string): [string | null, string | null] {
  const v = s.trim();
  if (!v) return [null, null];
  const m = RE_JAM_PREFIX.exec(v);
  if (m) return [m[1], m[2]];
  return [null, v];
}

function isBoilerplate(row: unknown[]): boolean {
  const c0 = cell(row, 0);
  const c1 = cell(row, 1);
  const c2 = cell(row, 2);
  const c5 = cell(row, 5);
  const c6 = cell(row, 6);

  const adaIsi = row.some((v) => String(v ?? "").trim() !== "");
  if (!adaIsi) return true;
  if (c1 === "Tgl" && c2 === "Hari") return true;
  if (c1 === "" && c5 === "Masuk" && c6 === "Pulang") return true;
  if (c0.startsWith("Tgl Cetak")) return true;
  if (c0 === "Laporan Absensi Harian") return true;
  if (c0.startsWith("Periode ")) return true;
  if (c1.startsWith("Divisi :") || c1.startsWith("Departemen :") || c1.startsWith("Seksi :")) return true;
  if (c0.toUpperCase().includes("SAINT JOHN")) return true;
  return false;
}

function tanggalDariDdmm(ddmm: string, tahun: number): string {
  const [d, m] = ddmm.split("/");
  const mm = m.padStart(2, "0");
  const dd = d.padStart(2, "0");
  return `${tahun}-${mm}-${dd}`;
}

export function parseWorkbook(buffer: ArrayBuffer, namaFileAsal: string): { meta: MetaFile; pegawaiList: PegawaiBlok[] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: true }) as unknown[][];

  const meta: MetaFile = { divisi: null, departemen: null, periodeMulai: null, periodeSelesai: null };
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    const c0 = cell(row, 0);
    const c1 = cell(row, 1);
    if (c1.startsWith("Divisi :")) meta.divisi = c1.split(":").slice(1).join(":").trim();
    else if (c1.startsWith("Departemen :")) meta.departemen = c1.split(":").slice(1).join(":").trim();
    const pm = RE_PERIODE.exec(c0);
    if (pm) {
      meta.periodeMulai = pm[1];
      meta.periodeSelesai = pm[2];
    }
  }
  const tahun = meta.periodeMulai ? parseInt(meta.periodeMulai.split("/")[2], 10) : new Date().getFullYear();

  const pegawaiList: PegawaiBlok[] = [];
  let current: PegawaiBlok | null = null;

  for (const row of rows) {
    if (isBoilerplate(row)) continue;
    const c1 = cell(row, 1);

    const nipMatch = RE_NIP.exec(c1);
    if (nipMatch) {
      if (current) pegawaiList.push(current);
      current = { nip: nipMatch[1].trim(), nama: nipMatch[2].trim(), harian: [], total: null };
      continue;
    }

    const totalMatch = RE_TOTAL_HARI.exec(c1);
    if (totalMatch && current) {
      current.total = {
        totalHari: parseInt(totalMatch[1], 10),
        totalJamMenit: durasiKeMenit(cell(row, 11)),
        totalTelatMenit: durasiKeMenit(cell(row, 12)),
        totalPlgCepatMenit: durasiKeMenit(cell(row, 13)),
        totalLemburMenit: durasiKeMenit(cell(row, 14)),
      };
      continue;
    }

    if (RE_TANGGAL.test(c1) && current) {
      const tanggal = tanggalDariDdmm(c1, tahun);
      const liburFlag = cell(row, 0) === "#";
      const [, masukJadwal] = pisahPrefixJam(cell(row, 5));
      const [, pulangJadwal] = pisahPrefixJam(cell(row, 6));
      const [, masukAktual] = pisahPrefixJam(cell(row, 7));
      const [, pulangAktual] = pisahPrefixJam(cell(row, 10));
      const ketAbs = cell(row, 15);

      current.harian.push({
        tanggal,
        hari: cell(row, 2),
        libur: liburFlag,
        jamKerja: cell(row, 4) || null,
        masukJadwal,
        pulangJadwal,
        masukAktual,
        pulangAktual,
        totalJamMenit: durasiKeMenit(cell(row, 11)),
        telatMenit: durasiKeMenit(cell(row, 12)),
        plgCepatMenit: durasiKeMenit(cell(row, 13)),
        lemburMenit: durasiKeMenit(cell(row, 14)),
        ketAbsRaw: ketAbs || null,
        sesiTambahan: 0,
      });
      continue;
    }

    // Baris lanjutan: tanggal kosong tapi ada data (sesi masuk/pulang kedua
    // di hari yang sama, mis. ditandai '*'). Gabungkan ke hari terakhir.
    if (c1 === "" && current && current.harian.length > 0) {
      const adaData = [7, 10, 11, 12, 13, 14].some((i) => cell(row, i) !== "");
      if (adaData) {
        const hariTerakhir = current.harian[current.harian.length - 1];
        const [, pulangLanjutan] = pisahPrefixJam(cell(row, 10));
        if (pulangLanjutan) hariTerakhir.pulangAktual = pulangLanjutan;
        hariTerakhir.totalJamMenit += durasiKeMenit(cell(row, 11));
        hariTerakhir.telatMenit += durasiKeMenit(cell(row, 12));
        hariTerakhir.plgCepatMenit += durasiKeMenit(cell(row, 13));
        hariTerakhir.lemburMenit += durasiKeMenit(cell(row, 14));
        hariTerakhir.sesiTambahan += 1;
        continue;
      }
    }
  }
  if (current) pegawaiList.push(current);

  return { meta, pegawaiList };
}

export function validasiDanAnomali(pegawai: PegawaiBlok): HasilValidasi {
  const hasil: HasilValidasi = { cocok: true, selisih: {}, statusAnomali: "normal", catatan: null };

  if (!pegawai.total) {
    hasil.cocok = false;
    hasil.catatan = "Baris 'Total hari' tidak ditemukan untuk pegawai ini.";
    return hasil;
  }

  // total_hari TIDAK direkonstruksi ulang -- lihat catatan di parse_absensi.py:
  // semantik "hari terhitung" mesin sumber punya pengecualian yang tidak
  // perlu dibongkar ulang. Hanya telat/plg_cepat/lembur yang direkonsiliasi.
  const sumTelat = pegawai.harian.reduce((s, h) => s + h.telatMenit, 0);
  const sumPlgCepat = pegawai.harian.reduce((s, h) => s + h.plgCepatMenit, 0);
  const sumLembur = pegawai.harian.reduce((s, h) => s + h.lemburMenit, 0);

  const total = pegawai.total;
  const pasangan: [string, number, number][] = [
    ["telat", sumTelat, total.totalTelatMenit],
    ["plg_cepat", sumPlgCepat, total.totalPlgCepatMenit],
    ["lembur", sumLembur, total.totalLemburMenit],
  ];
  for (const [label, dihitung, dilaporkan] of pasangan) {
    if (dihitung !== dilaporkan) {
      hasil.cocok = false;
      hasil.selisih[label] = { dihitung, dilaporkan };
    }
  }

  const tanggalBersinyal = pegawai.harian
    .filter((h) => h.ketAbsRaw || h.masukAktual || h.pulangAktual)
    .map((h) => new Date(h.tanggal + "T00:00:00Z").getTime())
    .sort((a, b) => a - b);
  const semuaTanggal = pegawai.harian.map((h) => new Date(h.tanggal + "T00:00:00Z").getTime()).sort((a, b) => a - b);

  if (semuaTanggal.length > 0) {
    const DAY = 86400000;
    const batas = [semuaTanggal[0] - DAY, ...tanggalBersinyal, semuaTanggal[semuaTanggal.length - 1] + DAY];
    let celahTerpanjang = 0;
    for (let i = 0; i < batas.length - 1; i++) {
      const gapHari = Math.round((batas[i + 1] - batas[i]) / DAY) - 1;
      if (gapHari > celahTerpanjang) celahTerpanjang = gapHari;
    }
    if (celahTerpanjang > 14) {
      hasil.statusAnomali = "perlu_tinjau";
      hasil.catatan = `Tidak ada catatan kehadiran selama ${celahTerpanjang} hari berturut-turut.`;
    }
  }

  return hasil;
}
