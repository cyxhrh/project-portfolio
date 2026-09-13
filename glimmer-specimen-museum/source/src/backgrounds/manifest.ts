export const MOODS = ["晨雾", "雨后", "晴天", "黄昏", "深夜", "彩虹"] as const;

export type Mood = (typeof MOODS)[number];

export interface TextSafeArea {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BackgroundAsset {
  id: string;
  version: string;
  mood: Mood;
  renderSrc: string;
  thumbnailSrc: string;
  focalPoint: { x: number; y: number };
  textSafeArea: TextSafeArea;
  composition: string;
  cropFocus: string;
  overlayOpacity: number;
  alt: string;
  status: "placeholder" | "approved";
  provenance: {
    kind: "ai-directed";
    sourcePath: string;
    registryRef: string;
    note: string;
  };
}

interface ApprovedAssetInput {
  id: string;
  mood: Mood;
  sourceFolder: string;
  composition: string;
  safeAreaLabel: string;
  safeArea: Omit<TextSafeArea, "label">;
  cropFocus: string;
  focalPoint: { x: number; y: number };
  overlayOpacity: number;
}

const GENERATION_NOTE =
  "内置图像生成模式独立生成，经人工筛选、精确 4:5 裁切、1080×1350 缩放与轻度饱和度校正；未做内容合成或局部重绘。";

function approvedAsset(input: ApprovedAssetInput): BackgroundAsset {
  const fileName = `${input.id.toLowerCase()}.png`;

  return {
    id: input.id,
    version: "catalog-v1",
    mood: input.mood,
    renderSrc: `${import.meta.env.BASE_URL}assets/backgrounds/${fileName}`,
    thumbnailSrc: `${import.meta.env.BASE_URL}assets/backgrounds/${fileName}`,
    focalPoint: input.focalPoint,
    textSafeArea: { label: input.safeAreaLabel, ...input.safeArea },
    composition: input.composition,
    cropFocus: input.cropFocus,
    overlayOpacity: input.overlayOpacity,
    alt: `${input.mood}背景：${input.composition}`,
    status: "approved",
    provenance: {
      kind: "ai-directed",
      sourcePath: `docs/design/backgrounds/${input.sourceFolder}/${fileName}`,
      registryRef: `docs/design/backgrounds/ASSET_CATALOG.md#${input.id.toLowerCase()}`,
      note: GENERATION_NOTE,
    },
  };
}

export const BACKGROUND_MANIFEST: readonly BackgroundAsset[] = [
  approvedAsset({
    id: "BG-MIST-01",
    mood: "晨雾",
    sourceFolder: "晨雾",
    composition: "晨雾湖岸与右下木栈道，远山由右向左消隐。",
    safeAreaLabel: "左上至左中，约画面宽度 58%、高度 62%。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右下栈道消失点与中下远山交界。",
    focalPoint: { x: 0.68, y: 0.66 },
    overlayOpacity: 0.24,
  }),
  approvedAsset({
    id: "BG-MIST-02",
    mood: "晨雾",
    sourceFolder: "晨雾",
    composition: "露水草地、右侧孤树与渐隐地平线。",
    safeAreaLabel: "左上与左中，避开右侧暖光和孤树。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右下三分区孤树及低位地平线。",
    focalPoint: { x: 0.74, y: 0.72 },
    overlayOpacity: 0.28,
  }),
  approvedAsset({
    id: "BG-MIST-03",
    mood: "晨雾",
    sourceFolder: "晨雾",
    composition: "左侧林缘与下部弯曲小径，雾气向右上打开。",
    safeAreaLabel: "右上至右中。",
    safeArea: { x: 0.38, y: 0.18, width: 0.52, height: 0.58 },
    cropFocus: "下半部路径弧线与右侧雾中树影。",
    focalPoint: { x: 0.54, y: 0.68 },
    overlayOpacity: 0.26,
  }),
  approvedAsset({
    id: "BG-RAIN-01",
    mood: "雨后",
    sourceFolder: "雨后",
    composition: "雨滴窗面、右侧深色窗框与底部远城微光。",
    safeAreaLabel: "左上至左中蓝灰窗面。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右侧窗框与下部远景灯点。",
    focalPoint: { x: 0.72, y: 0.62 },
    overlayOpacity: 0.2,
  }),
  approvedAsset({
    id: "BG-RAIN-02",
    mood: "雨后",
    sourceFolder: "雨后",
    composition: "湿润石板路从左下弯向中部，右侧新绿形成边框。",
    safeAreaLabel: "左上蓝灰雾面。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "下部石板反光与右侧叶片交界。",
    focalPoint: { x: 0.58, y: 0.72 },
    overlayOpacity: 0.25,
  }),
  approvedAsset({
    id: "BG-RAIN-03",
    mood: "雨后",
    sourceFolder: "雨后",
    composition: "水面倒映云层，右侧稀疏芦苇与中下涟漪。",
    safeAreaLabel: "左上至上中。",
    safeArea: { x: 0.1, y: 0.18, width: 0.64, height: 0.54 },
    cropFocus: "中下涟漪与右侧芦苇根部。",
    focalPoint: { x: 0.58, y: 0.68 },
    overlayOpacity: 0.2,
  }),
  approvedAsset({
    id: "BG-SUN-01",
    mood: "晴天",
    sourceFolder: "晴天",
    composition: "大面积清透天空，细云与右下树梢。",
    safeAreaLabel: "左上至左中，避开细云集中处。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右下树梢与中心天空留白平衡。",
    focalPoint: { x: 0.7, y: 0.64 },
    overlayOpacity: 0.38,
  }),
  approvedAsset({
    id: "BG-SUN-02",
    mood: "晴天",
    sourceFolder: "晴天",
    composition: "左侧暖墙、右侧窗与亚麻帘，室外绿意轻虚化。",
    safeAreaLabel: "左上至左中暖墙。",
    safeArea: { x: 0.1, y: 0.18, width: 0.54, height: 0.58 },
    cropFocus: "中右窗框与帘布边缘。",
    focalPoint: { x: 0.7, y: 0.5 },
    overlayOpacity: 0.32,
  }),
  approvedAsset({
    id: "BG-SUN-03",
    mood: "晴天",
    sourceFolder: "晴天",
    composition: "下部草坡与小径，右下孤树，上方为大面积天空。",
    safeAreaLabel: "左上至上中。",
    safeArea: { x: 0.1, y: 0.18, width: 0.64, height: 0.54 },
    cropFocus: "右下孤树与左下路径入口。",
    focalPoint: { x: 0.68, y: 0.72 },
    overlayOpacity: 0.36,
  }),
  approvedAsset({
    id: "BG-DUSK-01",
    mood: "黄昏",
    sourceFolder: "黄昏",
    composition: "多层远山与底部稀疏花草，天空由橙转灰紫。",
    safeAreaLabel: "上中至右上灰紫天空。",
    safeArea: { x: 0.3, y: 0.18, width: 0.6, height: 0.54 },
    cropFocus: "中下山脊层次与底部花草。",
    focalPoint: { x: 0.54, y: 0.68 },
    overlayOpacity: 0.2,
  }),
  approvedAsset({
    id: "BG-DUSK-02",
    mood: "黄昏",
    sourceFolder: "黄昏",
    composition: "低位海平线、微暖反光与右上薄云。",
    safeAreaLabel: "左上至左中天空。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "下三分之一海平线与中下反光。",
    focalPoint: { x: 0.5, y: 0.7 },
    overlayOpacity: 0.2,
  }),
  approvedAsset({
    id: "BG-DUSK-03",
    mood: "黄昏",
    sourceFolder: "黄昏",
    composition: "大幅窗外暮色，右侧窄窗框与右下盆栽剪影。",
    safeAreaLabel: "左上至左中天空。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右侧窗框、右下植物与低位远景。",
    focalPoint: { x: 0.72, y: 0.64 },
    overlayOpacity: 0.22,
  }),
  approvedAsset({
    id: "BG-NIGHT-01",
    mood: "深夜",
    sourceFolder: "深夜",
    composition: "蓝调窗外夜空、底部城市微光与右侧窄窗框。",
    safeAreaLabel: "左上至左中深蓝天空。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "底部城市轮廓与右侧窗框。",
    focalPoint: { x: 0.7, y: 0.68 },
    overlayOpacity: 0.2,
  }),
  approvedAsset({
    id: "BG-NIGHT-02",
    mood: "深夜",
    sourceFolder: "深夜",
    composition: "稀疏星空、低位山脊与静湖倒影。",
    safeAreaLabel: "左上与左中稀疏星点之间。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "中下山脊峰值与湖面倒影轴线。",
    focalPoint: { x: 0.5, y: 0.68 },
    overlayOpacity: 0.2,
  }),
  approvedAsset({
    id: "BG-NIGHT-03",
    mood: "深夜",
    sourceFolder: "深夜",
    composition: "左侧树冠、下部弯曲空路与远处小型暖灯。",
    safeAreaLabel: "右上至右中蓝调暗部。",
    safeArea: { x: 0.38, y: 0.18, width: 0.52, height: 0.58 },
    cropFocus: "中下远灯与道路弯道。",
    focalPoint: { x: 0.58, y: 0.68 },
    overlayOpacity: 0.22,
  }),
  approvedAsset({
    id: "BG-RAINBOW-01",
    mood: "彩虹",
    sourceFolder: "彩虹",
    composition: "雨后草地与右上淡彩虹，左侧为珠灰天空。",
    safeAreaLabel: "左上至左中，避开彩虹弧线。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右上彩虹段与下部湿草地地平线。",
    focalPoint: { x: 0.68, y: 0.66 },
    overlayOpacity: 0.38,
  }),
  approvedAsset({
    id: "BG-RAINBOW-02",
    mood: "彩虹",
    sourceFolder: "彩虹",
    composition: "暖白墙面、右侧薄帘与右下克制棱镜光带。",
    safeAreaLabel: "左上至左中暖墙。",
    safeArea: { x: 0.1, y: 0.18, width: 0.58, height: 0.58 },
    cropFocus: "右下光带、玻璃边缘与右侧帘布。",
    focalPoint: { x: 0.7, y: 0.68 },
    overlayOpacity: 0.35,
  }),
  approvedAsset({
    id: "BG-RAINBOW-03",
    mood: "彩虹",
    sourceFolder: "彩虹",
    composition: "低位湖面与远山，左下薄雾中出现局部淡虹，右上大面积珠蓝天空。",
    safeAreaLabel: "右上至右中。",
    safeArea: { x: 0.38, y: 0.18, width: 0.52, height: 0.58 },
    cropFocus: "左下虹段、山脊和低位湖面。",
    focalPoint: { x: 0.36, y: 0.7 },
    overlayOpacity: 0.38,
  }),
];

export function getBackgroundCandidates(mood: Mood): BackgroundAsset[] {
  return BACKGROUND_MANIFEST.filter((background) => background.mood === mood);
}

export function getBackgroundById(id: string): BackgroundAsset | undefined {
  return BACKGROUND_MANIFEST.find((background) => background.id === id);
}

export function getNextBackground(
  mood: Mood,
  currentId: string,
): { background: BackgroundAsset; wrapped: boolean } {
  const candidates = getBackgroundCandidates(mood);

  if (candidates.length === 0) {
    throw new Error(`心情“${mood}”没有可用背景。`);
  }

  const currentIndex = candidates.findIndex((item) => item.id === currentId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % candidates.length;

  return {
    background: candidates[nextIndex],
    wrapped: currentIndex >= 0 && nextIndex === 0,
  };
}

export function getNextAvailableBackground(
  mood: Mood,
  currentId: string,
  excludedIds: ReadonlySet<string>,
): BackgroundAsset | undefined {
  const candidates = getBackgroundCandidates(mood);
  const currentIndex = candidates.findIndex((candidate) => candidate.id === currentId);

  for (let offset = 1; offset <= candidates.length; offset += 1) {
    const index = currentIndex < 0 ? offset - 1 : (currentIndex + offset) % candidates.length;
    const candidate = candidates[index];

    if (!excludedIds.has(candidate.id)) return candidate;
  }

  return undefined;
}
