import Link from "next/link";
import { dnevnikPristupa as t } from "../lib/messages.hr.js";
import styles from "../../app/pristup/[documentId]/pristup.module.css";

const timeZone = "Europe/Zagreb";
const dan = new Intl.DateTimeFormat("hr-HR", { timeZone, dateStyle: "long" });
const vrijeme = new Intl.DateTimeFormat("hr-HR", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** @param {{dnevnik: import("../server/access-log.js").AccessLog, putanja: string}} props */
export default function DnevnikPristupa({ dnevnik, putanja }) {
  const { entries, next, continued } = dnevnik;
  /** @type {Map<string, typeof entries>} */
  const poDanu = new Map();
  for (const zapis of entries) {
    const datum = dan.format(new Date(zapis.at));
    const zapisi = poDanu.get(datum) ?? [];
    zapisi.push(zapis);
    poDanu.set(datum, zapisi);
  }

  return (
    <>
      <p>{t.opis}</p>
      {entries.length === 0 && <p>{continued ? t.nemaStarijih : t.prazno}</p>}
      {[...poDanu].map(([datum, zapisi]) => (
        <section key={datum}>
          <h2>{datum}</h2>
          <ul className={styles.zapisi} role="list">
            {zapisi.map(({ id, at, reader, role, surface }) => (
              <li className={styles.zapis} key={id}>
                <time dateTime={at}>{vrijeme.format(new Date(at))}</time>
                <div>
                  <strong>{reader ? `${reader.givenName} ${reader.familyName}` : t.uloge[role]}</strong>
                  {reader && <span>{t.uloge[role]}</span>}
                  <span>{t.prikazi[surface]}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {(continued || next) && (
        <nav className={styles.stranice} aria-label={t.naslov}>
          {continued && <Link href={putanja}>{t.najnoviji}</Link>}
          {next && <Link href={{ pathname: putanja, query: next }}>{t.stariji}</Link>}
        </nav>
      )}
    </>
  );
}
