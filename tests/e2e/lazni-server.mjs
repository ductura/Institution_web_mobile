// Fake Institution_server for e2e and local work without the real one: the
// in-memory document API the old dev-server.mjs had, now under /api/v1.
// Only invented data. It does not check the session; one fixed id answers 401.
import { createServer } from "node:http";

const PORT = Number(process.env.LAZNI_PORT ?? 4099);
const docs = new Map([
  ["demo-1", { id: "demo-1", title: "Seminarski rad", content: "Uvod u temu." }],
  ["demo-2", { id: "demo-2", title: "Bilješke s predavanja", content: "" }],
]);

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/__zdravlje") return json(res, 200, { ok: true });
  if (url.pathname === "/api/v1/documents" && req.method === "GET") return json(res, 200, [...docs.values()]);
  const m = url.pathname.match(/^\/api\/v1\/documents\/([\w-]+)$/);
  if (!m) return json(res, 404, { error: "nema" });
  // A session that has ended, so the page's login link can be checked.
  if (m[1] === "istekla-sesija") return json(res, 401, { error: "nije_prijavljen" });
  const doc = docs.get(m[1]);
  if (!doc) return json(res, 404, { error: "nema" });
  if (req.method === "PUT") {
    let raw = "";
    for await (const c of req) raw += c;
    const body = JSON.parse(raw || "{}");
    docs.set(doc.id, { ...doc, title: body.title ?? doc.title, content: body.content ?? doc.content });
  } else if (req.method !== "GET") return json(res, 405, { error: "metoda" });
  return json(res, 200, docs.get(doc.id));
});

server.listen(PORT, "127.0.0.1", () => console.log(`lazni Institution_server na http://127.0.0.1:${PORT}`));
