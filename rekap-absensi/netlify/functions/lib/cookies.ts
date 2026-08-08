const COOKIE_NAME = "sesi";

export function bacaCookie(req: Request, nama: string = COOKIE_NAME): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) === nama) return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}

export function setCookieHeader(token: string, maxAgeDetik = 60 * 60 * 12): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeDetik}`;
}

export function hapusCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
