import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { buatToken, cocokkanPassword, type Peran } from "./lib/auth.js";
import { setCookieHeader } from "./lib/cookies.js";
import { json } from "./lib/respond.js";

interface BarisPengguna {
  id: number;
  nama: string;
  email: string;
  password_hash: string;
  peran: Peran;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Metode tidak didukung." }, 405);

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return json({ error: "Email dan password wajib diisi." }, 400);

  const rows = (await db().sql`
    SELECT id, nama, email, password_hash, peran FROM pengguna WHERE lower(email) = ${email}
  `) as BarisPengguna[];
  const row = rows[0];
  if (!row) return json({ error: "Email atau password salah." }, 401);

  const cocok = await cocokkanPassword(password, row.password_hash);
  if (!cocok) return json({ error: "Email atau password salah." }, 401);

  const token = buatToken({ id: row.id, nama: row.nama, email: row.email, peran: row.peran });
  return json({ nama: row.nama, peran: row.peran }, 200, { "set-cookie": setCookieHeader(token) });
};

export const config: Config = { path: "/api/auth/login" };
