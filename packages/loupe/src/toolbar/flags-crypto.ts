// The Flags SDK's tokens, written without the SDK (PER-132): a compact JWE,
// `dir` + `A256GCM`, keyed by the app's `FLAGS_SECRET` (32 bytes, base64url).
// `flags/next` reads overrides from the `vercel-flag-overrides` cookie in this
// format, and the discovery endpoint accepts an access proof in it. Server only:
// the secret never leaves the dev server.

const HEADER = base64url(new TextEncoder().encode(JSON.stringify({ alg: "dir", enc: "A256GCM" })));
const TAG_BYTES = 16;

export type Claims = Record<string, unknown>;

/** Overrides as `flags/next` decrypts them: `{ o, pur: "overrides" }`. */
export function encryptOverrides(overrides: Claims, secret: string, ttlSeconds = 7 * 24 * 3600): Promise<string> {
  return encryptJwe({ o: overrides, pur: "overrides" }, secret, ttlSeconds);
}

export async function decryptOverrides(token: string | undefined, secret: string): Promise<Claims | undefined> {
  const claims = token ? await decryptJwe(token, secret) : undefined;
  // The SDK accepts a purpose list as well as a single purpose.
  const purposes = Array.isArray(claims?.pur) ? claims.pur : [claims?.pur];
  if (!claims || !purposes.includes("overrides") || typeof claims.o !== "object" || claims.o === null) return undefined;
  return claims.o as Claims;
}

/** What `verifyAccess` accepts after `Bearer `: `{ pur: "proof" }`. */
export function accessProof(secret: string, ttlSeconds = 60): Promise<string> {
  return encryptJwe({ pur: "proof" }, secret, ttlSeconds);
}

export async function encryptJwe(payload: Claims, secret: string, ttlSeconds: number): Promise<string> {
  const claims = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(HEADER) },
      await keyOf(secret, "encrypt"),
      new TextEncoder().encode(JSON.stringify(claims)),
    ),
  );
  // WebCrypto appends the tag; JWE carries it as its own segment.
  const ciphertext = sealed.slice(0, -TAG_BYTES);
  const tag = sealed.slice(-TAG_BYTES);
  return `${HEADER}..${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;
}

/** The claims, or undefined for anything that isn't a valid, unexpired token for this secret. */
export async function decryptJwe(token: string, secret: string): Promise<Claims | undefined> {
  const parts = token.split(".");
  if (parts.length !== 5 || parts[1] !== "") return undefined;
  const [header, , iv, ciphertext, tag] = parts as [string, string, string, string, string];
  const key = await keyOf(secret, "decrypt");
  try {
    const { alg, enc } = JSON.parse(text(fromBase64url(header))) as { alg?: string; enc?: string };
    if (alg !== "dir" || enc !== "A256GCM") return undefined;
    const sealed = new Uint8Array([...fromBase64url(ciphertext), ...fromBase64url(tag)]);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64url(iv), additionalData: new TextEncoder().encode(header) },
      key,
      sealed,
    );
    const claims = JSON.parse(text(new Uint8Array(plain))) as Claims;
    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) return undefined;
    return claims;
  } catch {
    return undefined;
  }
}

async function keyOf(secret: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const raw = fromBase64url(secret);
  if (raw.length !== 32) {
    throw new Error("FLAGS_SECRET must be a 256-bit key (32 bytes, base64url), as the Flags SDK requires.");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, [usage]);
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
