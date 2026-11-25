# Ductura / web-mobile

Mobilni frontend za mobitele i tablete. Preloader ovamo šalje sve mobilne uređaje, bez obzira na preglednik.
Next.js (App Router) na Node.js, u JavaScriptu; spremno za Vercel (Next.js preset), konfiguracija samo kroz env varijable.

## Podaci

Aplikacija nikad ne čita bazu. Stranice i rute u `app/api/` (BFF) zovu Institution_server `/api/v1` na poslužitelju,
na adresi iz `INSTITUTION_SERVER_URL` (zadano http://127.0.0.1:4000), i prenose samo kolačić sesije `__Host-ductus_session` (AAI@EduHr).

| Ruta ove aplikacije | Institution_server |
| --- | --- |
| `GET /api/documents` | `GET /api/v1/documents` |
| `GET /api/documents/:id` | `GET /api/v1/documents/:id` |
| `PUT /api/documents/:id` | `PUT /api/v1/documents/:id` |
| `POST /api/v1/evidence/open` | `POST /api/v1/evidence/open` (`evidence.open.post`) |
| `POST /api/v1/evidence/commit` | `POST /api/v1/evidence/commit` (`evidence.commit.post`) |
| `POST /api/v1/submission` | `POST /api/v1/submission` (`submission.submit.post`) |
| `POST /api/prijavi-problem` | `POST /api/v1/support/problem-report` (`support.problem-report.post`) |

Mutacije (`PUT` i `POST`) primaju samo JSON s iste adrese (`Sec-Fetch-Site`, a za `POST` i `Origin`),
provjeravaju tijelo prema zajedničkom ugovoru (`@ductura/contracts`) i odbijaju preveliko tijelo s 413:
prema najavljenom `Content-Length` bez čitanja, a bez njega čim tijelo prijeđe granicu.

| BFF ruta | Najveće tijelo |
| --- | --- |
| `PUT /api/documents/:id` | 2 MiB |
| `POST /api/v1/evidence/open` | 1024 B |
| `POST /api/v1/evidence/commit` | 5 596 504 B |
| `POST /api/v1/submission` | 1024 B |
| `POST /api/prijavi-problem` | 8192 B |

Bez sesije stranica nudi „Prijava preko AAI@EduHr” (`/api/v1/auth/login?returnTo=…`).

| Stranica | Što radi |
| --- | --- |
| `/` | moji zadaci i moji dokumenti |
| `/doc/:id` | uređivanje i spremanje dokumenta; traka za spremanje ostaje iznad zaslonske tipkovnice |
| `/rad/[assignmentId]` | pisanje i predaja studentskog rada za zadatak (`GET /api/v1/student/assignments`, zatim BFF rute za dokaze i predaju) |
| `/pristup/[documentId]` | dnevnik pristupa studentovu radu (`GET /api/v1/student/works/:documentId/access-log`) |
| `/prijavi-problem` | prijava problema podršci (`POST /api/prijavi-problem`) |

Stare poveznice `/#/doc/:id` otvaraju `/doc/:id`.

| Env varijabla | Značenje |
| --- | --- |
| `INSTITUTION_SERVER_URL` | adresa Institution_servera (samo poslužitelj) |
| `BASE_PATH` | osnovna putanja pri buildu, npr. `/app/mobile` iza edge proxyja; zadano prazno |

## Funkcionalna provjera

Korisnik može uređivati dokument i spremiti izmjenu dok je zaslonska tipkovnica otvorena.
Pokriva je `tests/e2e/edit-with-keyboard.spec.js` na emuliranom Androidu (Pixel 7), iPhoneu i iPadu,
nad produkcijskim buildom i lažnim Institution_serverom (`tests/e2e/lazni-server.mjs`, izmišljeni podaci).
Tipkovnica se oponaša smanjenjem vidljivog dijela zaslona; pravi uređaji provjeravaju se ručno prije izdanja.

## Pokretanje

```bash
pnpm install
LAZNI_PORT=4000 pnpm fake-server   # bez pravog Institution_servera
pnpm dev                           # http://localhost:5174
pnpm lint
pnpm test:helpers
pnpm exec playwright install chromium webkit
pnpm test:functional
```
