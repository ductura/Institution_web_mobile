import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { canonicalJson, validateInput } from "@ductura/contracts";

const evidenceDomainId = "d0020000-0000-4000-8000-000000000002";
const principalId = "d0030000-0000-4000-8000-000000000003";
const profile = "demo-pisanje";
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const key = {
  algorithm: "Ed25519", keyId: "demo-potpis", keyVersion: "1", encoding: "spki-der", evidenceDomainId,
  keyBase64Url: publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
  purpose: "receipt", validFrom: "2025-01-01T00:00:00.000Z", validTo: null, revokedAt: null,
};
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const zero = Buffer.from(canonicalJson({
  schemaVersion: 2, nodes: [{ id: "00000000-0000-4000-8000-000000000000", type: "paragraph", children: [] }], sources: [],
}));
const revisionZeroHash = sha256(zero);
const works = new Map();

function signed(payload) {
  const digest = createHash("sha256").update(canonicalJson(payload)).digest();
  const input = Buffer.concat([Buffer.from(`${payload.receiptSchema}\n`), digest]);
  return {
    payload, payloadDigestSha256: digest.toString("hex"),
    signature: { algorithm: key.algorithm, keyId: key.keyId, keyVersion: key.keyVersion, signatureEncoding: "raw",
      signatureBase64Url: sign(null, input, privateKey).toString("base64url") },
  };
}

function commit(work, input, json, res) {
  const { documentId } = work;
  const existing = work.commits.get(input.clientTransactionId);
  if (existing) {
    if (existing.input !== canonicalJson(input)) return json(res, 409, { status: "txid_reused" });
    return json(res, 200, { status: "duplicate", revision: existing.revision, receipt: existing.receipt });
  }
  if (work.submissions) return json(res, 409, { status: "not_accepting" });
  if (work.revision !== input.baseRevision) return json(res, 409, { status: "stale_base", currentRevision: work.revision });
  const packed = Buffer.from(input.segments[0], "base64");
  const document = Buffer.from(input.document, "base64");
  const segment = JSON.parse(packed.toString("utf8"));
  if (segment.documentId !== documentId || segment.evidenceProfileId !== profile ||
      segment.predecessorSegmentHash !== work.head || segment.sequenceFrom !== work.sequence + 1 ||
      segment.events[0]?.beforeDocumentHash !== sha256(work.document) || segment.finalDocumentHash !== sha256(document)) {
    return json(res, 422, { status: "document_mismatch" });
  }
  const segmentHash = sha256(packed);
  const revision = work.revision + 1;
  const receipt = { status: "signed", signedReceipt: signed({
    receiptSchema: "ductus-evidence-receipt-v2", receiptId: randomUUID(), evidencePackageId: "demo-paket",
    documentId, sessionId: segment.sessionId, segmentId: segment.segmentId, segmentHash,
    predecessorSegmentHash: work.head, previousReceiptId: work.lastReceipt,
    evidenceSchema: segment.evidenceSchema, evidenceProfileId: profile,
    sequenceFrom: segment.sequenceFrom, sequenceTo: segment.sequenceTo,
    eventCount: segment.events.length, payloadBytes: packed.length,
    acceptedAt: new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString(),
    revision, clientTransactionId: input.clientTransactionId, evidenceDomainId, principalId,
  }) };
  Object.assign(work, { revision, head: segmentHash, sequence: segment.sequenceTo, document,
    lastReceipt: receipt.signedReceipt.payload.receiptId });
  work.commits.set(input.clientTransactionId, { input: canonicalJson(input), revision, receipt });
  return json(res, 200, { status: "committed", revision, receipt });
}

function submit(work, input, json, res) {
  const { assignmentId, documentId } = work;
  if (input.revision !== work.revision) return json(res, 409, { status: "stale_revision", currentRevision: work.revision });
  if (work.revision === 0) return json(res, 409, { status: "blocked", reason: "no_evidence" });
  const now = new Date().toISOString().replace("Z", "000Z");
  work.submissions ??= signed({
    receiptSchema: "ductus-submission-receipt-v2", submissionId: randomUUID(), evidenceDomainId, principalId,
    assignmentId, assignmentVersion: 1, documentId, evidencePackageId: "demo-paket",
    revision: work.revision, artifactSha256: sha256(work.document), evidenceHeadSegmentHash: work.head,
    evidenceRecord: "continuous", requestedAt: now, signedAt: now, dueAt: "2030-01-01T00:00:00.000000Z", afterDeadline: false,
  });
  return json(res, 200, { status: "submitted", receipt: work.submissions });
}

export async function studentWorkRoute(req, res, path, json) {
  if (path === "/__rad/otvori" && req.method === "POST") {
    const assignmentId = randomUUID();
    const documentId = `demo-${assignmentId}`;
    const title = `Gradski vrtovi ${works.size + 1}`;
    works.set(documentId, { assignmentId, documentId, title, revision: 0, head: null, sequence: 0, document: zero,
      submissions: null, lastReceipt: null, commits: new Map() });
    json(res, 200, { documentId, title });
    return true;
  }
  if (path === "/api/v1/student/assignments" && req.method === "GET") {
    const assignments = [...works.values()].map(({ assignmentId, title }) => ({
      id: assignmentId, title, dueAt: "2030-01-01T00:00:00.000Z", noticeFirst: false,
    }));
    json(res, 200, { courses: [{ id: "d0040000-0000-4000-8000-000000000004", name: "Izmišljeni kolegij", assignments }] });
    return true;
  }
  const accessLog = /^\/api\/v1\/student\/works\/([^/]+)\/access-log$/.exec(path);
  if (accessLog && req.method === "GET") {
    const cookie = req.headers.cookie;
    if (cookie === "__Host-ductus_session=demo-zabranjeno") {
      json(res, 403, { error: "forbidden" });
    } else if (cookie !== "__Host-ductus_session=demo-pristup") {
      json(res, 401, { error: "unauthorized" });
    } else if (!works.has(accessLog[1])) {
      json(res, 404, { error: "not_found" });
    } else {
      const id = "d0050000-0000-4000-8000-000000000005";
      const at = "2026-11-19T23:35:00.000Z";
      const query = new URL(req.url, "http://localhost").searchParams;
      const continued = query.get("beforeAt") === at && query.get("beforeId") === id;
      const entry = continued ? {
        id: "d0060000-0000-4000-8000-000000000006", at: "2026-11-19T17:00:00.000Z",
        role: "teacher", surface: "process_summary", reader: null,
      } : {
        id, at, role: "mentor", surface: "live_view",
        reader: { givenName: "Izmišljena", familyName: "MentoricaIzDugogIzmišljenogNazivaSeminarskeGrupe".repeat(2) },
      };
      json(res, 200, { entries: [entry], next: continued ? null : { beforeAt: at, beforeId: id }, continued });
    }
    return true;
  }
  const operations = {
    "/api/v1/evidence/open": "evidence.open.post",
    "/api/v1/evidence/commit": "evidence.commit.post",
    "/api/v1/submission": "submission.submit.post",
  };
  if (!Object.hasOwn(operations, path) || req.method !== "POST") return false;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    const body = JSON.parse(raw);
    if (!req.headers.origin || req.headers["ductus-protocol"] !== "1" || !validateInput(operations[path], "body", body)) {
      json(res, 422, { status: "invalid" });
      return true;
    }
    const work = works.get(path.endsWith("/open") ? `demo-${body.assignmentId}` : body.documentId);
    if (!work) json(res, 404, { status: "not_found" });
    else if (path.endsWith("/open")) {
      json(res, 200, { status: "opened", documentId: work.documentId, evidenceProfileId: profile, revisionZeroHash, schemaVersion: 2,
        currentRevision: work.revision, receiptKeys: [key], documentHash: sha256(work.document),
        headSegmentHash: work.head, lastSequenceTo: work.sequence, document: work.document.toString("base64"),
        submitted: work.submissions !== null });
    } else if (path.endsWith("/commit")) commit(work, body, json, res);
    else submit(work, body, json, res);
  } catch {
    json(res, 400, { status: "bad_request" });
  }
  return true;
}
