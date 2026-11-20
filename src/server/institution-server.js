// The only way this app reaches Institution_server (/api/v1). Runs on the
// server (route handlers and server components); the browser never reads the
// database or another service. Only the AAI@EduHr session cookie is passed on.
export const KOLACIC = "__Host-ductus_session";
const ZADANI_URL = "http://127.0.0.1:4000";
const ROK_MS = 5_000;

export const serverUrl = () => (process.env.INSTITUTION_SERVER_URL || ZADANI_URL).replace(/\/+$/, "");

/** Document ids as the routes accept them (same rule as parseRoute). */
export const ispravanId = (id) => typeof id === "string" && /^[\w-]{1,128}$/.test(id);

/** Value of the session cookie from a Cookie header, or null. */
export function izvuciKolacic(cookieHeader) {
  for (const dio of String(cookieHeader ?? "").split(";")) {
    const i = dio.indexOf("=");
    if (i < 0 || dio.slice(0, i).trim() !== KOLACIC) continue;
    const v = dio.slice(i + 1).trim();
    return /^[!#-+\--:<-[\]-~]{1,4096}$/.test(v) ? v : null;
  }
  return null;
}

/**
 * @param {string} putanja path under /api/v1, e.g. "/documents"
 * @param {{method?: string, tijelo?: unknown, kolacic?: string | null}} [opcije]
 * @returns {Promise<Response | null>} null when the server cannot be reached in time.
 */
export async function pozoviServer(putanja, { method = "GET", tijelo, kolacic } = {}) {
  const headers = { accept: "application/json" };
  if (kolacic) headers.cookie = `${KOLACIC}=${kolacic}`;
  if (tijelo !== undefined) headers["content-type"] = "application/json";
  try {
    return await fetch(`${serverUrl()}/api/v1${putanja}`, {
      method,
      headers,
      body: tijelo === undefined ? undefined : JSON.stringify(tijelo),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(ROK_MS),
    });
  } catch {
    return null;
  }
}

const tekst = (v) => typeof v === "string";
const dokument = (d) => d && ispravanId(d.id) && tekst(d.title) && tekst(d.content);

// "odjavljen" | "nema" | "nedostupan" | the parsed body.
async function citaj(putanja, kolacic) {
  const res = await pozoviServer(putanja, { kolacic });
  if (!res) return "nedostupan";
  if (res.status === 401) return "odjavljen";
  if (res.status === 404) return "nema";
  if (!res.ok) return "nedostupan";
  try {
    return await res.json();
  } catch {
    return "nedostupan";
  }
}

/** @returns {Promise<Array<{id: string, title: string}> | "odjavljen" | "nedostupan">} */
export async function dohvatiDokumente(kolacic) {
  const r = await citaj("/documents", kolacic);
  if (typeof r === "string") return r === "odjavljen" ? "odjavljen" : "nedostupan";
  if (!Array.isArray(r)) return "nedostupan";
  return r.filter((d) => d && ispravanId(d.id) && tekst(d.title)).map(({ id, title }) => ({ id, title }));
}

/** @returns {Promise<{id: string, title: string, content: string} | "odjavljen" | "nema" | "nedostupan">} */
export async function dohvatiDokument(id, kolacic) {
  if (!ispravanId(id)) return "nema";
  const r = await citaj(`/documents/${encodeURIComponent(id)}`, kolacic);
  if (r === "odjavljen" || r === "nema" || r === "nedostupan") return r;
  return dokument(r) ? { id: r.id, title: r.title, content: r.content } : "nedostupan";
}

/** @returns {Promise<{id: string, title: string, content: string} | "odjavljen" | "nema" | "nedostupan">} */
export async function spremiDokument({ id, title, content }, kolacic) {
  if (!ispravanId(id)) return "nema";
  const res = await pozoviServer(`/documents/${encodeURIComponent(id)}`, {
    method: "PUT",
    tijelo: { id, title, content },
    kolacic,
  });
  if (!res) return "nedostupan";
  if (res.status === 401) return "odjavljen";
  if (res.status === 404) return "nema";
  if (!res.ok) return "nedostupan";
  const r = await res.json().catch(() => null);
  return dokument(r) ? { id: r.id, title: r.title, content: r.content } : "nedostupan";
}
