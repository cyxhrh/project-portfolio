import type { SpecimenRecord } from "../domain/specimen";

export interface MonthlySpecimenGroup {
  key: string;
  title: string;
  summary: string;
  specimens: SpecimenRecord[];
}

function localDate(value: string): Date {
  return new Date(value);
}

export function monthKey(value: string): string {
  const date = localDate(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(value: string): string {
  const date = localDate(value);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

export function formatShortDate(value: string): string {
  const date = localDate(value);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatCardMeta(specimen: SpecimenRecord): string {
  const fields = specimen.showCollectedDate === false
    ? [specimen.mood]
    : [formatShortDate(specimen.createdAt), specimen.mood];

  if (specimen.type) fields.push(specimen.type);

  return fields.join(" · ");
}

export function monthlySummary(specimens: readonly SpecimenRecord[]): string {
  if (specimens.length === 1) {
    return "这个月，你留下了 1 份微光。";
  }

  const moodCounts = new Map<string, number>();
  specimens.forEach((specimen) => {
    moodCounts.set(specimen.mood, (moodCounts.get(specimen.mood) ?? 0) + 1);
  });
  const highestCount = Math.max(...moodCounts.values());
  const leadingMoods = [...moodCounts].filter(([, count]) => count === highestCount);

  if (leadingMoods.length === 1) {
    return `这个月，你留下了 ${specimens.length} 份微光 · 最常出现的是${leadingMoods[0][0]}。`;
  }

  return `这个月，你留下了 ${specimens.length} 份微光。`;
}

export function groupSpecimensByMonth(
  specimens: readonly SpecimenRecord[],
): MonthlySpecimenGroup[] {
  const sorted = [...specimens].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const groups = new Map<string, SpecimenRecord[]>();

  sorted.forEach((specimen) => {
    const key = monthKey(specimen.createdAt);
    const group = groups.get(key) ?? [];
    group.push(specimen);
    groups.set(key, group);
  });

  return [...groups.entries()].map(([key, group]) => ({
    key,
    title: formatMonth(group[0].createdAt),
    summary: monthlySummary(group),
    specimens: group,
  }));
}
