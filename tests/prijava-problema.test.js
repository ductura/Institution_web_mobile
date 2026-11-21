// @vitest-environment jsdom
import { canonicalJson } from "@ductura/contracts";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { POST } from "../app/api/prijavi-problem/route.js";
import PrijavaProblema from "../src/components/PrijavaProblema.jsx";

vi.mock("../node_modules/.ductura-mobile/ui.mjs", () => ({
  Button: ({ busy, ...props }) => createElement("button", { ...props, disabled: busy }),
}));
vi.mock("../node_modules/.ductura-mobile/prijava-problema.mjs", () => ({
  Select: ({ label, options, busy, ...props }) => createElement("label", null, label,
    createElement("select", { ...props, disabled: busy },
      options.map(({ value, label }) => createElement("option", { key: value, value }, label)))),
  TextArea: ({ label, hint, busy, ...props }) => createElement("label", null, label,
    createElement("textarea", { ...props, readOnly: busy })),
}));

const ORIGIN = "http://127.0.0.1:5174";
const SERVER = "http://server.test:4000";
const ULAZ = {
  syncState: null, route: null, description: "Na pokusnom zaslonu gumb ne reagira.",
  category: "technical", browser: { major: null, family: "other" }, appVersion: "0.2.0",
};
const REFERENCA = "PR-0A1B2C3D4E";
const fetchStub = vi.fn();

beforeEach(() => {
  fetchStub.mockReset();
  vi.stubEnv("INSTITUTION_SERVER_URL", SERVER);
  vi.stubGlobal("fetch", fetchStub);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

const zahtjev = (body = ULAZ, headers = {}) => new Request(`${ORIGIN}/api/prijavi-problem`, {
  method: "POST",
  headers: { origin: ORIGIN, "content-type": "application/json", cookie: "__Host-ductus_session=demo-sesija; drugo=demo", ...headers },
  body: JSON.stringify(body),
});

test.each([
  ["unos izvan sheme", 422, { ...ULAZ, category: "other" }, {}],
  ["strani origin", 403, ULAZ, { origin: "http://drugi.test" }],
  ["drugi protokol", 403, ULAZ, { origin: "https://127.0.0.1:5174" }],
  ["stranica izvan origina", 403, ULAZ, { "sec-fetch-site": "same-site" }],
  ["preveliko tijelo", 413, { ...ULAZ, description: "č".repeat(4097) }, {}],
  ["tijelo izvan JSON-a", 415, ULAZ, { "content-type": "text/plain" }],
  ["nedostaje sesija", 401, ULAZ, { cookie: "" }],
])("%s vraća %i bez poziva poslužitelja", async (_opis, status, tijelo, zaglavlja) => {
  expect((await POST(zahtjev(tijelo, zaglavlja))).status).toBe(status);
  expect(fetchStub).not.toHaveBeenCalled();
});

test("BFF šalje kanonski JSON i vraća oznaku potvrđene prijave", async () => {
  fetchStub.mockResolvedValue(Response.json({ reference: REFERENCA }, { status: 201 }));
  const res = await POST(zahtjev());
  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ reference: REFERENCA });
  expect(fetchStub).toHaveBeenCalledExactlyOnceWith(`${SERVER}/api/v1/support/problem-report`, expect.objectContaining({
    method: "POST",
    body: canonicalJson(ULAZ),
    headers: expect.objectContaining({
      origin: ORIGIN, cookie: "__Host-ductus_session=demo-sesija", "ductus-protocol": "1",
    }),
  }));
});

test("obrazac prikazuje oznaku i briše nacrt nakon potvrđenog zapisa", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetchStub.mockResolvedValue(Response.json({ reference: REFERENCA }, { status: 201 }));
  const kljuc = "ductura:/prijavi-problem";
  sessionStorage.setItem(kljuc, JSON.stringify(ULAZ));
  const element = document.createElement("div");
  const root = createRoot(element);
  try {
    await act(async () => root.render(createElement(PrijavaProblema, { verzija: ULAZ.appVersion })));
    expect(element.querySelector("textarea").value).toBe(ULAZ.description);
    await act(async () => element.querySelector("form").dispatchEvent(new Event("submit", {
      bubbles: true, cancelable: true,
    })));
    expect(JSON.parse(fetchStub.mock.calls[0][1].body)).toEqual(ULAZ);
    expect(element.querySelector("[role=status]").textContent).toContain(REFERENCA);
    expect(sessionStorage.getItem(kljuc)).toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});
