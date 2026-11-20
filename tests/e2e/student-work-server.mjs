import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { canonicalJson, validateInput } from "@ductura/contracts";

export const assignmentId = "d0010000-0000-4000-8000-000000000001";
export const resetWorkPath = "/__rad/ponisti";
const documentId = "demo-studentski-rad";
const evidenceDomainId = "d0020000-0000-4000-8000-000000000002";
const principalId = "d0030000-0000-4000-8000-000000000003";
const profile = "demo-pisanje";
const draft = "Seminarski rad o gradskim vrtovima";
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
const initial = () => ({ revision: 0, head: null, sequence: 0, document: zero,
  submissions: null, lastReceipt: null, commits: new Map() });
let work = initial();

function signed(payload) {
  const digest = createHash("sha256").update(canonicalJson(payload)).digest();
  const input = Buffer.concat([Buffer.from(`${payload.receiptSchema}\n`), digest]);
  return {
    payload, payloadDigestSha256: digest.toString("hex"),
    signature: { algorithm: key.algorithm, keyId: key.keyId, keyVersion: key.keyVersion, signatureEncoding: "raw",
      signatureBase64Url: sign(null, input, privateKey).toString("base64url") },
  };
}

function commit(input, json, res) {
  const existing = work.commits.get(input.clientTransactionId);
  if (existing) {
    if (existing.input !== canonicalJson(input)) return json(res, 409, { status: "txid_reused" });
    return json(res, 200, { status: "duplicate", revision: existing.revision, receipt: existing.receipt });
  }
  if (input.documentId !== documentId) return json(res, 404, { status: "not_found" });
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
  work = { ...work, revision, head: segmentHash, sequence: segment.sequenceTo, document,
    lastReceipt: receipt.signedReceipt.payload.receiptId };
  work.commits.set(input.clientTransactionId, { input: canonicalJson(input), revision, receipt });
  return json(res, 200, { status: "committed", revision, receipt });
}

function submit(input, json, res) {
  if (input.documentId !== documentId) return json(res, 404, { status: "not_found" });
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
  if (path === resetWorkPath && req.method === "POST") {
    work = initial();
    json(res, 200, { ok: true });
    return true;
  }
  if (path === "/api/v1/student/assignments" && req.method === "GET") {
    json(res, 200, { courses: [{ id: "d0040000-0000-4000-8000-000000000004", name: "Izmišljeni kolegij",
      assignments: [{ id: assignmentId, title: draft, dueAt: "2030-01-01T00:00:00.000Z", noticeFirst: false }] }] });
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
    } else if (path.endsWith("/open")) {
      if (body.assignmentId !== assignmentId) json(res, 404, { status: "not_found" });
      else json(res, 200, { status: "opened", documentId, evidenceProfileId: profile, revisionZeroHash, schemaVersion: 2,
        currentRevision: work.revision, receiptKeys: [key], documentHash: sha256(work.document),
        headSegmentHash: work.head, lastSequenceTo: work.sequence, document: work.document.toString("base64"),
        submitted: work.submissions !== null });
    } else if (path.endsWith("/commit")) commit(body, json, res);
    else submit(body, json, res);
  } catch {
    json(res, 400, { status: "bad_request" });
  }
  return true;
}
