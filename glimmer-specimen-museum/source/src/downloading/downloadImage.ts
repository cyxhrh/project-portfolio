interface DownloadAnchor {
  href: string;
  download: string;
  rel: string;
  style: { display: string };
  click(): void;
  remove(): void;
}

export interface DownloadEnvironment {
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  createAnchor(): DownloadAnchor;
  appendAnchor(anchor: DownloadAnchor): void;
  scheduleRelease(callback: () => void, delay: number): void;
}

interface WritableImageFile {
  write(data: Blob | ArrayBuffer): Promise<void>;
  close(): Promise<void>;
}

interface ImageFileHandle {
  createWritable(): Promise<WritableImageFile>;
}

interface SaveFilePickerOptions {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}

export interface SaveEnvironment extends DownloadEnvironment {
  showSaveFilePicker?: (
    options: SaveFilePickerOptions,
  ) => Promise<ImageFileHandle>;
}

export type SaveMethod = "picker" | "download";

export class SaveImageCanceledError extends Error {
  constructor() {
    super("Image saving was cancelled.");
    this.name = "SaveImageCanceledError";
  }
}

const browserDownloadEnvironment: DownloadEnvironment = {
  createObjectUrl: (blob) => URL.createObjectURL(blob),
  revokeObjectUrl: (url) => URL.revokeObjectURL(url),
  createAnchor: () => document.createElement("a"),
  appendAnchor: (anchor) => document.body.append(anchor as HTMLAnchorElement),
  scheduleRelease: (callback, delay) => {
    window.setTimeout(callback, delay);
  },
};

const browserWindow =
  typeof window === "undefined"
    ? undefined
    : (window as Window & {
        showSaveFilePicker?: (
          options: SaveFilePickerOptions,
        ) => Promise<ImageFileHandle>;
      });

const usesEmbeddedDesktopBrowser = /Electron/i.test(
  browserWindow?.navigator.userAgent ?? "",
);

const browserSaveEnvironment: SaveEnvironment = {
  ...browserDownloadEnvironment,
  showSaveFilePicker: !usesEmbeddedDesktopBrowser && browserWindow?.showSaveFilePicker
    ? (options) => browserWindow.showSaveFilePicker!(options)
    : undefined,
};

export async function downloadImage(
  blob: Blob,
  fileName: string,
  environment: DownloadEnvironment = browserDownloadEnvironment,
): Promise<void> {
  const objectUrl = environment.createObjectUrl(blob);
  const anchor = environment.createAnchor();

  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  environment.appendAnchor(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    environment.scheduleRelease(
      () => environment.revokeObjectUrl(objectUrl),
      60_000,
    );
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function saveImage(
  blob: Blob,
  fileName: string,
  environment: SaveEnvironment = browserSaveEnvironment,
): Promise<SaveMethod> {
  if (!environment.showSaveFilePicker) {
    await downloadImage(blob, fileName, environment);
    return "download";
  }

  try {
    const fileHandle = await environment.showSaveFilePicker({
      suggestedName: fileName,
      types: [
        {
          description: "PNG 图片",
          accept: { "image/png": [".png"] },
        },
      ],
    });
    const writable = await fileHandle.createWritable();
    await writable.write(await blob.arrayBuffer());
    await writable.close();
    return "picker";
  } catch (error) {
    if (isAbortError(error)) throw new SaveImageCanceledError();

    await downloadImage(blob, fileName, environment);
    return "download";
  }
}
