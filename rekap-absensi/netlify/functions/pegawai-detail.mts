import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

type TipeField = "int" | "text" | "date" | "bool";

// Kolom yang boleh dikoreksi Admin lewat menu Data Pegawai.
const FIELD_PEGAWAI: Record<string, TipeField> = {
  nip: "text",
  nama: "text",
  unit_kerja_id: "int",
  jabatan: "text",
  agama: "text",
  tanggal_masuk: "date",
  status_aktif: "bool",
};

function konversi(tipe: TipeField, v: unknown): unknown {
  if (v === null || v === "") return tipe === "text" ? "" : null;
  if (tipe === "int") return Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null;
  if (tipe === "bool") return Boolean(v);
  return String(v);
}

function kodeKesalahan(err: unknown): string | undefined {
  return (err as { code?: string } | null)?.code;
}

export default amankan(async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;
  const database = db();
  const url = new URL(req.url);

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const nip = typeof body?.nip === "string" ? body.nip.trim() : "";
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    const unitKerjaId = Number(body?.unit_kerja_id);
    if (!nip || !nama || !unitKerjaId) {
      return json({ error: "Field 'nip', 'nama', dan 'unit_kerja_id' wajib diisi." }, 400);
    }
    const jabatan = typeof body?.jabatan === "string" ? body.jabatan.trim() || null : null;
    const agama = typeof body?.agama === "string" ? body.agama.trim() || null : null;
    const tanggalMasuk = typeof body?.tanggal_masuk === "string" && body.tanggal_masuk ? body.tanggal_masuk : null;

    try {
      const rows = await database.sql`
        INSERT INTO pegawai (nip, nama, unit_kerja_id, jabatan, agama, tanggal_masuk)
        VALUES (${nip}, ${nama}, ${unitKerjaId}, ${jabatan}, ${agama}, ${tanggalMasuk})
        RETURNING *
      `;
      const pegawai = rows[0] as { id: number };

      await database.sql`
        INSERT INTO audit_log (pengguna_id, pegawai_id, field_diubah, nilai_lama, nilai_baru, alasan)
        VALUES (${sesi.user.id}, ${pegawai.id}, 'pegawai_ditambahkan', NULL, ${nama}, 'Ditambahkan manual oleh Admin')
      `;

      return json({ pegawai: rows[0] });
    } catch (err) {
      if (kodeKesalahan(err) === "23505") return json({ error: `NIP "${nip}" sudah terdaftar.` }, 409);
      if (kodeKesalahan(err) === "23503") return json({ error: "Unit kerja yang dipilih tidak ditemukan." }, 400);
      throw err;
    }
  }

  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const sebelumRows = await database.sql`SELECT * FROM pegawai WHERE id = ${id}`;
  const sebelum = sebelumRows[0] as Record<string, unknown> | undefined;
  if (!sebelum) return json({ error: "Pegawai tidak ditemukan." }, 404);

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => null);
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan perubahan wajib diisi." }, 400);

    const perubahan: [string, unknown, unknown][] = [];
    try {
      for (const [field, tipe] of Object.entries(FIELD_PEGAWAI)) {
        if (!(field in (body ?? {}))) continue;
        const nilaiBaru = konversi(tipe, body[field]);
        const nilaiLama = sebelum[field];
        const lamaBanding = nilaiLama instanceof Date ? nilaiLama.toISOString().slice(0, 10) : nilaiLama;
        if (String(nilaiBaru ?? "") === String(lamaBanding ?? "")) continue;
        await database.sql`UPDATE pegawai SET ${database.sql.raw(field)} = ${nilaiBaru} WHERE id = ${id}`;
        perubahan.push([field, lamaBanding == null ? null : String(lamaBanding), nilaiBaru == null ? null : String(nilaiBaru)]);
      }
    } catch (err) {
      if (kodeKesalahan(err) === "23505") return json({ error: "NIP tersebut sudah dipakai pegawai lain." }, 409);
      if (kodeKesalahan(err) === "23503") return json({ error: "Unit kerja yang dipilih tidak ditemukan." }, 400);
      throw err;
    }

    if (perubahan.length === 0) return json({ ok: true, pegawai: sebelum });

    for (const [field, lama, baru] of perubahan) {
      await database.sql`
        INSERT INTO audit_log (pengguna_id, pegawai_id, field_diubah, nilai_lama, nilai_baru, alasan)
        VALUES (${sesi.user.id}, ${id}, ${field}, ${lama}, ${baru}, ${alasan})
      `;
    }

    const hasil = await database.sql`
      SELECT p.*, uk.cabang, uk.jenjang FROM pegawai p JOIN unit_kerja uk ON uk.id = p.unit_kerja_id WHERE p.id = ${id}
    `;
    return json({ ok: true, pegawai: hasil[0] });
  }

  if (req.method === "DELETE") {
    const body = await req.json().catch(() => ({}));
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan penghapusan wajib diisi." }, 400);

    // Hapus dulu, baru catat log -- kalau DELETE gagal karena pegawai masih
    // punya riwayat rekap_bulanan/laporan_yayasan_baris (FK RESTRICT), tidak
    // boleh ada entri log "dihapus" yang menyesatkan padahal datanya masih ada.
    try {
      await database.sql`DELETE FROM pegawai WHERE id = ${id}`;
    } catch (err) {
      if (kodeKesalahan(err) === "23503") {
        return json(
          {
            error:
              "Pegawai ini masih punya riwayat Rekap Bulanan / Laporan Yayasan sehingga tidak bisa dihapus. Nonaktifkan saja lewat status pegawai bila sudah tidak aktif.",
          },
          409,
        );
      }
      throw err;
    }

    // Baris pegawai sudah tidak ada, jadi pegawai_id ditinggal NULL --
    // ringkasan identitasnya tetap terekam di nilai_lama (JSON).
    const snapshot = JSON.stringify({ nip: sebelum.nip, nama: sebelum.nama });
    await database.sql`
      INSERT INTO audit_log (pengguna_id, pegawai_id, field_diubah, nilai_lama, nilai_baru, alasan)
      VALUES (${sesi.user.id}, NULL, 'pegawai_dihapus', ${snapshot}, NULL, ${alasan})
    `;
    return json({ ok: true });
  }

  return json({ error: "Metode tidak didukung." }, 405);
});

export const config: Config = { path: "/api/pegawai-detail" };
