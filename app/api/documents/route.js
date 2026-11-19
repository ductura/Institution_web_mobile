// GET /api/documents -> Institution_server GET /api/v1/documents.
import { kolacicZahtjeva, greska, nedozvoljeno, odgovor } from "../../../src/server/bff.js";
import { dohvatiDokumente } from "../../../src/server/institution-server.js";

export async function GET(request) {
  const r = await dohvatiDokumente(kolacicZahtjeva(request));
  return typeof r === "string" ? greska(r) : odgovor(r, 200);
}

export const POST = nedozvoljeno("GET");
export { POST as PUT, POST as PATCH, POST as DELETE };
