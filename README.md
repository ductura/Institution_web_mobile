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

Bez sesije stranica nudi „Prijava preko AAI@EduHr” (`/api/v1/auth/login?returnTo=…`).

| Stranica | Što radi |
| --- | --- |
| `/` | moji dokumenti |
| `/doc/:id` | uređivanje i spremanje dokumenta; traka za spremanje ostaje iznad zaslonske tipkovnice |

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

## Provjere (CI)

`pnpm lint`, `pnpm typecheck` (tsc, checkJs), `pnpm test:helpers`, `pnpm build`, `pnpm test:functional`; CI ih vrti na PR-ovima i pushu na `main` i `migracija/nextjs`.

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
