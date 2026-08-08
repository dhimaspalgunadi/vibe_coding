import type { Config } from "@netlify/functions";
import { db } from "./lib/db.js";
import { wajibLogin } from "./lib/auth.js";
import { json } from "./lib/respond.js";

const KOLOM = `
  r.id, p.nip, p.nama, uk.cabang, uk.jenjang,
  r.total_hari, r.total_telat_menit, r.total_plg_cepat_menit, r.total_lembur_menit,
  r.validasi_cocok, r.status_anomali, pu.tgl_mulai, pu.tgl_selesai
`;

export default async (req: Request) => {
  const sesi = wajibLogin(req, ["admin"]);
  if ("error" in sesi) return sesi.error;

  const url = new URL(req.url);
  const periodeIdRaw = url.searchParams.get("periodeId");
  const periodeId = periodeIdRaw ? parseInt(periodeIdRaw, 10) : null;
  const q = (url.searchParams.get("q") ?? "").trim();
  const qPattern = `%${q}%`;

  const database = db();
  const rows = periodeId
    ? await database.sql`
        SELECT ${database.sql.raw(KOLOM)}
        FROM rekap_bulanan r
        JOIN pegawai p ON p.id = r.pegawai_id
        JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
        JOIN periode_upload pu ON pu.id = r.periode_id
        WHERE r.periode_id = ${periodeId}
          AND (${q} = '' OR p.nama ILIKE ${qPattern} OR p.nip ILIKE ${qPattern})
        ORDER BY uk.cabang, uk.jenjang, p.nama
      `
    : await database.sql`
        SELECT ${database.sql.raw(KOLOM)}
        FROM rekap_bulanan r
        JOIN pegawai p ON p.id = r.pegawai_id
        JOIN unit_kerja uk ON uk.id = p.unit_kerja_id
        JOIN periode_upload pu ON pu.id = r.periode_id
        WHERE (${q} = '' OR p.nama ILIKE ${qPattern} OR p.nip ILIKE ${qPattern})
        ORDER BY uk.cabang, uk.jenjang, p.nama
      `;

  return json({ rekap: rows });
};

export const config: Config = { path: "/api/rekap" };
