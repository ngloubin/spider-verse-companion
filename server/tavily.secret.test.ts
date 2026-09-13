import { describe, expect, it } from "vitest";

describe("Tavily Cloud secret", () => {
  it("authenticates against the search endpoint without exposing the key", async () => {
    const key = process.env.TAVILY_API_KEY;
    expect(key).toBeTruthy();

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        query: "weather forecast Pirassununga tomorrow",
        max_results: 1,
        include_answer: true,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(15000),
    });

    expect(response.ok).toBe(true);
    const data = (await response.json()) as { results?: unknown[]; answer?: string | null };
    expect(Array.isArray(data.results) || typeof data.answer === "string").toBe(true);
  }, 20000);
});
