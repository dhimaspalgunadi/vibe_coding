import type { Config } from "@netlify/functions";
import ExcelJS from "exceljs";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

const KOLOM = 28; // A..AB

function fmtTanggal(v: unknown): string {
  if (!v) return "";
  const s = typeof v === "string" ? v : (v as Date).toISOString();
  const [y, m, d] = s.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtJam(menit: number): string {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  return `${jam}j ${sisa}m`;
}

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin", "pimpinan"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const database = db();
  const laporanRows = await database.sql`SELECT * FROM laporan_yayasan WHERE id = ${id}`;
  const laporan = laporanRows[0] as Record<string, unknown> | undefined;
  if (!laporan) return json({ error: "Laporan tidak ditemukan." }, 404);

  const baris = (await database.sql`
    SELECT * FROM laporan_yayasan_baris WHERE laporan_id = ${id} ORDER BY urutan, nama
  `) as Record<string, unknown>[];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Perfect Attendance", { pageSetup: { orientation: "landscape", fitToPage: true } });
  ws.properties.defaultRowHeight = 16;

  const merge = (r1: number, c1: number, r2: number, c2: number) => ws.mergeCells(r1, c1, r2, c2);
  const cell = (r: number, c: number, v: unknown, opts: Partial<ExcelJS.Style> = {}) => {
    const cl = ws.getCell(r, c);
    cl.value = v as ExcelJS.CellValue;
    cl.font = { name: "Arial", size: 9, ...(opts.font ?? {}) };
    cl.alignment = { vertical: "middle", wrapText: true, ...(opts.alignment ?? {}) };
    if (opts.border) cl.border = opts.border;
    if (opts.fill) cl.fill = opts.fill;
    return cl;
  };

  merge(1, 1, 1, KOLOM);
  cell(1, 1, "YAYASAN PENDIDIKAN SANTO YOHANES", { font: { name: "Arial", size: 13, bold: true }, alignment: { horizontal: "center", vertical: "middle" } });
  merge(2, 1, 2, KOLOM);
  cell(2, 1, `SAINT JOHN'S SCHOOL KAMPUS: ${laporan.cabang}${laporan.jenjang ? ` - ${laporan.jenjang}` : ""}`, { font: { name: "Arial", size: 11, bold: true }, alignment: { horizontal: "center", vertical: "middle" } });
  merge(3, 1, 3, KOLOM);
  cell(3, 1, String(laporan.judul ?? "PERFECT ATTENDANCE"), { font: { name: "Arial", size: 11, bold: true }, alignment: { horizontal: "center", vertical: "middle" } });

  merge(4, 1, 4, 14);
  cell(4, 1, `Period: ${laporan.keterangan_periode ?? `${fmtTanggal(laporan.tgl_mulai)} s/d ${fmtTanggal(laporan.tgl_selesai)}`}`, { font: { name: "Arial", size: 9, italic: true } });
  merge(4, 15, 4, KOLOM);
  cell(
    4,
    15,
    laporan.total_hari_kerja ? `Total hari kerja kependidikan: ${laporan.total_hari_kerja} Hari` : "",
    { font: { name: "Arial", size: 9 }, alignment: { horizontal: "right" } },
  );

  const HEADER_ROW1 = 6;
  const HEADER_ROW2 = 7;
  const thin: Partial<ExcelJS.Border> = { style: "thin" };
  const border: Partial<ExcelJS.Style["border"]> = { top: thin, left: thin, bottom: thin, right: thin };
  const headFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EBE3" } };
  const headOpt = { font: { bold: true, size: 8 }, alignment: { horizontal: "center" as const, vertical: "middle" as const }, border, fill: headFill };

  const singleCols: [number, string][] = [
    [1, "No"],
    [2, "NIM"],
    [3, "Unit"],
    [4, "Nama Karyawan"],
    [5, "Jabatan"],
  ];
  for (const [c, label] of singleCols) {
    merge(HEADER_ROW1, c, HEADER_ROW2, c);
    cell(HEADER_ROW1, c, label, headOpt);
  }

  merge(HEADER_ROW1, 6, HEADER_ROW1, 7);
  cell(HEADER_ROW1, 6, "Kupon Konsumsi", headOpt);
  cell(HEADER_ROW2, 6, "Awal", headOpt);
  cell(HEADER_ROW2, 7, "Akhir", headOpt);

  merge(HEADER_ROW1, 8, HEADER_ROW1, 25);
  cell(HEADER_ROW1, 8, "Attendance Leave", headOpt);

  const subCols: [number, string][] = [
    [8, "Total Work"],
    [9, "Sick"],
    [10, "Permit"],
    [11, "Ket."],
    [12, "Alpa"],
    [13, "Cuti"],
    [14, "Ket."],
    [15, "Lembur (jam)"],
    [16, "Ket."],
    [17, "Telat (hari)"],
    [18, "Telat (mnt)"],
    [19, "Ket."],
    [20, "Izin Telat (hari)"],
    [21, "Izin Telat (mnt)"],
    [22, "Ket."],
    [23, "Plg Cepat (hari)"],
    [24, "Plg Cepat (mnt)"],
    [25, "Ket."],
  ];
  for (const [c, label] of subCols) {
    cell(HEADER_ROW2, c, label, headOpt);
  }

  const tailCols: [number, string][] = [
    [26, "Insentive"],
    [27, "Agama"],
    [28, "Tanggal Masuk"],
  ];
  for (const [c, label] of tailCols) {
    merge(HEADER_ROW1, c, HEADER_ROW2, c);
    cell(HEADER_ROW1, c, label, headOpt);
  }

  let r = HEADER_ROW2 + 1;
  let totalInsentif = 0;
  baris.forEach((b, i) => {
    const nilai: unknown[] = [
      i + 1,
      b.nim,
      b.unit,
      b.nama,
      b.jabatan,
      b.kupon_periode1,
      b.kupon_periode2,
      b.total_kerja_hari,
      b.sakit_hari || "",
      b.izin_hari || "",
      b.izin_ket ?? "",
      b.alpa_hari || "",
      b.cuti_hari || "",
      b.cuti_ket ?? "",
      Number(b.lembur_menit) ? fmtJam(Number(b.lembur_menit)) : "",
      b.lembur_ket ?? "",
      b.telat_hari || "",
      b.telat_menit || "",
      b.telat_ket ?? "",
      b.izin_telat_hari || "",
      b.izin_telat_menit || "",
      b.izin_telat_ket ?? "",
      b.plg_cepat_hari || "",
      b.plg_cepat_menit || "",
      b.plg_cepat_ket ?? "",
      Number(b.insentif) ? Number(b.insentif) : "",
      b.agama ?? "",
      fmtTanggal(b.tanggal_masuk),
    ];
    totalInsentif += Number(b.insentif) || 0;
    nilai.forEach((v, ci) => {
      cell(r, ci + 1, v, {
        border,
        alignment: { horizontal: ci === 3 || ci === 4 ? "left" : "center", vertical: "middle" },
      });
    });
    r += 1;
    if (b.catatan) {
      merge(r, 4, r, KOLOM);
      cell(r, 4, String(b.catatan), { font: { italic: true, size: 8, color: { argb: "FF5B655D" } } });
      r += 1;
    }
  });

  merge(r, 1, r, 25);
  cell(r, 1, "Total", { font: { bold: true }, border, alignment: { horizontal: "right" } });
  cell(r, 26, totalInsentif || "", { font: { bold: true }, border, alignment: { horizontal: "center" } });
  merge(r, 27, r, KOLOM);
  cell(r, 27, "", { border });
  r += 2;

  const tglCetak = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  merge(r, 20, r, KOLOM);
  cell(r, 20, `${laporan.cabang}, ${tglCetak}`, { font: { size: 9 }, alignment: { horizontal: "right" } });
  r += 2;
  cell(r, 4, "Mengetahui", { font: { size: 9 } });
  merge(r, 20, r, KOLOM);
  cell(r, 20, "dibuat oleh", { font: { size: 9 }, alignment: { horizontal: "right" } });
  r += 4;
  cell(r, 4, String(laporan.mengetahui_nama ?? "(_______________)"), { font: { bold: true, size: 9 } });
  merge(r, 20, r, KOLOM);
  cell(r, 20, String(laporan.dibuat_oleh_nama ?? "(_______________)"), { font: { bold: true, size: 9 }, alignment: { horizontal: "right" } });
  r += 1;
  cell(r, 4, `( ${laporan.mengetahui_jabatan ?? ""} )`, { font: { size: 9 } });
  merge(r, 20, r, KOLOM);
  cell(r, 20, `( ${laporan.dibuat_oleh_jabatan ?? ""} )`, { font: { size: 9 }, alignment: { horizontal: "right" } });

  ws.getColumn(4).width = 22;
  ws.getColumn(5).width = 16;
  for (let c = 6; c <= KOLOM; c++) ws.getColumn(c).width = c === 11 || c === 14 || c === 16 || c === 19 || c === 22 || c === 25 ? 12 : 9;
  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 9;
  ws.getColumn(3).width = 8;

  const buffer = await wb.xlsx.writeBuffer();
  const namaFile = `laporan-yayasan-${laporan.cabang}-${laporan.jenjang ?? ""}-${laporan.tgl_mulai}.xlsx`.replace(/\s+/g, "-");

  return new Response(buffer as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${namaFile}"`,
    },
  });
});

export const config: Config = { path: "/api/laporan-yayasan-export" };
