import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import * as popis from '../app/api/documents/route.js';
import * as dokument from '../app/api/documents/[id]/route.js';
import { POST as rad } from '../app/api/v1/[...work]/route.js';
import { izvuciKolacic } from '../src/server/institution-server.js';
import { procitajMutaciju } from '../src/server/bff.js';

let pozivi;
let odgovori;
const pravi = globalThis.fetch;
beforeEach(() => {
  pozivi = [];
  odgovori = [];
  process.env.INSTITUTION_SERVER_URL = 'http://server.test:4000/';
  globalThis.fetch = async (url, init) => {
    pozivi.push({ url, ...init });
    const o = odgovori.shift();
    if (o instanceof Error) throw o;
    return o;
  };
});
afterEach(() => {
  globalThis.fetch = pravi;
  delete process.env.INSTITUTION_SERVER_URL;
});

const json = (tijelo, status = 200) =>
  new Response(JSON.stringify(tijelo), { status, headers: { 'content-type': 'application/json' } });
const KOLACIC = '__Host-ductus_session=s3sija';
const zahtjev = (putanja, init = {}) => new Request(`http://127.0.0.1:5174/api${putanja}`, init);
const params = (id) => ({ params: Promise.resolve({ id }) });
const put = (tijelo, zaglavlja = {}) => ({
  method: 'PUT',
  headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', cookie: KOLACIC, ...zaglavlja },
  body: typeof tijelo === 'string' ? tijelo : JSON.stringify(tijelo),
});

test('GET /api/documents čita /api/v1/documents i prenosi samo kolačić sesije', async () => {
  odgovori.push(json([{ id: 'd-1', title: 'Rad', content: 'x', tajno: 1 }, { id: '../x', title: 'Ne' }]));
  const res = await popis.GET(zahtjev('/documents', { headers: { cookie: `drugi=1; ${KOLACIC}` } }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), [{ id: 'd-1', title: 'Rad' }]);
  assert.equal(pozivi[0].url, 'http://server.test:4000/api/v1/documents');
  assert.equal(pozivi[0].headers.cookie, KOLACIC);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('401, 404 i nedostupan poslužitelj', async () => {
  odgovori.push(json({}, 401));
  assert.equal((await popis.GET(zahtjev('/documents'))).status, 401);
  assert.equal(pozivi[0].headers.cookie, undefined);
  odgovori.push(json({}, 404));
  assert.equal((await dokument.GET(zahtjev('/documents/d-1'), params('d-1'))).status, 404);
  odgovori.push(new Error('ECONNREFUSED'));
  assert.equal((await popis.GET(zahtjev('/documents'))).status, 502);
  odgovori.push(json({ id: 'd-1' }));
  assert.equal((await dokument.GET(zahtjev('/documents/d-1'), params('d-1'))).status, 502);
});

test('neispravan id ne ide na poslužitelj', async () => {
  const res = await dokument.GET(zahtjev('/documents/x'), params('../me'));
  assert.equal(res.status, 404);
  assert.equal(pozivi.length, 0);
});

test('PUT šalje naslov i sadržaj na /api/v1/documents/:id', async () => {
  odgovori.push(json({ id: 'd-1', title: 'N', content: 'S' }));
  const res = await dokument.PUT(zahtjev('/documents/d-1', put({ id: 'd-1', title: 'N', content: 'S', x: 1 })), params('d-1'));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: 'd-1', title: 'N', content: 'S' });
  assert.equal(pozivi[0].url, 'http://server.test:4000/api/v1/documents/d-1');
  assert.equal(pozivi[0].method, 'PUT');
  assert.deepEqual(JSON.parse(pozivi[0].body), { id: 'd-1', title: 'N', content: 'S' });
});

test('PUT odbija tuđe podrijetlo, ne-JSON i neispravno tijelo', async () => {
  const s = async (init) => (await dokument.PUT(zahtjev('/documents/d-1', init), params('d-1'))).status;
  assert.equal(await s(put({ title: 'a', content: 'b' }, { 'sec-fetch-site': 'cross-site' })), 403);
  assert.equal(await s(put('title=a', { 'content-type': 'application/x-www-form-urlencoded' })), 415);
  assert.equal(await s(put('{')), 400);
  assert.equal(await s(put({ title: 'a' })), 400);
  assert.equal(await s(put({ id: 'd-2', title: 'a', content: 'b' })), 400);
  assert.equal(pozivi.length, 0);
});

test('ostale metode: 405', async () => {
  const res = await popis.POST();
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET');
  assert.equal((await dokument.DELETE()).headers.get('allow'), 'GET, PUT');
});

test('izvuciKolacic', () => {
  assert.equal(izvuciKolacic('a=1; __Host-ductus_session=abc'), 'abc');
  assert.equal(izvuciKolacic('ductus_session=abc'), null);
  assert.equal(izvuciKolacic('__Host-ductus_session=a b'), null);
  assert.equal(izvuciKolacic(undefined), null);
});

test('predaja prosljeđuje samo identitet dokumenta i reviziju kroz zajednički ugovor', async () => {
  const input = { documentId: 'demo-rad', revision: 2 };
  const init = (body, origin = 'http://127.0.0.1:5174') => ({
    ...put(body, { origin }), method: 'POST',
  });
  const ctx = { params: Promise.resolve({ work: ['submission'] }) };
  assert.equal((await rad(zahtjev('/v1/submission', init(input, 'https://drugi.test')), ctx)).status, 403);
  assert.equal((await rad(zahtjev('/v1/submission', init({ ...input, content: 'višak' })), ctx)).status, 422);
  assert.equal(pozivi.length, 0);
  odgovori.push(json({ status: 'stale_revision', currentRevision: 3 }, 409));
  const res = await rad(zahtjev('/v1/submission', init(input)), ctx);
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { status: 'stale_revision', currentRevision: 3 });
  assert.equal(pozivi[0].url, 'http://server.test:4000/api/v1/submission');
  assert.equal(pozivi[0].headers['ductus-protocol'], '1');
  assert.equal(pozivi[0].headers.origin, 'http://127.0.0.1:5174');
  assert.equal(pozivi[0].headers.cookie, KOLACIC);
  assert.deepEqual(JSON.parse(pozivi[0].body), input);
});

// Body limit: refused from the declared Content-Length, or as soon as the
// stream passes the limit, never by reading the whole body first.
const MUTACIJA = { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
const tok = (dijelovi) => {
  const stanje = { procitano: 0, otkazano: false };
  const kodiraj = new TextEncoder();
  const stream = new ReadableStream({
    pull(c) {
      if (stanje.procitano === dijelovi.length) return c.close();
      c.enqueue(kodiraj.encode(dijelovi[stanje.procitano++]));
    },
    cancel() { stanje.otkazano = true; },
  }, { highWaterMark: 0 });
  return { stream, stanje };
};
/** Streaming body needs `duplex`, which the DOM RequestInit type does not list yet. */
const sTokomNa = (url, stream, zaglavlja) => {
  /** @type {RequestInit & { duplex: 'half' }} */
  const init = { method: 'POST', headers: zaglavlja, body: stream, duplex: 'half' };
  return new Request(url, init);
};
const sTokom = (stream, zaglavlja = {}) =>
  sTokomNa('http://127.0.0.1:5174/api/x', stream, { ...MUTACIJA, ...zaglavlja });
/** @param {{tijelo: unknown} | {odbijeno: Response}} r */
const odbijen = (r) => ('odbijeno' in r ? r.odbijeno : null);
/** @param {{tijelo: unknown} | {odbijeno: Response}} r */
const tijeloOd = (r) => ('tijelo' in r ? r.tijelo : undefined);

test('preveliki Content-Length: 413 bez čitanja tijela', async () => {
  const { stream, stanje } = tok(['{}']);
  const r = await procitajMutaciju(sTokom(stream, { 'content-length': '101' }), 100);
  assert.equal(odbijen(r)?.status, 413);
  assert.deepEqual(await odbijen(r)?.json(), { greska: 'prevelik_zahtjev' });
  assert.equal(stanje.procitano, 0);
});

test('bez Content-Length: čitanje staje čim tijelo prijeđe ograničenje', async () => {
  const komad = 'x'.repeat(40);
  const { stream, stanje } = tok(['["', komad, komad, komad, komad, komad, '"]']);
  const r = await procitajMutaciju(sTokom(stream), 100);
  assert.equal(odbijen(r)?.status, 413);
  assert.ok(stanje.procitano < 7, `pročitano ${stanje.procitano} od 7 dijelova`);
  assert.equal(stanje.otkazano, true);
});

test('Content-Length koji umanjuje tijelo ne zaobilazi ograničenje', async () => {
  const { stream, stanje } = tok(['["', 'y'.repeat(200), '"]']);
  const r = await procitajMutaciju(sTokom(stream, { 'content-length': '10' }), 100);
  assert.equal(odbijen(r)?.status, 413);
  assert.equal(stanje.otkazano, true);
});

test('tijelo točno do ograničenja prolazi, i UTF-8 znak razlomljen među dijelovima', async () => {
  const bajtovi = new TextEncoder().encode('{"t":"čć"}');
  let i = 0;
  const stream = new ReadableStream({
    pull(c) { if (i < bajtovi.length) c.enqueue(bajtovi.slice(i, ++i)); else c.close(); },
  });
  const r = await procitajMutaciju(sTokom(stream), bajtovi.length);
  assert.deepEqual(tijeloOd(r), { t: 'čć' });
  const malo = await procitajMutaciju(new Request('http://127.0.0.1:5174/api/x', {
    method: 'POST', headers: MUTACIJA, body: '\uFEFF{"a":1}',
  }), 100);
  assert.deepEqual(tijeloOd(malo), { a: 1 }, 'BOM se uklanja kao u Request.text()');
  const prazno = await procitajMutaciju(new Request('http://127.0.0.1:5174/api/x', { method: 'POST', headers: MUTACIJA }));
  assert.equal(odbijen(prazno)?.status, 400);
});

test('neispravan Content-Length ne odbija sam po sebi; ograničenje i dalje vrijedi', async () => {
  const { stream } = tok(['{"a":', '2}']);
  const r = await procitajMutaciju(sTokom(stream, { 'content-length': 'abc' }), 100);
  assert.deepEqual(tijeloOd(r), { a: 2 });
});

test('preveliko tijelo na ruti predaje: 413 i ništa ne ide na poslužitelj', async () => {
  const ctx = { params: Promise.resolve({ work: ['submission'] }) };
  const init = { ...put({ documentId: 'demo-rad', revision: 2, x: 'z'.repeat(2000) }, { origin: 'http://127.0.0.1:5174' }), method: 'POST' };
  const res = await rad(zahtjev('/v1/submission', init), ctx);
  assert.equal(res.status, 413);
  const { stream, stanje } = tok(['{"documentId":"', 'd'.repeat(600), 'd'.repeat(600), '"}']);
  const res2 = await rad(sTokomNa('http://127.0.0.1:5174/api/v1/submission', stream,
    { ...MUTACIJA, origin: 'http://127.0.0.1:5174', cookie: KOLACIC }), ctx);
  assert.equal(res2.status, 413);
  assert.equal(stanje.otkazano, true);
  assert.equal(pozivi.length, 0);
});
