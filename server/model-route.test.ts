import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("primary 3D Spider-Man model route", () => {
  it("keeps the explicit Sketchfab model route and disables automatic spin", () => {
    const component = readFileSync(resolve(process.cwd(), "client/src/components/SpiderMask.tsx"), "utf8");
    expect(component).toContain('SPIDER_MAN_3D_MODEL_ID = "5e47c63e3dd4436f86e838cfaa334447"');
    expect(component).toContain("SPIDER_MAN_3D_EMBED_URL");
    expect(component).toContain("autospin=0");
    expect(component).toContain('data-renderer="sketchfab-3d"');
    expect(component).toContain("legacy/fallback");
  });
});
