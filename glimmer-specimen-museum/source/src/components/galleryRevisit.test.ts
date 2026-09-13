import { describe, expect, it } from "vitest";

import type { SpecimenRecord } from "../domain/specimen";
import {
  formatCardMeta,
  groupSpecimensByMonth,
  monthlySummary,
} from "./galleryRevisit";

function specimen(
  id: string,
  createdAt: string,
  mood: SpecimenRecord["mood"],
): SpecimenRecord {
  return {
    id,
    schemaVersion: 1,
    layoutVersion: 2,
    content: id,
    mood,
    tags: [],
    backgroundId: "BG-RAIN-01",
    backgroundVersion: "catalog-v1",
    createdAt,
  };
}

describe("gallery revisit grouping", () => {
  it("returns no chapters for an empty collection", () => {
    expect(groupSpecimensByMonth([])).toEqual([]);
  });

  it("groups cards by local month with cards and months newest first", () => {
    const groups = groupSpecimensByMonth([
      specimen("june", "2026-06-30T12:00:00.000Z", "晴天"),
      specimen("july-early", "2026-07-01T12:00:00.000Z", "雨后"),
      specimen("july-late", "2026-07-22T12:00:00.000Z", "雨后"),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-07", "2026-06"]);
    expect(groups[0].specimens.map((item) => item.id)).toEqual([
      "july-late",
      "july-early",
    ]);
    expect(groups[0].summary).toBe("这个月，你留下了 2 份微光 · 最常出现的是雨后。");
  });

  it("uses the browser local calendar month at a month boundary", () => {
    const lastJuneMinute = new Date(2026, 5, 30, 23, 45).toISOString();
    const firstJulyMinute = new Date(2026, 6, 1, 0, 15).toISOString();
    const groups = groupSpecimensByMonth([
      specimen("june-local", lastJuneMinute, "晴天"),
      specimen("july-local", firstJulyMinute, "雨后"),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["2026-07", "2026-06"]);
  });

  it("uses a count-only summary for one card or tied leading moods", () => {
    expect(monthlySummary([specimen("only", "2026-07-22T12:00:00.000Z", "晨雾")]))
      .toBe("这个月，你留下了 1 份微光。");
    expect(
      monthlySummary([
        specimen("mist", "2026-07-22T12:00:00.000Z", "晨雾"),
        specimen("rain", "2026-07-21T12:00:00.000Z", "雨后"),
      ]),
    ).toBe("这个月，你留下了 2 份微光。");
  });

  it("omits absent types and dates that were hidden on the card", () => {
    const legacy = specimen("legacy", "2026-07-22T12:00:00.000Z", "晨雾");
    expect(formatCardMeta(legacy)).toBe("7 月 22 日 · 晨雾");

    const annotated: SpecimenRecord = {
      ...legacy,
      type: "歌词",
      showCollectedDate: false,
    };
    expect(formatCardMeta(annotated)).toBe("晨雾 · 歌词");
  });
});
