import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { hashPassword, wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

// Field yang boleh dikoreksi lewat menu Manajemen User. Password ditangani
// terpisah di luar loop ini karena perlu di-hash, bukan disimpan mentah.
const FIELD_PENGGUNA = ["nama", "email", "peran", "status_aktif"] as const;

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
    const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const peran = body?.peran === "admin" || body?.peran === "pimpinan" ? body.peran : "";
    if (!nama || !email || !peran) return json({ error: "Nama, email, dan peran wajib diisi." }, 400);
    if (password.length < 8) return json({ error: "Password minimal 8 karakter." }, 400);

    try {
      const hash = await hashPassword(password);
      const rows = await database.sql`
        INSERT INTO pengguna (nama, email, password_hash, peran)
        VALUES (${nama}, ${email}, ${hash}, ${peran})
        RETURNING id, nama, email, peran, status_aktif, dibuat_pada
      `;
      const pengguna = rows[0] as { id: number };

      await database.sql`
        INSERT INTO audit_log (pengguna_id, pengguna_target_id, field_diubah, nilai_lama, nilai_baru, alasan)
        VALUES (${sesi.user.id}, ${pengguna.id}, 'pengguna_ditambahkan', NULL, ${email}, 'Ditambahkan manual oleh Admin')
      `;

      return json({ pengguna: rows[0] });
    } catch (err) {
      if (kodeKesalahan(err) === "23505") return json({ error: `Email "${email}" sudah terdaftar.` }, 409);
      throw err;
    }
  }

  const id = parseInt(url.searchParams.get("id") ?? "", 10);
  if (!id) return json({ error: "Parameter 'id' wajib diisi." }, 400);

  const sebelumRows = await database.sql`SELECT * FROM pengguna WHERE id = ${id}`;
  const sebelum = sebelumRows[0] as Record<string, unknown> | undefined;
  if (!sebelum) return json({ error: "Akun tidak ditemukan." }, 404);

  if (req.method === "PATCH") {
    const body = await req.json().catch(() => null);
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan perubahan wajib diisi." }, 400);

    // Akun tidak boleh mengubah perannya sendiri atau menonaktifkan dirinya
    // sendiri -- kalau satu-satunya Admin melakukan ini, tidak ada lagi yang
    // bisa membukanya kembali lewat menu ini.
    const milikSendiri = id === sesi.user.id;
    if (milikSendiri && "peran" in (body ?? {}) && body.peran !== sebelum.peran) {
      return json({ error: "Tidak bisa mengubah peran akun sendiri." }, 400);
    }
    if (milikSendiri && "status_aktif" in (body ?? {}) && !body.status_aktif) {
      return json({ error: "Tidak bisa menonaktifkan akun sendiri." }, 400);
    }

    const perubahan: [string, string | null, string | null][] = [];
    try {
      for (const field of FIELD_PENGGUNA) {
        if (!(field in (body ?? {}))) continue;
        let nilaiBaru: unknown = body[field];
        if (field === "email" && typeof nilaiBaru === "string") nilaiBaru = nilaiBaru.trim().toLowerCase();
        if (field === "nama" && typeof nilaiBaru === "string") nilaiBaru = nilaiBaru.trim();
        if (field === "status_aktif") nilaiBaru = Boolean(nilaiBaru);
        const nilaiLama = sebelum[field];
        if (String(nilaiBaru ?? "") === String(nilaiLama ?? "")) continue;
        await database.sql`UPDATE pengguna SET ${database.sql.raw(field)} = ${nilaiBaru} WHERE id = ${id}`;
        perubahan.push([field, nilaiLama == null ? null : String(nilaiLama), nilaiBaru == null ? null : String(nilaiBaru)]);
      }

      const passwordBaru = typeof body?.passwordBaru === "string" ? body.passwordBaru : "";
      if (passwordBaru) {
        if (passwordBaru.length < 8) return json({ error: "Password baru minimal 8 karakter." }, 400);
        const hash = await hashPassword(passwordBaru);
        await database.sql`UPDATE pengguna SET password_hash = ${hash} WHERE id = ${id}`;
        // Hash tidak pernah dicatat apa adanya di audit_log, cukup penanda
        // bahwa password memang diganti.
        perubahan.push(["password", "(diubah)", "(diubah)"]);
      }
    } catch (err) {
      if (kodeKesalahan(err) === "23505") return json({ error: "Email tersebut sudah dipakai akun lain." }, 409);
      throw err;
    }

    if (perubahan.length === 0) return json({ ok: true, pengguna: sebelum });

    for (const [field, lama, baru] of perubahan) {
      await database.sql`
        INSERT INTO audit_log (pengguna_id, pengguna_target_id, field_diubah, nilai_lama, nilai_baru, alasan)
        VALUES (${sesi.user.id}, ${id}, ${field}, ${lama}, ${baru}, ${alasan})
      `;
    }

    const hasil = await database.sql`
      SELECT id, nama, email, peran, status_aktif, dibuat_pada FROM pengguna WHERE id = ${id}
    `;
    return json({ ok: true, pengguna: hasil[0] });
  }

  if (req.method === "DELETE") {
    if (id === sesi.user.id) return json({ error: "Tidak bisa menghapus akun sendiri." }, 400);

    const body = await req.json().catch(() => ({}));
    const alasan = typeof body?.alasan === "string" ? body.alasan.trim() : "";
    if (!alasan) return json({ error: "Alasan penghapusan wajib diisi." }, 400);

    // Hapus dulu, baru catat log -- meniru pola pegawai-detail supaya tidak
    // ada entri log "dihapus" yang menyesatkan kalau DELETE gagal karena FK
    // (akun ini masih tercatat sebagai pengunggah file / aktor audit_log).
    try {
      await database.sql`DELETE FROM pengguna WHERE id = ${id}`;
    } catch (err) {
      if (kodeKesalahan(err) === "23503") {
        return json(
          {
            error:
              "Akun ini masih tercatat pada riwayat unggahan file atau riwayat perubahan lain sehingga tidak bisa dihapus. Nonaktifkan saja lewat status akun.",
          },
          409,
        );
      }
      throw err;
    }

    const snapshot = JSON.stringify({ nama: sebelum.nama, email: sebelum.email });
    await database.sql`
      INSERT INTO audit_log (pengguna_id, pengguna_target_id, field_diubah, nilai_lama, nilai_baru, alasan)
      VALUES (${sesi.user.id}, NULL, 'pengguna_dihapus', ${snapshot}, NULL, ${alasan})
    `;
    return json({ ok: true });
  }

  return json({ error: "Metode tidak didukung." }, 405);
});

export const config: Config = { path: "/api/pengguna-detail" };
