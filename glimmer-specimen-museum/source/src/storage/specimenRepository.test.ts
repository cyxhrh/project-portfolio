import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";

import type { SpecimenRecord } from "../domain/specimen";
import { createSpecimenRepository } from "./specimenRepository";

function makeRecord(
  id: string,
  createdAt: string,
  backgroundId = "after-rain-01",
): SpecimenRecord {
  return {
    id,
    schemaVersion: 1,
    layoutVersion: 1,
    content: `标本 ${id}`,
    type: "句子",
    mood: "雨后",
    tags: ["生活"],
    backgroundId,
    backgroundVersion: "slot-v1",
    createdAt,
  };
}

describe("specimen repository", () => {
  it("keeps the application usable when browser storage is unavailable", async () => {
    const repository = createSpecimenRepository({
      indexedDB: null,
      databaseName: "unavailable-storage",
    });

    await expect(repository.list()).rejects.toThrow("不支持 IndexedDB");
    await expect(
      repository.save(makeRecord("draft", "2026-07-22T08:00:00.000Z")),
    ).rejects.toThrow("不支持 IndexedDB");
  });

  it("saves, updates, lists newest first, and removes card records", async () => {
    const repository = createSpecimenRepository({
      indexedDB: new IDBFactory(),
      databaseName: "specimen-repository-test",
    });
    const older = makeRecord("older", "2026-07-21T08:00:00.000Z");
    const newer = makeRecord("newer", "2026-07-22T08:00:00.000Z");

    await repository.save(older);
    await repository.save(newer);
    expect((await repository.list()).map((item) => item.id)).toEqual([
      "newer",
      "older",
    ]);

    await repository.save(makeRecord("newer", newer.createdAt, "after-rain-02"));
    expect(await repository.get("newer")).toMatchObject({
      id: "newer",
      backgroundId: "after-rain-02",
    });
    expect(await repository.list()).toHaveLength(2);

    await repository.remove("older");
    expect(await repository.get("older")).toBeUndefined();
    expect((await repository.list()).map((item) => item.id)).toEqual(["newer"]);
  });
});
