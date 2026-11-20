import { canonicalJson } from "@ductura/contracts";
import {
  EvidenceRecorder, SourceObserver, recordWithSource, StorableInput, createEditorExtensions,
  createEditorExtensionsV2, createEditorExtensionsV3, canonicalToTiptap, canonicalToTiptapV2,
  canonicalToTiptapV3, verifyWorkOpening, verifySignedEvidenceReceiptV2,
} from "../../node_modules/.ductura-mobile/editor-core.mjs";
import { api } from "./putanje.js";

const SHA256 = /^[\da-f]{64}$/;
function b64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
const fromB64 = (text) => Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
const fromB64Url = (text) => fromB64(text.replaceAll("-", "+").replaceAll("_", "/"));

async function post(path, body) {
  const response = await fetch(api(`/v1/${path}`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { http: response.status, body: await response.json() };
}

export async function openStudentWork(assignmentId) {
  const { http, body } = await post("evidence/open", { assignmentId, start: true });
  if (http === 401) return "odjavljen";
  if (http !== 200 || body?.status !== "opened" || typeof body.submitted !== "boolean") return null;
  const { documentId, receiptKeys, revisionZeroHash, evidenceProfileId, lastSequenceTo, headSegmentHash } = body;
  const evidenceDomainId = receiptKeys?.[0]?.evidenceDomainId;
  if (typeof documentId !== "string" || !Array.isArray(receiptKeys) || typeof evidenceDomainId !== "string" ||
      typeof evidenceProfileId !== "string" || !Number.isSafeInteger(lastSequenceTo) || lastSequenceTo < 0 ||
      (headSegmentHash !== null && !SHA256.test(headSegmentHash))) return null;
  const work = await verifyWorkOpening(documentId, { ...body, document: fromB64(body.document) },
    revisionZeroHash === undefined ? undefined : { documentId, sha256: revisionZeroHash });
  if (!work || (body.schemaVersion !== undefined && body.schemaVersion !== work.schemaVersion)) return null;
  return { work, evidenceProfileId, evidenceDomainId, receiptKeys, lastSequenceTo, headSegmentHash, submitted: body.submitted };
}

export function editorContent(document, placeholder) {
  switch (document.schemaVersion) {
    case 1: return { content: canonicalToTiptap(document), extensions: createEditorExtensions(placeholder) };
    case 2: return { content: canonicalToTiptapV2(document), extensions: createEditorExtensionsV2(placeholder) };
    case 3: return { content: canonicalToTiptapV3(document), extensions: createEditorExtensionsV3(placeholder) };
  }
}

export function createWorkSync(opened, report) {
  const { work, evidenceProfileId, evidenceDomainId, receiptKeys } = opened;
  const { documentId, schemaVersion } = work;
  let revision = work.revision;
  let lastSequence = opened.lastSequenceTo;
  let head = opened.headSegmentHash;
  let dirty = false;
  let stopped = false;
  let disposed = false;
  let pending = null;
  let running = null;
  let timer;
  const recorder = new EvidenceRecorder(undefined, schemaVersion);
  const observer = new SourceObserver();
  const sessionId = crypto.randomUUID();

  async function drain() {
    while (!disposed && (dirty || pending)) {
      if (!pending) {
        dirty = false;
        recorder.close();
        const built = await recorder.takeSegment({ documentId, sessionId, evidenceProfileId,
          segmentId: crypto.randomUUID(), sequenceFrom: lastSequence + 1, predecessorSegmentHash: head });
        if (!built) continue;
        pending = { built, clientTransactionId: crypto.randomUUID() };
      }
      const { built, clientTransactionId } = pending;
      const response = await post("evidence/commit", {
        documentId, clientTransactionId, baseRevision: revision,
        segments: [b64(built.bytes)], document: b64(built.document),
      });
      if (response.http === 409) {
        stopped = true;
        report("CONFLICT");
        return false;
      }
      const result = response.body;
      if (response.http !== 200 || (result?.status !== "committed" && result?.status !== "duplicate") ||
          result.revision !== revision + 1 || result.receipt?.status !== "signed") throw new Error("commit");
      const verified = await verifySignedEvidenceReceiptV2(result.receipt.signedReceipt, {
        documentId, clientTransactionId, revision: result.revision, evidenceDomainId,
      }, receiptKeys);
      if (!verified.ok || verified.payload.segmentHash !== built.sha256) throw new Error("receipt");
      head = built.sha256;
      lastSequence = built.segment.sequenceTo;
      revision = result.revision;
      pending = null;
      // A segment can hold only part of the changes which have been recorded.
      dirty = true;
    }
    if (disposed) return false;
    report("SYNCED");
    return true;
  }

  function flush() {
    clearTimeout(timer);
    if (stopped) return Promise.resolve(false);
    if (running) return running;
    if (!dirty && !pending) return Promise.resolve(true);
    report("SYNCING");
    running = drain().catch(() => {
      if (!recorder.intact) stopped = true;
      report("ERROR");
      return false;
    }).finally(() => { running = null; });
    return running;
  }

  return {
    flush,
    hasChanges: () => dirty || pending !== null || running !== null || stopped,
    submission: () => ({ documentId, revision }),
    currentHead: () => head,
    extensions: [StorableInput, observer.extension],
    dispose: () => { disposed = true; clearTimeout(timer); },
    record(transaction, appendedTransactions) {
      if (stopped) return;
      const transactions = [transaction, ...appendedTransactions];
      try {
        if (!recordWithSource(recorder, transactions, observer.take(transactions), Date.now())) return;
        dirty = true;
        report("EDITING");
        clearTimeout(timer);
        timer = setTimeout(flush, 650);
      } catch {
        stopped = true;
        report("ERROR");
      }
    },
  };
}

export async function submitStudentWork(input, assignmentId, head, opened) {
  const { http, body } = await post("submission", input);
  if (http !== 200 || body?.status !== "submitted") return { rejected: http >= 400 && http < 500 };
  const { payload, signature, payloadDigestSha256 } = body.receipt ?? {};
  if (payload?.receiptSchema !== "ductus-submission-receipt-v2" || payload.assignmentId !== assignmentId.toLowerCase() ||
      payload.documentId !== input.documentId || payload.revision !== input.revision ||
      payload.evidenceDomainId !== opened.evidenceDomainId || payload.evidenceHeadSegmentHash !== head ||
      !SHA256.test(payload.artifactSha256) || signature?.algorithm !== "Ed25519" || signature.signatureEncoding !== "raw") {
    return { rejected: false };
  }
  const key = opened.receiptKeys.find((candidate) => candidate.keyId === signature.keyId &&
    candidate.keyVersion === signature.keyVersion && candidate.evidenceDomainId === opened.evidenceDomainId &&
    candidate.purpose === "receipt" && candidate.algorithm === "Ed25519" && candidate.revokedAt === null);
  if (!key) return { rejected: false };
  const encoder = new TextEncoder();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalJson(payload))));
  if (Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("") !== payloadDigestSha256) {
    return { rejected: false };
  }
  const prefix = encoder.encode(`${payload.receiptSchema}\n`);
  const publicKey = await crypto.subtle.importKey("spki",
    fromB64Url(key.keyBase64Url), "Ed25519", false, ["verify"]);
  const valid = await crypto.subtle.verify("Ed25519", publicKey,
    fromB64Url(signature.signatureBase64Url),
    new Uint8Array([...prefix, ...digest]));
  return valid ? { receipt: payload } : { rejected: false };
}
