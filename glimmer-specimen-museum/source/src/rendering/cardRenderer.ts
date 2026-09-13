import type { BackgroundAsset } from "../backgrounds/manifest";
import type { SpecimenRecord } from "../domain/specimen";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;

const SERIF_FAMILY = "Noto Serif SC Variable";
const SANS_FAMILY = "Noto Sans SC Variable";
const SERIF_STACK = `"${SERIF_FAMILY}", "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
const SANS_STACK = `"${SANS_FAMILY}", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", sans-serif`;

export function getBodyFontSize(length: number): number {
  if (length <= 50) return 68;
  if (length <= 120) return 54;
  if (length <= 200) return 42;
  return 30;
}

export function splitTextToLines(
  text: string,
  measure: (value: string) => number,
  maxWidth: number,
): string[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";

    for (const character of Array.from(paragraph)) {
      const next = `${line}${character}`;

      if (line && measure(next) > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = next;
      }
    }

    if (line) lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
}

async function waitForFonts(specimen: SpecimenRecord): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return;
  }

  const serifText = specimen.content || "微光标本";
  const sansText = `微光标本馆类型心情标签出处作者${specimen.type ?? ""}${specimen.mood}${specimen.tags.join("")}${specimen.source ?? ""}${specimen.author ?? ""}`;

  await Promise.all([
    document.fonts.load(`600 68px "${SERIF_FAMILY}"`, serifText),
    document.fonts.load(`500 27px "${SANS_FAMILY}"`, sansText),
  ]);

  if (
    !document.fonts.check(`600 68px "${SERIF_FAMILY}"`, serifText) ||
    !document.fonts.check(`500 27px "${SANS_FAMILY}"`, sansText)
  ) {
    throw new Error("卡片字体尚未准备好，请再试一次。");
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("这张背景暂时不可用。"));
    image.src = src;
  });
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  focalPoint: { x: number; y: number },
): void {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
  }

  const focalX = image.naturalWidth * focalPoint.x;
  const focalY = image.naturalHeight * focalPoint.y;
  const sourceX = Math.min(
    Math.max(focalX - sourceWidth / 2, 0),
    image.naturalWidth - sourceWidth,
  );
  const sourceY = Math.min(
    Math.max(focalY - sourceHeight / 2, 0),
    image.naturalHeight - sourceHeight,
  );

  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
}

function formatCollectedDate(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function getMetadataLines(specimen: SpecimenRecord): string[] {
  const lines: string[] = [];
  const date = specimen.showCollectedDate === false
    ? ""
    : `采集于 ${formatCollectedDate(specimen.createdAt)}`;
  const tags = specimen.tags.join(" · ");

  if (date || tags) {
    lines.push([date, tags].filter(Boolean).join("  ·  "));
  }

  const sourceCredit = [specimen.source?.trim(), specimen.author?.trim()]
    .filter((value): value is string => Boolean(value))
    .join("  ·  ");
  if (sourceCredit) lines.push(sourceCredit);

  return lines;
}

export function truncateLineToWidth(
  context: Pick<CanvasRenderingContext2D, "measureText">,
  text: string,
  maxWidth: number,
): string {
  if (context.measureText(text).width <= maxWidth) return text;

  const ellipsis = "…";
  let truncated = "";
  for (const character of Array.from(text)) {
    const candidate = `${truncated}${character}${ellipsis}`;
    if (context.measureText(candidate).width > maxWidth) break;
    truncated += character;
  }

  return truncated ? `${truncated}${ellipsis}` : ellipsis;
}

function prepareBodyLayout(
  context: CanvasRenderingContext2D,
  content: string,
  maxWidth: number,
  maxHeight: number,
): { fontSize: number; lineHeight: number; lines: string[] } {
  let fontSize = getBodyFontSize(Array.from(content).length);
  let lines: string[] = [];
  let lineHeight = 0;

  while (fontSize >= 24) {
    context.font = `600 ${fontSize}px ${SERIF_STACK}`;
    lineHeight = Math.round(fontSize * (fontSize <= 32 ? 1.42 : 1.55));
    lines = splitTextToLines(
      content,
      (value) => context.measureText(value).width,
      maxWidth,
    );

    if (lines.length * lineHeight <= maxHeight) break;
    fontSize -= 2;
  }

  return { fontSize, lineHeight, lines };
}

export async function renderSpecimenToCanvas(
  canvas: HTMLCanvasElement,
  specimen: SpecimenRecord,
  background: BackgroundAsset,
): Promise<void> {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("当前浏览器无法绘制标本卡。" );
  }

  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;

  const [, image] = await Promise.all([
    waitForFonts(specimen),
    loadImage(background.renderSrc),
  ]);

  context.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  context.fillStyle = "#fcf8f1";
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const paperInset = 36;
  const imageWidth = CARD_WIDTH - paperInset * 2;
  const imageHeight = CARD_HEIGHT - paperInset * 2;

  context.save();
  context.beginPath();
  context.roundRect(paperInset, paperInset, imageWidth, imageHeight, 18);
  context.clip();
  drawCoverImage(
    context,
    image,
    paperInset,
    paperInset,
    imageWidth,
    imageHeight,
    background.focalPoint,
  );
  context.fillStyle = `rgba(24, 27, 27, ${background.overlayOpacity})`;
  context.fillRect(paperInset, paperInset, imageWidth, imageHeight);
  context.restore();

  context.fillStyle = "rgba(255, 253, 248, 0.96)";
  context.textBaseline = "alphabetic";
  context.font = `500 25px ${SANS_STACK}`;
  context.letterSpacing = "1px";
  context.fillText(`心情 · ${specimen.mood}`, 112, 132);

  if (specimen.type) {
    context.textAlign = "right";
    context.fillText(`类型 · ${specimen.type}`, 968, 132);
    context.textAlign = "left";
  }

  const metadataLines = getMetadataLines(specimen);

  const safeArea = background.textSafeArea;
  const safeAreaLeft = Math.round(CARD_WIDTH * safeArea.x);
  const safeAreaTop = Math.round(CARD_HEIGHT * safeArea.y);
  const safeAreaWidth = Math.round(CARD_WIDTH * safeArea.width);
  const safeAreaHeight = Math.round(CARD_HEIGHT * safeArea.height);
  const layout = prepareBodyLayout(
    context,
    specimen.content,
    Math.min(safeAreaWidth, Array.from(specimen.content).length > 200 ? 560 : 720),
    Math.min(safeAreaHeight, metadataLines.length > 0 ? 640 : 760),
  );
  const totalTextHeight = layout.lines.length * layout.lineHeight;
  const bodyTop = Math.round(
    safeAreaTop + Math.max(0, (safeAreaHeight - totalTextHeight) / 2),
  );

  context.font = `600 ${layout.fontSize}px ${SERIF_STACK}`;
  context.letterSpacing = "1px";
  context.fillStyle = "#fffdf8";
  context.shadowColor = "rgba(10, 14, 15, 0.24)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 2;

  layout.lines.forEach((line, index) => {
    context.fillText(line, safeAreaLeft, bodyTop + index * layout.lineHeight);
  });

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  if (metadataLines.length > 0) {
    const archiveTop = 1120 - (metadataLines.length - 1) * 40;
    context.fillStyle = "#b9934c";
    context.fillRect(112, archiveTop - 34, 124, 3);
    context.font = `500 22px ${SANS_STACK}`;
    context.letterSpacing = "1px";
    context.fillStyle = "rgba(255, 253, 248, 0.84)";
    metadataLines.forEach((line, index) => {
      context.fillText(
        truncateLineToWidth(context, line, 620),
        112,
        archiveTop + 12 + index * 40,
      );
    });
  }

  context.textAlign = "right";
  context.fillStyle = "rgba(255, 253, 248, 0.72)";
  context.font = `500 20px ${SANS_STACK}`;
  context.fillText("微光标本馆", 968, 1240);
  context.textAlign = "left";
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("图片生成失败，请再试一次。"));
      }
    }, "image/png");
  });
}

export async function renderSpecimenToBlob(
  specimen: SpecimenRecord,
  background: BackgroundAsset,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await renderSpecimenToCanvas(canvas, specimen, background);
  return canvasToBlob(canvas);
}

export function specimenFileName(specimen: SpecimenRecord): string {
  const collectedAt = new Date(specimen.createdAt);
  const date = [
    collectedAt.getFullYear(),
    String(collectedAt.getMonth() + 1).padStart(2, "0"),
    String(collectedAt.getDate()).padStart(2, "0"),
  ].join("");
  return `微光标本-${date}-${specimen.id.slice(0, 6)}.png`;
}
