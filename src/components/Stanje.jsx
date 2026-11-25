import { BASE_PATH, prijava } from "../lib/putanje.js";

// What a page shows instead of data when Institution_server does not give it.
// The login link is a plain <a>: /api/v1 is outside this app's base path.
export default function Stanje({ stanje, putanja }) {
  if (stanje === "odjavljen") {
    return (
      <>
        <p role="alert">Za ovu stranicu treba se prijaviti.</p>
        <a href={prijava(`${BASE_PATH}${putanja}`)}>Prijava preko AAI@EduHr</a>
      </>
    );
  }
  if (stanje === "nema") return <p role="alert">Dokument nije dostupan.</p>;
  return <p role="alert">Poslužitelj trenutačno ne odgovara. Pokušajte ponovno za nekoliko trenutaka.</p>;
}
