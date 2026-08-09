import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

const FIELD_HEADER_DIIZINKAN = new Set([
  "judul",
  "keterangan_periode",
  "total_hari_kerja",
  "mengetahui_nama",
  "mengetahui_jabatan",
  "dibuat_oleh_nama",
  "dibuat_oleh_jabatan",
]);

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const database = db();

  if (req.method === "GET") {
    const laporanRows = await database.sql`SELECT * FROM laporan_yayasan WHERE id = ${id}`;
    const laporan = laporanRows[0];
    if (!laporan) return json({ error: "Laporan tidak ditemukan." }, 404);

    const baris = await database.sql`
      SELECT * FROM laporan_yayasan_baris WHERE laporan_id = ${id} ORDER BY urutan, nama
    `;

    const audit = await database.sql`
      SELECT a.id, a.field_diubah, a.nilai_lama, a.nilai_baru, a.alasan, a.waktu,
             pg.nama AS admin_nama, lyb.nama AS pegawai_nama, lyb.nim AS nip
      FROM audit_log a
      JOIN pengguna pg ON pg.id = a.pengguna_id
      LEFT JOIN laporan_yayasan_baris lyb ON lyb.id = a.laporan_yayasan_baris_id
      WHERE a.laporan_yayasan_baris_id IN (SELECT id FROM laporan_yayasan_baris WHERE laporan_id = ${id})
      ORDER BY a.waktu DESC
      LIMIT 200
    `;

    return json({ laporan, baris, audit });
  }

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => null);
    const field = typeof body?.field === "string" ? body.field : "";
    const nilaiBaru = body?.nilaiBaru;
    if (!FIELD_HEADER_DIIZINKAN.has(field)) {
      return json({ error: "Field tidak diizinkan diedit." }, 400);
    }

    const database2 = db();
    let hasil;
    switch (field) {
      case "judul":
        hasil = await database2.sql`UPDATE laporan_yayasan SET judul = ${String(nilaiBaru ?? "")}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
      case "keterangan_periode":
        hasil = await database2.sql`UPDATE laporan_yayasan SET keterangan_periode = ${String(nilaiBaru ?? "")}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
      case "total_hari_kerja":
        hasil = await database2.sql`UPDATE laporan_yayasan SET total_hari_kerja = ${nilaiBaru === null || nilaiBaru === "" ? null : Number(nilaiBaru)}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
      case "mengetahui_nama":
        hasil = await database2.sql`UPDATE laporan_yayasan SET mengetahui_nama = ${String(nilaiBaru ?? "")}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
      case "mengetahui_jabatan":
        hasil = await database2.sql`UPDATE laporan_yayasan SET mengetahui_jabatan = ${String(nilaiBaru ?? "")}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
      case "dibuat_oleh_nama":
        hasil = await database2.sql`UPDATE laporan_yayasan SET dibuat_oleh_nama = ${String(nilaiBaru ?? "")}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
      case "dibuat_oleh_jabatan":
        hasil = await database2.sql`UPDATE laporan_yayasan SET dibuat_oleh_jabatan = ${String(nilaiBaru ?? "")}, diperbarui_pada = now() WHERE id = ${id} RETURNING *`;
        break;
    }
    if (!hasil || hasil.length === 0) return json({ error: "Laporan tidak ditemukan." }, 404);
    return json({ laporan: hasil[0] });
  }

  if (req.method === "DELETE") {
    const laporanRows = await database.sql`SELECT * FROM laporan_yayasan WHERE id = ${id}`;
    if (!laporanRows[0]) return json({ error: "Laporan tidak ditemukan." }, 404);
    await database.sql`DELETE FROM laporan_yayasan WHERE id = ${id}`;
    return json({ ok: true });
  }

  return json({ error: "Metode tidak didukung." }, 405);
});

export const config: Config = { path: "/api/laporan-yayasan-detail" };
