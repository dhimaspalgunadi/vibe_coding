export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

// Menangkap exception tak tertangani supaya pesan error asli tampil di
// respons JSON (dan ikut muncul di UI), bukan berhenti jadi 502 buta dari
// platform -- sementara tidak ada akses baca log fungsi dari sisi kami.
type Handler = (req: Request) => Promise<Response>;

export function amankan(handler: Handler): Handler {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      const pesan = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return json({ error: `Kesalahan server: ${pesan}` }, 500);
    }
  };
}
