import Link from "next/link";
import { cookies } from "next/headers";
import StaraPoveznica from "../src/components/StaraPoveznica.jsx";
import Stanje from "../src/components/Stanje.jsx";
import { docHref } from "../src/lib/doc.js";
import { dohvatiDokumente, KOLACIC } from "../src/server/institution-server.js";

export const dynamic = "force-dynamic";

export default async function Popis() {
  const docs = await dohvatiDokumente((await cookies()).get(KOLACIC)?.value ?? null);
  return (
    <>
      <StaraPoveznica />
      {typeof docs === "string" ? (
        <Stanje stanje={docs} putanja="/" />
      ) : (
        <>
          <h1>Moji dokumenti</h1>
          <ul id="doc-list">
            {docs.map((d) => (
              <li key={d.id}>
                <Link href={docHref(d.id)}>{d.title}</Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
