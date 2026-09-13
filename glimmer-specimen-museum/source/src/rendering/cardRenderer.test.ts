import { describe, expect, it } from "vitest";

import {
  getBodyFontSize,
  getMetadataLines,
  specimenFileName,
  splitTextToLines,
  truncateLineToWidth,
} from "./cardRenderer";

describe("card text layout", () => {
  it("keeps every character when wrapping the 300-character maximum", () => {
    const content = "微".repeat(300);
    const lines = splitTextToLines(content, (value) => value.length * 10, 140);

    expect(lines.join("")).toBe(content);
    expect(lines.every((line) => line.length <= 14)).toBe(true);
  });

  it("uses progressively smaller type without dropping content", () => {
    expect(getBodyFontSize(20)).toBeGreaterThan(getBodyFontSize(80));
    expect(getBodyFontSize(80)).toBeGreaterThan(getBodyFontSize(180));
    expect(getBodyFontSize(180)).toBeGreaterThan(getBodyFontSize(260));
  });

  it("preserves explicit paragraph breaks", () => {
    expect(splitTextToLines("第一行\n第二行", (value) => value.length * 10, 100)).toEqual([
      "第一行",
      "第二行",
    ]);
  });

  it("uses the browser-local collection date in the exported file name", () => {
    const localCreatedAt = new Date(2026, 6, 22, 0, 30).toISOString();

    expect(
      specimenFileName({
        id: "abcdef12-3456",
        schemaVersion: 1,
        layoutVersion: 1,
        content: "一束微光",
        type: "句子",
        mood: "晴天",
        tags: ["生活"],
        backgroundId: "BG-SUN-01",
        backgroundVersion: "catalog-v1",
        createdAt: localCreatedAt,
      }),
    ).toBe("微光标本-20260722-abcdef.png");
  });

  it("composes only filled metadata without dangling separators", () => {
    const base = {
      id: "abcdef12-3456",
      schemaVersion: 1 as const,
      layoutVersion: 2 as const,
      content: "一束微光",
      mood: "晴天" as const,
      tags: [],
      backgroundId: "BG-SUN-01",
      backgroundVersion: "catalog-v1",
      createdAt: "2026-07-22T00:30:00.000Z",
    };

    expect(getMetadataLines({ ...base, showCollectedDate: false })).toEqual([]);
    expect(
      getMetadataLines({ ...base, showCollectedDate: true, tags: ["写作"] }),
    ).toEqual(["采集于 2026年7月22日  ·  写作"]);
    expect(
      getMetadataLines({
        ...base,
        showCollectedDate: false,
        source: "《雨后的花园》",
        author: "林徽因",
      }),
    ).toEqual(["《雨后的花园》  ·  林徽因"]);
    expect(
      getMetadataLines({
        ...base,
        showCollectedDate: false,
        source: "   ",
        author: "\t",
      }),
    ).toEqual([]);
  });

  it("truncates long archive metadata within its reserved card width", () => {
    const context = {
      measureText: (text: string) => ({ width: Array.from(text).length * 10 } as TextMetrics),
    };

    expect(truncateLineToWidth(context, "出处作者", 60)).toBe("出处作者");
    expect(truncateLineToWidth(context, "很长很长的出处作者信息", 60)).toBe("很长很长的…");
    expect(truncateLineToWidth(context, "很长", 5)).toBe("…");
  });
});
