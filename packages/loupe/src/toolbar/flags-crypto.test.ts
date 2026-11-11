import { randomBytes } from "node:crypto";
import {
  decryptOverrides as sdkDecryptOverrides,
  encryptOverrides as sdkEncryptOverrides,
  verifyAccess,
} from "flags";
import { describe, expect, it, vi } from "vitest";
import { accessProof, decryptOverrides, encryptJwe, encryptOverrides } from "./flags-crypto.js";

const secret = randomBytes(32).toString("base64url");
const other = randomBytes(32).toString("base64url");

// The contract is the Flags SDK's own reader, so each token is checked against it.
describe("flag tokens", () => {
  it("writes an override cookie flags/next reads", async () => {
    const token = await encryptOverrides({ showBetaFeature: true, plan: "pro" }, secret);
    await expect(sdkDecryptOverrides(token, secret)).resolves.toEqual({ showBetaFeature: true, plan: "pro" });
  });

  it("reads an override cookie the SDK wrote", async () => {
    const token = await sdkEncryptOverrides({ showBetaFeature: false }, secret);
    await expect(decryptOverrides(token, secret)).resolves.toEqual({ showBetaFeature: false });
  });

  it("writes an access proof the discovery endpoint accepts", async () => {
    await expect(verifyAccess(`Bearer ${await accessProof(secret)}`, secret)).resolves.toBe(true);
    await expect(verifyAccess(`Bearer ${await accessProof(other)}`, secret)).resolves.toBe(false);
  });

  it("ignores a cookie from another secret, another purpose, or past its expiry", async () => {
    await expect(decryptOverrides(await encryptOverrides({ a: 1 }, other), secret)).resolves.toBeUndefined();
    await expect(decryptOverrides(await accessProof(secret), secret)).resolves.toBeUndefined();
    await expect(decryptOverrides("not-a-token", secret)).resolves.toBeUndefined();
    await expect(decryptOverrides(undefined, secret)).resolves.toBeUndefined();

    const token = await encryptJwe({ o: { a: 1 }, pur: "overrides" }, secret, 60);
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    try {
      await expect(decryptOverrides(token, secret)).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses a secret that isn't 32 bytes, as the SDK does", async () => {
    await expect(encryptOverrides({}, "short")).rejects.toThrow(/32 bytes/);
  });
});
