import { afterEach, expect, test, vi } from "vitest";
import { dohvatiDnevnikPristupa } from "../src/server/access-log.js";
import { KOLACIC } from "../src/server/institution-server.js";

const documentId = "demo-rad";
const kolacic = "demo-sesija";
const zapis = {
  id: "d0050000-0000-4000-8000-000000000005",
  at: "2026-11-19T08:35:00.000Z",
  role: "teacher",
  surface: "live_view",
  reader: { givenName: "Izmišljena", familyName: "Nastavnica" },
};
const prije = { beforeAt: zapis.at, beforeId: zapis.id };
const dnevnik = { entries: [zapis], next: null, continued: false };

/** @param {Response} odgovor */
function posluzi(odgovor) {
  const fetcher = vi.fn().mockResolvedValue(odgovor);
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

test("čita dnevnik prema ID-u dokumenta i prosljeđuje sesiju i kursor", async () => {
  const stranica = { ...dnevnik, continued: true };
  const fetcher = posluzi(Response.json(stranica));
  expect(await dohvatiDnevnikPristupa(documentId, kolacic, prije)).toEqual({ status: 200, dnevnik: stranica });
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, opcije] = fetcher.mock.calls[0];
  const zahtjev = new URL(url);
  expect(zahtjev.pathname).toBe(`/api/v1/student/works/${documentId}/access-log`);
  expect(Object.fromEntries(zahtjev.searchParams)).toEqual(prije);
  expect(opcije).toMatchObject({ method: "GET", headers: { cookie: `${KOLACIC}=${kolacic}` }, cache: "no-store" });
});

test("prihvaća prazan dnevnik", async () => {
  const prazno = { entries: [], next: null, continued: false };
  posluzi(Response.json(prazno));
  expect(await dohvatiDnevnikPristupa(documentId, kolacic)).toEqual({ status: 200, dnevnik: prazno });
});

test.each([
  ["pogrešan UUID", { entries: [zapis, { ...zapis, id: "demo" }] }],
  ["nemoguć datum", { entries: [{ ...zapis, at: "2026-02-30T08:35:00.000Z" }] }],
  ["vrijeme izvan petominutnog intervala", { entries: [{ ...zapis, at: "2026-11-19T08:36:00.000Z" }] }],
  ["nedopuštena uloga", { entries: [{ ...zapis, role: "admin" }] }],
  ["neispravan kursor", { next: { ...prije, beforeId: "demo" } }],
])("odbija cijeli odgovor za slučaj %s", async (_, polja) => {
  posluzi(Response.json({ ...dnevnik, ...polja }));
  expect(await dohvatiDnevnikPristupa(documentId, kolacic)).toEqual({ status: 503 });
});

test("neispravan JSON daje stanje nedostupnosti", async () => {
  posluzi(new Response("{", { headers: { "content-type": "application/json" } }));
  expect(await dohvatiDnevnikPristupa(documentId, kolacic)).toEqual({ status: 503 });
});

test("bez sesije ne poziva poslužitelj", async () => {
  const fetcher = posluzi(Response.json(dnevnik));
  expect(await dohvatiDnevnikPristupa(documentId, null)).toEqual({ status: 401 });
  expect(fetcher).not.toHaveBeenCalled();
});

test.each([401, 403, 404, 503])("vraća status %i poslužitelja", async (status) => {
  posluzi(new Response(null, { status }));
  expect(await dohvatiDnevnikPristupa(documentId, kolacic)).toEqual({ status });
});
