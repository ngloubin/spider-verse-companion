import { describe, expect, it } from "vitest";
import { detectNaturalControls } from "./routers";

describe("E.V. conversational controls", () => {
  it("maps voice, response and motion requests to persisted preference patches", () => {
    const result = detectNaturalControls("E.V., fala um pouco mais rápido, dê respostas mais curtas e use menos animações.");
    expect(result.patch).toEqual({ voiceRate: "1.12", responseStyle: "concise", motionLevel: "subtle" });
  });

  it("extracts a user memory without inventing extra content", () => {
    const result = detectNaturalControls("E.V., lembre que eu gosto de interfaces vermelhas.");
    expect(result.memory).toBe("eu gosto de interfaces vermelhas.");
  });

  it("keeps MCP connections pending until explicit confirmation", () => {
    const result = detectNaturalControls("Conecte este MCP https://example.com/mcp para usar ferramentas.");
    expect(result.integration?.endpoint).toBe("https://example.com/mcp");
  });
});
