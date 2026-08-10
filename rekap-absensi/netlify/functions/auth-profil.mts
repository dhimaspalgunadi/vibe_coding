import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { buatToken, wajibLogin } from "./lib/auth.js";
import { setCookieHeader } from "./lib/cookies.js";
import { amankan, json } from "./lib/respond.js";

export default amankan(async (req: Request) => {
  if (req.method !== "PATCH") return json({ error: "Metode tidak didukung." }, 405);
  const sesi = wajibLogin(req);
  if ("error" in sesi) return sesi.error;

  const body = await req.json().catch(() => null);
  const nama = typeof body?.nama === "string" ? body.nama.trim() : "";
  if (!nama) return json({ error: "Nama wajib diisi." }, 400);

  await db().sql`UPDATE pengguna SET nama = ${nama} WHERE id = ${sesi.user.id}`;

  // Terbitkan ulang token dengan nama baru -- token JWT membawa salinan nama
  // saat login, jadi tanpa ini nama lama akan tetap terbaca dari sesi sampai
  // login ulang.
  const userBaru = { id: sesi.user.id, nama, email: sesi.user.email, peran: sesi.user.peran };
  const token = buatToken(userBaru);
  return json({ nama: userBaru.nama, email: userBaru.email, peran: userBaru.peran }, 200, {
    "set-cookie": setCookieHeader(token),
  });
});

export const config: Config = { path: "/api/auth/profil" };
