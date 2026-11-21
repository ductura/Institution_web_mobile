import { canonicalJson, validateInput } from "@ductura/contracts";
import { kolacicZahtjeva, odgovor, procitajMutaciju } from "../../../src/server/bff.js";
import { pozoviServer } from "../../../src/server/institution-server.js";

const OPERACIJA = "support.problem-report.post";
const MAX_BAJTOVA = 8192;

export async function POST(request) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const origin = request.headers.get("origin");
  if (origin !== `${url.protocol}//${host}`) return odgovor({ status: "forbidden" }, 403);

  const mutacija = await procitajMutaciju(request, MAX_BAJTOVA);
  if ("odbijeno" in mutacija) return mutacija.odbijeno;
  if (!validateInput(OPERACIJA, "body", mutacija.tijelo)) return odgovor({ status: "invalid" }, 422);

  const kolacic = kolacicZahtjeva(request);
  if (!kolacic) return odgovor({ status: "unauthorized" }, 401);

  // pozoviServer serializes the object in insertion order. The report contract
  // requires canonical JSON, including the order of the nested browser keys.
  let tijelo;
  try {
    tijelo = JSON.parse(canonicalJson(mutacija.tijelo));
  } catch {
    return odgovor({ status: "invalid" }, 422);
  }
  const rezultat = await pozoviServer("/support/problem-report", {
    method: "POST", tijelo, kolacic, origin, protocol: "1",
  });
  if (rezultat?.status === 201) {
    const zapis = await rezultat.json().catch(() => null);
    if (typeof zapis?.reference === "string" && /^PR-[0-9A-F]{10}$/.test(zapis.reference)) {
      return odgovor({ reference: zapis.reference }, 201);
    }
  }
  const status = rezultat?.status;
  if ([401, 403, 413, 422, 429].includes(status)) return odgovor({ status: "rejected" }, status);
  return odgovor({ status: "unavailable" }, 503);
}
