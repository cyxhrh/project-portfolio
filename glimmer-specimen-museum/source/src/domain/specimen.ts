import type { Mood } from "../backgrounds/manifest";

export const SPECIMEN_TYPES = ["句子", "灵感", "歌词", "问题", "画面", "选题"] as const;
export const SPECIMEN_TAGS = ["成长", "写作", "阅读", "生活", "关系", "创作"] as const;

export type SpecimenType = (typeof SPECIMEN_TYPES)[number];
export type SpecimenTag = (typeof SPECIMEN_TAGS)[number];

export interface SpecimenDraft {
  content: string;
  type: SpecimenType | null;
  mood: Mood | null;
  tags: SpecimenTag[];
  source: string;
  author: string;
  showCollectedDate: boolean;
}

export interface SpecimenRecord {
  id: string;
  schemaVersion: 1;
  layoutVersion: 1 | 2;
  content: string;
  type?: SpecimenType;
  mood: Mood;
  tags: SpecimenTag[];
  source?: string;
  author?: string;
  showCollectedDate?: boolean;
  backgroundId: string;
  backgroundVersion: string;
  createdAt: string;
}

export type DetailErrors = Partial<Record<"mood", string>>;

export function emptyDraft(): SpecimenDraft {
  return {
    content: "",
    type: null,
    mood: null,
    tags: [],
    source: "",
    author: "",
    showCollectedDate: true,
  };
}

export function countCharacters(value: string): number {
  return Array.from(value).length;
}

export function truncateToCharacters(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join("");
}

export function validateContent(content: string): string | null {
  if (content.trim().length === 0) {
    return "先写下一点什么，再继续。";
  }

  if (countCharacters(content) > 300) {
    return "最多写 300 字。";
  }

  return null;
}

export function validateDetails(draft: SpecimenDraft): DetailErrors {
  const errors: DetailErrors = {};

  if (!draft.mood) {
    errors.mood = "请选择一种心情。";
  }

  return errors;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `specimen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createSpecimen(
  draft: SpecimenDraft,
  background: { id: string; version: string },
  createdAt = new Date(),
  id = createId(),
): SpecimenRecord {
  const contentError = validateContent(draft.content);
  const detailErrors = validateDetails(draft);

  if (contentError || Object.keys(detailErrors).length > 0) {
    throw new Error("不能用未完成的线索制作标本。送入的数据未通过校验。");
  }

  return {
    id,
    schemaVersion: 1,
    layoutVersion: 2,
    content: draft.content,
    type: draft.type ?? undefined,
    mood: draft.mood as Mood,
    tags: [...draft.tags],
    source: draft.source.trim() || undefined,
    author: draft.author.trim() || undefined,
    showCollectedDate: draft.showCollectedDate,
    backgroundId: background.id,
    backgroundVersion: background.version,
    createdAt: createdAt.toISOString(),
  };
}

export function withBackground(
  specimen: SpecimenRecord,
  background: { id: string; version: string },
): SpecimenRecord {
  return {
    ...specimen,
    backgroundId: background.id,
    backgroundVersion: background.version,
  };
}
