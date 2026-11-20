import { cookies } from "next/headers";
import Stanje from "../../../src/components/Stanje.jsx";
import StudentWork from "../../../src/components/StudentWork.jsx";
import { rad } from "../../../src/lib/messages.hr.js";
import { KOLACIC } from "../../../src/server/institution-server.js";
import { studentskiZadaci, UUID } from "../../../src/server/student-work.js";

export default async function Rad({ params }) {
  const { assignmentId } = await params;
  if (!UUID.test(assignmentId)) return <p role="alert">{rad.nedostupan}</p>;
  const data = await studentskiZadaci((await cookies()).get(KOLACIC)?.value ?? null);
  const putanja = `/rad/${assignmentId}`;
  if (data.status === 401) return <Stanje stanje="odjavljen" putanja={putanja} />;
  const assignment = data.courses?.flatMap((course) => course.assignments)
    .find((item) => item.id.toLowerCase() === assignmentId.toLowerCase());
  if (!assignment) return <p role="alert">{rad.nedostupan}</p>;

  return (
    <article className="student-work">
      <h1>{assignment.title}</h1>
      {assignment.noticeFirst ? <p>{rad.upute}</p> : <StudentWork assignmentId={assignment.id} />}
    </article>
  );
}
