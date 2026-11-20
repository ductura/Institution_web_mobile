import { createClient } from "@ductura/contracts";
import { pozoviServer } from "./institution-server.js";

export const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/** @param {string | null} kolacic */
export async function studentskiZadaci(kolacic) {
  const client = createClient("http://institution.invalid", async (url) =>
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
