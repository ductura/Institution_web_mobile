import { cookies } from "next/headers";
import DnevnikPristupa from "../../../src/components/DnevnikPristupa.jsx";
import { dnevnikPristupa as t } from "../../../src/lib/messages.hr.js";
import { BASE_PATH, prijava } from "../../../src/lib/putanje.js";
import { dohvatiDnevnikPristupa } from "../../../src/server/access-log.js";
import { KOLACIC } from "../../../src/server/institution-server.js";
import styles from "./pristup.module.css";

export const metadata = { title: t.naslov };

export default async function Pristup({ params, searchParams }) {
  const { documentId } = await params;
  const { beforeAt, beforeId } = await searchParams;
  const prije = typeof beforeAt === "string" && typeof beforeId === "string" ? { beforeAt, beforeId } : undefined;
  const putanja = `/pristup/${encodeURIComponent(documentId)}`;
  const kolacic = (await cookies()).get(KOLACIC)?.value ?? null;
  const odgovor = await dohvatiDnevnikPristupa(documentId, kolacic, prije);

  return (
    <article className={styles.dnevnik}>
      <h1>{t.naslov}</h1>
      {odgovor.status === 200 ? (
        <DnevnikPristupa dnevnik={odgovor.dnevnik} putanja={putanja} />
      ) : odgovor.status === 401 ? (
        <>
          <p>{t.odjavljen}</p>
          <a href={prijava(`${BASE_PATH}${putanja}`)}>{t.prijava}</a>
        </>
      ) : (
        <p role="alert">{odgovor.status === 503 ? t.nedostupan : t.nijePronaden}</p>
      )}
    </article>
  );
}
