import Link from "next/link";
import { cookies } from "next/headers";
import StaraPoveznica from "../src/components/StaraPoveznica.jsx";
import Stanje from "../src/components/Stanje.jsx";
import { docHref } from "../src/lib/doc.js";
import { dohvatiDokumente, KOLACIC } from "../src/server/institution-server.js";
import { studentskiZadaci } from "../src/server/student-work.js";
import { rad } from "../src/lib/messages.hr.js";

export const dynamic = "force-dynamic";

export default async function Popis() {
  const session = (await cookies()).get(KOLACIC)?.value ?? null;
  const [zadaci, docs] = await Promise.all([studentskiZadaci(session), dohvatiDokumente(session)]);
  return (
    <>
      <StaraPoveznica />
      {zadaci.courses?.length > 0 && (
        <section aria-label={rad.zadaci}>
          <h1>{rad.zadaci}</h1>
          {zadaci.courses.map((course) => (
            <section key={course.id}>
              <h2>{course.name}</h2>
              <ul className="work-list">
                {course.assignments.map((assignment) => (
                  <li key={assignment.id}>
                    <Link href={`/rad/${assignment.id}`}>{assignment.title}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </section>
      )}
      {typeof docs !== "string" ? (
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
      ) : zadaci.status === 200 ? (
        !zadaci.courses.some((course) => course.assignments.length) && <p>{rad.prazno}</p>
      ) : <Stanje stanje={zadaci.status === 401 ? "odjavljen" : docs} putanja="/" />}
    </>
  );
}
