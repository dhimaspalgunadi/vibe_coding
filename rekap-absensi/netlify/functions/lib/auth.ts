import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { bacaCookie } from "./cookies.js";

export type Peran = "admin" | "pimpinan";

export interface SesiPengguna {
  id: number;
  nama: string;
  email: string;
  peran: Peran;
}

declare const Netlify: { env: { get(key: string): string | undefined } } | undefined;

function secret(): string {
  const dariNetlify = typeof Netlify !== "undefined" ? Netlify.env.get("JWT_SECRET") : undefined;
  const s = dariNetlify ?? process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET belum diset di environment variables Netlify.");
  return s;
}

export function buatToken(user: SesiPengguna): string {
  return jwt.sign(user, secret(), { expiresIn: "12h" });
}

export function verifikasiToken(token: string): SesiPengguna | null {
  try {
    return jwt.verify(token, secret()) as unknown as SesiPengguna;
  } catch {
    return null;
  }
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function cocokkanPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function ambilSesi(req: Request): SesiPengguna | null {
  const token = bacaCookie(req);
  if (!token) return null;
  return verifikasiToken(token);
}

function jsonError(status: number, pesan: string): Response {
  return new Response(JSON.stringify({ error: pesan }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function wajibLogin(req: Request, peranDiizinkan?: Peran[]): { user: SesiPengguna } | { error: Response } {
  const user = ambilSesi(req);
  if (!user) return { error: jsonError(401, "Belum login.") };
  if (peranDiizinkan && !peranDiizinkan.includes(user.peran)) {
    return { error: jsonError(403, "Akun ini tidak berwenang mengakses data ini.") };
  }
  return { user };
}
