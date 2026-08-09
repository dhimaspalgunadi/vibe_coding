import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const database = db();

  if (req.method === "GET") {
    const rekapRows = await database.sql`
      SELECT r.*, p.nip, p.nama, uk.cabang, uk.jenjang, pu.tgl_mulai, pu.tgl_selesai, pu.nama_file_asal
      FROM rekap_bulanan r
      JOIN pegawai p ON p.id = r.pegawai_id
      JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
      JOIN periode_upload pu ON pu.id = r.periode_id
      WHERE r.id = ${id}
    `;
    const rekap = rekapRows[0];
    if (!rekap) return json({ error: "Rekap tidak ditemukan." }, 404);

    const harian = await database.sql`
      SELECT dh.*, kk.kategori AS ket_abs_kategori
      FROM detail_harian dh
      LEFT JOIN ket_abs_kategori kk ON kk.id = dh.ket_abs_kategori_id
      WHERE dh.rekap_id = ${id}
      ORDER BY dh.tanggal
    `;

    const audit = await database.sql`
      SELECT a.id, a.field_diubah, a.nilai_lama, a.nilai_baru, a.alasan, a.waktu, pg.nama AS admin_nama,
             dh2.tanggal AS tanggal_terkait
      FROM audit_log a
      JOIN pengguna pg ON pg.id = a.pengguna_id
      LEFT JOIN detail_harian dh2 ON dh2.id = a.detail_harian_id
      WHERE a.rekap_id = ${id}
      ORDER BY a.waktu DESC
    `;

    return json({ rekap, harian, audit });
  }

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => null);
    const field = typeof body?.field === "string" ? body.field : "";
    const nilaiBaru = body?.nilaiBaru;
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan perubahan wajib diisi." }, 400);

    const sebelumRows = await database.sql`SELECT * FROM rekap_bulanan WHERE id = ${id}`;
    const sebelum = sebelumRows[0] as Record<string, unknown> | undefined;
    if (!sebelum) return json({ error: "Rekap tidak ditemukan." }, 404);

    let nilaiLama: unknown;
    switch (field) {
      case "total_hari":
        nilaiLama = sebelum.total_hari;
        await database.sql`UPDATE rekap_bulanan SET total_hari = ${Number(nilaiBaru)} WHERE id = ${id}`;
        break;
      case "total_jam_menit":
        nilaiLama = sebelum.total_jam_menit;
        await database.sql`UPDATE rekap_bulanan SET total_jam_menit = ${Number(nilaiBaru)} WHERE id = ${id}`;
        break;
      case "total_telat_menit":
        nilaiLama = sebelum.total_telat_menit;
        await database.sql`UPDATE rekap_bulanan SET total_telat_menit = ${Number(nilaiBaru)} WHERE id = ${id}`;
        break;
      case "total_plg_cepat_menit":
        nilaiLama = sebelum.total_plg_cepat_menit;
        await database.sql`UPDATE rekap_bulanan SET total_plg_cepat_menit = ${Number(nilaiBaru)} WHERE id = ${id}`;
        break;
      case "total_lembur_menit":
        nilaiLama = sebelum.total_lembur_menit;
        await database.sql`UPDATE rekap_bulanan SET total_lembur_menit = ${Number(nilaiBaru)} WHERE id = ${id}`;
        break;
      case "status_anomali":
        if (nilaiBaru !== "normal" && nilaiBaru !== "perlu_tinjau") {
          return json({ error: "Nilai status_anomali tidak valid." }, 400);
        }
        nilaiLama = sebelum.status_anomali;
        await database.sql`UPDATE rekap_bulanan SET status_anomali = ${nilaiBaru} WHERE id = ${id}`;
        break;
      default:
        return json({ error: "Field tidak diizinkan diedit." }, 400);
    }

    await database.sql`
      INSERT INTO audit_log (pengguna_id, rekap_id, field_diubah, nilai_lama, nilai_baru, alasan)
      VALUES (${sesi.user.id}, ${id}, ${field}, ${String(nilaiLama)}, ${String(nilaiBaru)}, ${alasan})
    `;
    return json({ ok: true });
  }

  return json({ error: "Metode tidak didukung." }, 405);
});

export const config: Config = { path: "/api/rekap-detail" };
