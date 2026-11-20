import { validateInput } from "@ductura/contracts";
import { kolacicZahtjeva, odgovor, procitajMutaciju } from "../../../../src/server/bff.js";
import { pozoviServer } from "../../../../src/server/institution-server.js";

/** @type {Map<string, [import("@ductura/contracts").OperationId, number]>} */
const writes = new Map([
  ["evidence/open", ["evidence.open.post", 1024]],
  ["evidence/commit", ["evidence.commit.post", 5_596_504]],
  ["submission", ["submission.submit.post", 1024]],
]);

export async function POST(request, { params }) {
  const { work } = await params;
  const path = work.join("/");
  const route = writes.get(path);
  if (!route) return odgovor({ status: "not_found" }, 404);

  const origin = request.headers.get("origin");
  const sameOrigin = URL.canParse(origin ?? "") && new URL(origin).origin === origin &&
    new URL(origin).host === (request.headers.get("host") ?? new URL(request.url).host);
  if (!sameOrigin) return odgovor({ status: "forbidden" }, 403);

  const [operation, maxBytes] = route;
  const mutation = await procitajMutaciju(request, maxBytes);
  if ("odbijeno" in mutation) return mutation.odbijeno;
  if (!validateInput(operation, "body", mutation.tijelo)) return odgovor({ status: "invalid" }, 422);

  const result = await pozoviServer(`/${path}`, {
    method: "POST", tijelo: mutation.tijelo, kolacic: kolacicZahtjeva(request), origin, protocol: "1",
  });
  return odgovor(await result?.json().catch(() => null) ?? { status: "unavailable" }, result?.status ?? 503);
}
