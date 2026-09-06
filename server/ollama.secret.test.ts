import { describe, expect, it } from "vitest";

describe("Ollama Cloud secret", () => {
  it("authenticates against the lightweight tags endpoint without exposing the key", async () => {
    const key = process.env.OLLAMA_API_KEY;
    expect(key, "OLLAMA_API_KEY must be configured in the project environment").toBeTruthy();

    const response = await fetch("https://ollama.com/api/tags", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });

    expect(response.ok).toBe(true);
    expect(response.headers.get("content-type") ?? "").toContain("application/json");
  }, 20000);
});
