import { describe, expect, it } from "vitest";

import {
  countCharacters,
  createSpecimen,
  emptyDraft,
  truncateToCharacters,
  validateContent,
  validateDetails,
} from "./specimen";

describe("specimen draft", () => {
  it("treats whitespace-only content as empty and keeps the 300-character limit", () => {
    expect(validateContent("   ")).toBe("先写下一点什么，再继续。");
    expect(validateContent("微光")).toBeNull();
    expect(validateContent("光".repeat(301))).toBe("最多写 300 字。");
  });

  it("counts emoji as one character and never cuts a surrogate pair", () => {
    expect(countCharacters("微光🌙")).toBe(3);
    expect(validateContent("🌙".repeat(300))).toBeNull();
    expect(validateContent("🌙".repeat(301))).toBe("最多写 300 字。");
    expect(truncateToCharacters("🌙".repeat(301), 300)).toBe("🌙".repeat(300));
  });

  it("requires only mood and accepts an unannotated card", () => {
    expect(validateDetails(emptyDraft())).toEqual({
      mood: "请选择一种心情。",
    });

    expect(
      validateDetails({
        content: "雨停以后，窗边亮了一点。",
        type: null,
        mood: "雨后",
        tags: [],
        source: "",
        author: "",
        showCollectedDate: false,
      }),
    ).toEqual({});
  });

  it("creates a reproducible card record from an accepted draft", () => {
    const card = createSpecimen(
      {
        content: "雨停以后，窗边亮了一点。",
        type: null,
        mood: "雨后",
        tags: [],
        source: "",
        author: "",
        showCollectedDate: false,
      },
      {
        id: "after-rain-01",
        version: "slot-v1",
      },
      new Date("2026-07-22T08:00:00.000Z"),
      "specimen-001",
    );

    expect(card).toMatchObject({
      id: "specimen-001",
      schemaVersion: 1,
      content: "雨停以后，窗边亮了一点。",
      type: undefined,
      mood: "雨后",
      tags: [],
      source: undefined,
      author: undefined,
      showCollectedDate: false,
      backgroundId: "after-rain-01",
      backgroundVersion: "slot-v1",
      layoutVersion: 2,
      createdAt: "2026-07-22T08:00:00.000Z",
    });
  });
});
