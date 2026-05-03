import { describe, it, expect } from "vitest";
import { Eleata, EleataError } from "../src/index.js";

describe("Eleata", () => {
  it("requires apiKey", () => {
    expect(() => new Eleata({ apiKey: "" })).toThrow(EleataError);
  });

  it("rejects oversized payload client-side", async () => {
    const client = new Eleata({ apiKey: "evk_test", maxPayload: 100 });
    const big = Buffer.alloc(200, "x");
    await expect(client.validate({ format: "peppol-bis-3", xml: big })).rejects.toThrow(/exceeds/);
  });

  it("accepts string XML", async () => {
    const client = new Eleata({ apiKey: "evk_test", maxPayload: 1000 });
    // Will fail at fetch level (no server), but should pass payload check
    await expect(client.validate({ format: "ubl", xml: "<x/>" })).rejects.not.toThrow(/exceeds/);
  });

  it("accepts Uint8Array XML", async () => {
    const client = new Eleata({ apiKey: "evk_test", maxPayload: 1000 });
    const u8 = new TextEncoder().encode("<x/>");
    await expect(client.validate({ format: "ubl", xml: u8 })).rejects.not.toThrow(/exceeds/);
  });
});
