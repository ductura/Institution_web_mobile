import { createClient } from "@ductura/contracts";
import { pozoviServer } from "./institution-server.js";
import { NEPOZVANI_BAZNI_URL, UUID } from "./student-work.js";

/** @typedef {import("@ductura/contracts").Operations["student.access-log.get"]["success"]["body"]} AccessLog */

const prozor = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:[0-5][05]:00\.000Z$/;
const uloge = new Set(["teacher", "mentor", "seminar_teacher", "unknown"]);
const prikazi = new Set(["live_view", "process_summary", "fast_path", "replay", "submitted_text", "unknown"]);

/** @param {string} vrijeme */
function ispravanProzor(vrijeme) {
  if (typeof vrijeme !== "string" || !prozor.test(vrijeme)) return false;
  const datum = new Date(vrijeme);
  return Number.isFinite(datum.getTime()) && datum.toISOString() === vrijeme;
}

/** @param {string} id */
const ispravanIdZapisa = (id) => typeof id === "string" && UUID.test(id) && id === id.toLowerCase();

/** @param {AccessLog | undefined} tijelo */
function ispravanDnevnik(tijelo) {
  return Array.isArray(tijelo?.entries) && typeof tijelo.continued === "boolean" &&
    tijelo.entries.every((zapis) => zapis && ispravanIdZapisa(zapis.id) && ispravanProzor(zapis.at) &&
      uloge.has(zapis.role) && prikazi.has(zapis.surface) &&
      (zapis.reader === null || (typeof zapis.reader?.givenName === "string" &&
        typeof zapis.reader.familyName === "string"))) &&
    (tijelo.next === null || (ispravanIdZapisa(tijelo.next?.beforeId) && ispravanProzor(tijelo.next?.beforeAt)));
}

/**
 * @param {string} documentId
 * @param {string | null} kolacic
 * @param {NonNullable<AccessLog["next"]>} [prije]
 * @returns {Promise<{status: 200, dnevnik: AccessLog} | {status: 401 | 403 | 404 | 503}>}
 */
export async function dohvatiDnevnikPristupa(documentId, kolacic, prije) {
  if (!kolacic) return { status: 401 };
  if (typeof documentId !== "string" || !documentId || documentId.length > 256 ||
      documentId.trim() !== documentId || /[\p{Cc}]/u.test(documentId) || documentId === "." || documentId === "..") {
    return { status: 404 };
  }
  const client = createClient(NEPOZVANI_BAZNI_URL, async (url) => {
    const { pathname, search } = new URL(String(url));
    const odgovor = await pozoviServer(pathname.slice("/api/v1".length) + search, { kolacic });
    return odgovor?.ok ? odgovor : new Response(null, { status: odgovor?.status ?? 503 });
  });
  const odgovor = await client("student.access-log.get", {
    params: { documentId }, query: prije, body: undefined,
  }).catch(() => null);
  const status = odgovor?.status;
  if (status === 401 || status === 403 || status === 404) return { status };
  if (odgovor?.ok && status === 200 && ispravanDnevnik(odgovor.body)) {
    return { status: 200, dnevnik: odgovor.body };
  }
  return { status: 503 };
}
