import { describe, expect, it } from "vitest";

import {
  BACKGROUND_MANIFEST,
  MOODS,
  getBackgroundCandidates,
  getNextAvailableBackground,
  getNextBackground,
} from "./manifest";

describe("background manifest", () => {
  it("provides three approved same-origin PNG assets for every mood", () => {
    expect(BACKGROUND_MANIFEST).toHaveLength(18);

    for (const mood of MOODS) {
      const candidates = getBackgroundCandidates(mood);
      expect(candidates).toHaveLength(3);
      expect(candidates.every((item) => item.mood === mood)).toBe(true);
      expect(candidates.every((item) => item.renderSrc.startsWith("/assets/"))).toBe(
        true,
      );
      expect(candidates.every((item) => item.renderSrc.endsWith(".png"))).toBe(true);
      expect(candidates.every((item) => item.status === "approved")).toBe(true);
      expect(candidates.every((item) => item.provenance.registryRef)).toBe(true);
      expect(new Set(candidates.map((item) => item.id)).size).toBe(3);
    }

    expect(BACKGROUND_MANIFEST[0].id).toBe("BG-MIST-01");
    expect(BACKGROUND_MANIFEST.at(-1)?.id).toBe("BG-RAINBOW-03");
  });

  it("cycles within the current mood and reports when the set wraps", () => {
    const candidates = getBackgroundCandidates("雨后");
    expect(getNextBackground("雨后", candidates[0].id)).toEqual({
      background: candidates[1],
      wrapped: false,
    });
    expect(getNextBackground("雨后", candidates[2].id)).toEqual({
      background: candidates[0],
      wrapped: true,
    });
  });

  it("skips failed candidates and stops after the mood set is exhausted", () => {
    const candidates = getBackgroundCandidates("雨后");

    expect(
      getNextAvailableBackground(
        "雨后",
        candidates[0].id,
        new Set([candidates[0].id, candidates[1].id]),
      ),
    ).toBe(candidates[2]);

    expect(
      getNextAvailableBackground(
        "雨后",
        candidates[2].id,
        new Set(candidates.map((candidate) => candidate.id)),
      ),
    ).toBeUndefined();
  });
});
