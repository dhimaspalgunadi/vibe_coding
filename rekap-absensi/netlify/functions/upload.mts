import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";
import { parseWorkbook, validasiDanAnomali } from "./lib/parser.js";

interface KategoriRow {
  id: number;
  pola_teks: string;
}

function cariKategori(ketAbsRaw: string | null, kategoriList: KategoriRow[]): number | null {
  if (!ketAbsRaw) return null;
  const persis = kategoriList.find((k) => k.pola_teks === ketAbsRaw);
  if (persis) return persis.id;
  const kandidat = kategoriList
    .filter((k) => ketAbsRaw.startsWith(k.pola_teks))
    .sort((a, b) => b.pola_teks.length - a.pola_teks.length);
  return kandidat[0]?.id ?? null;
}

function konversiTanggal(ddmmyyyy: string | null): string | null {
  if (!ddmmyyyy) return null;
  const [d, m, y] = ddmmyyyy.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export default amankan(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Berkas tidak valid. Unggah sebagai form-data dengan field 'file'." }, 400);
  }

  const file = form.get("file");
  const cabang = String(form.get("cabang") ?? "").trim();
  const jenjang = String(form.get("jenjang") ?? "").trim();
  if (!(file instanceof File) || !cabang || !jenjang) {
    return json({ error: "Field 'file', 'cabang', dan 'jenjang' wajib diisi." }, 400);
  }

  const buffer = await file.arrayBuffer();
  let meta;
  let pegawaiList;
  try {
    const hasil = parseWorkbook(buffer, file.name);
    meta = hasil.meta;
    pegawaiList = hasil.pegawaiList;
  } catch {
    return json({ error: "Gagal membaca file. Pastikan formatnya sama seperti laporan mesin absensi." }, 400);
  }
  if (pegawaiList.length === 0) {
    return json({ error: "Tidak ada blok pegawai (baris 'NIP :') yang terdeteksi di file ini." }, 400);
  }

  const tglMulai = konversiTanggal(meta.periodeMulai);
  const tglSelesai = konversiTanggal(meta.periodeSelesai);
  if (!tglMulai || !tglSelesai) {
    return json({ error: "Baris 'Periode ... s/d ...' tidak terbaca dari file." }, 400);
  }

  const database = db();

  const unitRows = (await database.sql`
    INSERT INTO unit_kerja (cabang, jenjang)
    VALUES (${cabang}, ${jenjang})
    ON CONFLICT (cabang, jenjang) DO UPDATE SET cabang = EXCLUDED.cabang
    RETURNING id
  `) as { id: number }[];
  const unitKerjaId = unitRows[0].id;

  const periodeRows = (await database.sql`
    INSERT INTO periode_upload (unit_kerja_id, tgl_mulai, tgl_selesai, nama_file_asal, diunggah_oleh)
    VALUES (${unitKerjaId}, ${tglMulai}, ${tglSelesai}, ${file.name}, ${sesi.user.id})
    RETURNING id
  `) as { id: number }[];
  const periodeId = periodeRows[0].id;

  const kategoriList = (await database.sql`SELECT id, pola_teks FROM ket_abs_kategori`) as KategoriRow[];

  let validasiCocok = 0;
  let perluTinjau = 0;

  for (const pegawai of pegawaiList) {
    const v = validasiDanAnomali(pegawai);
    if (v.cocok) validasiCocok += 1;
    if (v.statusAnomali === "perlu_tinjau") perluTinjau += 1;

    const pegRows = (await database.sql`
      INSERT INTO pegawai (nip, nama, unit_kerja_id)
      VALUES (${pegawai.nip}, ${pegawai.nama}, ${unitKerjaId})
      ON CONFLICT (nip) DO UPDATE SET nama = EXCLUDED.nama, unit_kerja_id = EXCLUDED.unit_kerja_id
      RETURNING id
    `) as { id: number }[];
    const pegawaiId = pegRows[0].id;

    const total = pegawai.total;
    const rekapRows = (await database.sql`
      INSERT INTO rekap_bulanan (
        pegawai_id, periode_id, total_hari, total_jam_menit, total_telat_menit,
        total_plg_cepat_menit, total_lembur_menit, validasi_cocok, validasi_catatan,
        status_anomali, anomali_catatan
      ) VALUES (
        ${pegawaiId}, ${periodeId}, ${total?.totalHari ?? 0}, ${total?.totalJamMenit ?? 0},
        ${total?.totalTelatMenit ?? 0}, ${total?.totalPlgCepatMenit ?? 0}, ${total?.totalLemburMenit ?? 0},
        ${v.cocok}, ${v.cocok ? null : JSON.stringify(v.selisih)},
        ${v.statusAnomali}, ${v.catatan}
      )
      ON CONFLICT (pegawai_id, periode_id) DO UPDATE SET
        total_hari = EXCLUDED.total_hari,
        total_jam_menit = EXCLUDED.total_jam_menit,
        total_telat_menit = EXCLUDED.total_telat_menit,
        total_plg_cepat_menit = EXCLUDED.total_plg_cepat_menit,
        total_lembur_menit = EXCLUDED.total_lembur_menit,
        validasi_cocok = EXCLUDED.validasi_cocok,
        validasi_catatan = EXCLUDED.validasi_catatan,
        status_anomali = EXCLUDED.status_anomali,
        anomali_catatan = EXCLUDED.anomali_catatan
      RETURNING id
    `) as { id: number }[];
    const rekapId = rekapRows[0].id;

    await database.sql`DELETE FROM detail_harian WHERE rekap_id = ${rekapId}`;

    if (pegawai.harian.length > 0) {
      const baris = pegawai.harian.map((h) => [
        rekapId,
        h.tanggal,
        h.hari,
        h.libur,
        h.jamKerja,
        h.masukJadwal,
        h.pulangJadwal,
        h.masukAktual,
        h.pulangAktual,
        h.totalJamMenit,
        h.telatMenit,
        h.plgCepatMenit,
        h.lemburMenit,
        h.ketAbsRaw,
        cariKategori(h.ketAbsRaw, kategoriList),
      ]);
      const nilai = database.sql.values(baris);
      await database.sql`
        INSERT INTO detail_harian (
          rekap_id, tanggal, hari, libur, jam_kerja, masuk_jadwal, pulang_jadwal,
          masuk_aktual, pulang_aktual, total_jam_menit, telat_menit, plg_cepat_menit,
          lembur_menit, ket_abs_raw, ket_abs_kategori_id
        ) VALUES ${nilai}
      `;
    }
  }

  return json({
    unitKerja: { cabang, jenjang },
    periode: { mulai: tglMulai, selesai: tglSelesai },
    pegawaiDiproses: pegawaiList.length,
    validasiCocok,
    validasiSelisih: pegawaiList.length - validasiCocok,
    perluTinjau,
  });
});

export const config: Config = { path: "/api/upload" };
