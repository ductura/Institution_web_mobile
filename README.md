# Ductura / web-mobile

Mobilni frontend za mobitele i tablete. Preloader ovamo šalje sve mobilne uređaje, bez obzira na preglednik.

## Funkcionalna provjera

Korisnik može uređivati dokument i spremiti izmjenu dok je zaslonska tipkovnica otvorena.
Pokriva je `e2e/edit-with-keyboard.spec.js` na emuliranom Androidu (Pixel 7), iPhoneu i iPadu.
Tipkovnica se oponaša smanjenjem vidljivog dijela zaslona; pravi uređaji provjeravaju se ručno prije izdanja.

## Pokretanje

```bash
npm install
npm run dev                 # http://localhost:5173 s memorijskim API-jem
npm run test:helpers
npx playwright install chromium webkit
npm run test:functional
```
