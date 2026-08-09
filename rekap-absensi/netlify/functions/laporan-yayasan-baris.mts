import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

type TipeField = "int" | "numeric" | "text" | "date";

// Kolom yang boleh dikoreksi Admin di satu baris laporan, beserta tipenya
// untuk konversi/validasi nilai sebelum disimpan.
const FIELD_BARIS: Record<string, TipeField> = {
  nim: "text",
  unit: "text",
  nama: "text",
  jabatan: "text",
  kupon_periode1: "int",
  kupon_periode2: "int",
  total_kerja_hari: "int",
  sakit_hari: "int",
  izin_hari: "int",
  izin_ket: "text",
  alpa_hari: "int",
  cuti_hari: "int",
  cuti_ket: "text",
  lembur_menit: "int",
  lembur_ket: "text",
  telat_hari: "int",
  telat_menit: "int",
  telat_ket: "text",
  izin_telat_hari: "int",
  izin_telat_menit: "int",
  izin_telat_ket: "text",
  plg_cepat_hari: "int",
  plg_cepat_menit: "int",
  plg_cepat_ket: "text",
  insentif: "numeric",
  agama: "text",
  tanggal_masuk: "date",
  catatan: "text",
  urutan: "int",
};

function konversi(tipe: TipeField, v: unknown): unknown {
  if (v === null || v === "") return tipe === "text" ? "" : null;
  if (tipe === "int") return Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
  if (tipe === "numeric") return Number.isFinite(Number(v)) ? Number(v) : null;
  return String(v);
}

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;
  const database = db();
  const url = new URL(req.url);

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const laporanId = Number(body?.laporanId);
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    if (!laporanId || !nama) return json({ error: "Parameter 'laporanId' dan 'nama' wajib diisi." }, 400);

    const laporanRows = await database.sql`SELECT id FROM laporan_yayasan WHERE id = ${laporanId}`;
    if (!laporanRows[0]) return json({ error: "Laporan tidak ditemukan." }, 404);

    const nim = typeof body?.nim === "string" ? body.nim.trim() : null;
    const unit = typeof body?.unit === "string" ? body.unit.trim() : null;
    const jabatan = typeof body?.jabatan === "string" ? body.jabatan.trim() : null;
    const pegawaiId = body?.pegawaiId ? Number(body.pegawaiId) : null;

    const maxUrutan = (await database.sql`
      SELECT COALESCE(MAX(urutan), 0)::int AS m FROM laporan_yayasan_baris WHERE laporan_id = ${laporanId}
    `) as { m: number }[];

    const rows = await database.sql`
      INSERT INTO laporan_yayasan_baris (laporan_id, pegawai_id, urutan, nim, unit, nama, jabatan)
      VALUES (${laporanId}, ${pegawaiId}, ${maxUrutan[0].m + 1}, ${nim}, ${unit}, ${nama}, ${jabatan})
      RETURNING *
    `;

    await database.sql`
      INSERT INTO audit_log (pengguna_id, laporan_yayasan_baris_id, field_diubah, nilai_lama, nilai_baru, alasan)
      VALUES (${sesi.user.id}, ${rows[0].id}, 'baris_ditambahkan', NULL, ${nama}, 'Ditambahkan manual oleh Admin')
    `;

    return json({ baris: rows[0] });
  }

  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const sebelumRows = await database.sql`SELECT * FROM laporan_yayasan_baris WHERE id = ${id}`;
  const sebelum = sebelumRows[0] as Record<string, unknown> | undefined;
  if (!sebelum) return json({ error: "Baris laporan tidak ditemukan." }, 404);

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => null);
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan perubahan wajib diisi." }, 400);

    const perubahan: [string, unknown, unknown][] = [];
    for (const [field, tipe] of Object.entries(FIELD_BARIS)) {
      if (!(field in (body ?? {}))) continue;
      const nilaiBaru = konversi(tipe, body[field]);
      const nilaiLama = sebelum[field];
      const lamaBanding = nilaiLama instanceof Date ? nilaiLama.toISOString().slice(0, 10) : nilaiLama;
      if (String(nilaiBaru ?? "") === String(lamaBanding ?? "")) continue;
      await database.sql`UPDATE laporan_yayasan_baris SET ${database.sql.raw(field)} = ${nilaiBaru} WHERE id = ${id}`;
      perubahan.push([field, lamaBanding == null ? null : String(lamaBanding), nilaiBaru == null ? null : String(nilaiBaru)]);
    }

    if (perubahan.length === 0) return json({ ok: true, baris: sebelum });

    await database.sql`UPDATE laporan_yayasan_baris SET diperbarui_pada = now() WHERE id = ${id}`;
    for (const [field, lama, baru] of perubahan) {
      await database.sql`
        INSERT INTO audit_log (pengguna_id, laporan_yayasan_baris_id, field_diubah, nilai_lama, nilai_baru, alasan)
        VALUES (${sesi.user.id}, ${id}, ${field}, ${lama}, ${baru}, ${alasan})
      `;
    }

    const hasil = await database.sql`SELECT * FROM laporan_yayasan_baris WHERE id = ${id}`;
    return json({ ok: true, baris: hasil[0] });
  }

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan penghapusan wajib diisi." }, 400);

    const snapshot = JSON.stringify({
      nim: sebelum.nim,
      unit: sebelum.unit,
      nama: sebelum.nama,
      jabatan: sebelum.jabatan,
      laporan_id: sebelum.laporan_id,
    });

    await database.sql`
      INSERT INTO audit_log (pengguna_id, laporan_yayasan_baris_id, field_diubah, nilai_lama, nilai_baru, alasan)
      VALUES (${sesi.user.id}, ${id}, 'baris_dihapus', ${snapshot}, NULL, ${alasan})
    `;
    await database.sql`DELETE FROM laporan_yayasan_baris WHERE id = ${id}`;
    return json({ ok: true });
  }

  return json({ error: "Metode tidak didukung." }, 405);
});

export const config: Config = { path: "/api/laporan-yayasan-baris" };
