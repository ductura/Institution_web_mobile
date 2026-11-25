// GET and PUT /api/documents/:id -> Institution_server /api/v1/documents/:id.
import { greska, kolacicZahtjeva, nedozvoljeno, odgovor, procitajMutaciju } from "../../../../src/server/bff.js";
import { dohvatiDokument, spremiDokument } from "../../../../src/server/institution-server.js";

export async function GET(request, { params }) {
  const { id } = await params;
  const r = await dohvatiDokument(id, kolacicZahtjeva(request));
  return typeof r === "string" ? greska(r) : odgovor(r, 200);
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const m = await procitajMutaciju(request);
  if ("odbijeno" in m) return m.odbijeno;
  /** @type {{id?: unknown, title?: unknown, content?: unknown}} */
  const t = m.tijelo && typeof m.tijelo === "object" ? m.tijelo : {};
  if (typeof t.title !== "string" || typeof t.content !== "string" || (t.id !== undefined && t.id !== id)) {
    return odgovor({ greska: "neispravan_unos" }, 400);
  }
  const r = await spremiDokument({ id, title: t.title, content: t.content }, kolacicZahtjeva(request));
  return typeof r === "string" ? greska(r) : odgovor(r, 200);
}

export const POST = nedozvoljeno("GET, PUT");
export { POST as PATCH, POST as DELETE };
