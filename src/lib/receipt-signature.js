import { ed25519 } from "@noble/curves/ed25519.js";

export const verifyEd25519 = (key, signature, message) =>
  ed25519.verify(signature, message, key, { zip215: false });

// Some WebKit builds provide SHA-256 but lack Ed25519 in SubtleCrypto.
// The shared receipt verifier checks the key structure before these calls.
export async function importReceiptKey(format, bytes, algorithm, extractable, usages) {
  try {
    return await crypto.subtle.importKey(format, bytes, algorithm, extractable, usages);
  } catch (error) {
    if (error.name !== "NotSupportedError" || format !== "raw" || algorithm.name !== "Ed25519") throw error;
    return { rawEd25519: bytes };
  }
}

export async function verifyReceiptSignature(algorithm, key, signature, message) {
  if ("rawEd25519" in key) return verifyEd25519(key.rawEd25519, signature, message);
  return crypto.subtle.verify(algorithm, key, signature, message);
}
