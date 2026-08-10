import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { cocokkanPassword, hashPassword, wajibLogin } from "./lib/auth.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  if (req.method !== "PATCH") return json({ error: "Metode tidak didukung." }, 405);
  const sesi = wajibLogin(req);
  if ("error" in sesi) return sesi.error;

  const body = await req.json().catch(() => null);
  const passwordLama = typeof body?.passwordLama === "string" ? body.passwordLama : "";
  const passwordBaru = typeof body?.passwordBaru === "string" ? body.passwordBaru : "";
  if (!passwordLama || !passwordBaru) {
    return json({ error: "Password lama dan password baru wajib diisi." }, 400);
  }
  if (passwordBaru.length < 8) {
    return json({ error: "Password baru minimal 8 karakter." }, 400);
  }

  const rows = (await db().sql`SELECT password_hash FROM pengguna WHERE id = ${sesi.user.id}`) as { password_hash: string }[];
  const row = rows[0];
  if (!row) return json({ error: "Akun tidak ditemukan." }, 404);

  const cocok = await cocokkanPassword(passwordLama, row.password_hash);
  if (!cocok) return json({ error: "Password lama tidak sesuai." }, 401);

  const hashBaru = await hashPassword(passwordBaru);
  await db().sql`UPDATE pengguna SET password_hash = ${hashBaru} WHERE id = ${sesi.user.id}`;

  return json({ ok: true });
});

export const config: Config = { path: "/api/auth/password" };
