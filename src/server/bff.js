// Shared rules for the BFF route handlers under app/api.
import { izvuciKolacic } from "./institution-server.js";

const NO_STORE = { "Cache-Control": "no-store" };
// A long seminar paper is well under this; anything bigger is refused here.
const MAX_TIJELO = 2 * 1024 * 1024;

export const odgovor = (tijelo, status) =>
  new Response(JSON.stringify(tijelo), { status, headers: { ...NO_STORE, "content-type": "application/json" } });

export const kolacicZahtjeva = (request) => izvuciKolacic(request.headers.get("cookie"));

/** BFF answer for an Institution_server failure state. */
export const greska = (stanje) =>
  ({
    odjavljen: () => odgovor({ greska: "nije_prijavljen" }, 401),
    nema: () => odgovor({ greska: "nije_pronadjeno" }, 404),
  })[stanje]?.() ?? odgovor({ greska: "nedostupan" }, 502);

/**
 * Mutations come only from this app's own pages: JSON (so a cross-site form
 * cannot send one without a preflight) and, where the browser says so, from
 * the same origin.
 * @returns {Promise<{tijelo: unknown} | {odbijeno: Response}>}
 */
export async function procitajMutaciju(request, maxBytes = MAX_TIJELO) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return { odbijeno: odgovor({ greska: "zabranjeno" }, 403) };
  if (!/^application\/json\s*(;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return { odbijeno: odgovor({ greska: "ocekuje_se_json" }, 415) };
  }
  const tekst = await request.text();
  if (Buffer.byteLength(tekst, "utf8") > maxBytes) return { odbijeno: odgovor({ greska: "prevelik_zahtjev" }, 413) };
  try {
    return { tijelo: JSON.parse(tekst) };
  } catch {
    return { odbijeno: odgovor({ greska: "neispravan_json" }, 400) };
  }
}

export const nedozvoljeno = (allow) => () =>
  new Response(null, { status: 405, headers: { ...NO_STORE, Allow: allow } });
