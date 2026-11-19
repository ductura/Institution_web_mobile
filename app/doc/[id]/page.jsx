import { cookies } from "next/headers";
import Editor from "../../../src/components/Editor.jsx";
import Stanje from "../../../src/components/Stanje.jsx";
import { docHref } from "../../../src/lib/doc.js";
import { dohvatiDokument, KOLACIC } from "../../../src/server/institution-server.js";

export const dynamic = "force-dynamic";

export default async function Dokument({ params }) {
  const { id } = await params;
  const doc = await dohvatiDokument(id, (await cookies()).get(KOLACIC)?.value ?? null);
  if (typeof doc === "string") return <Stanje stanje={doc} putanja={docHref(id)} />;
  return <Editor key={doc.id} doc={doc} />;
}
