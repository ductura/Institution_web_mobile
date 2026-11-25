import { createClient } from "@ductura/contracts";
import { pozoviServer } from "./institution-server.js";

export const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * Placeholder base URL for the shared contract client. It is never called:
 * every client built on it is given a fetch that keeps only the path (and
 * query) and sends the request through pozoviServer to INSTITUTION_SERVER_URL.
 * The .invalid TLD (RFC 6761) can never resolve, so a missed hand-off fails
 * instead of reaching some other host.
 */
export const NEPOZVANI_BAZNI_URL = "http://institution.invalid";

/** @param {string | null} kolacic */
export async function studentskiZadaci(kolacic) {
  const client = createClient(NEPOZVANI_BAZNI_URL, async (url) =>
    await pozoviServer(new URL(String(url)).pathname.slice("/api/v1".length), { kolacic }) ?? new Response(null, { status: 503 }),
  );
  const result = await client("student.assignments.get", { params: undefined, query: undefined, body: undefined });
  if (!result.ok) return { status: result.status };
  const courses = result.body?.courses;
  if (!Array.isArray(courses) || !courses.every((c) => UUID.test(c?.id) && typeof c.name === "string" &&
      Array.isArray(c.assignments) && c.assignments.every((a) => UUID.test(a?.id) &&
        typeof a.title === "string" && typeof a.noticeFirst === "boolean"))) return { status: 503 };
  return { status: 200, courses };
}
