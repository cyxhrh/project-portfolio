import { describe, expect, it, vi } from "vitest";

import {
  SaveImageCanceledError,
  downloadImage,
  saveImage,
  type DownloadEnvironment,
  type SaveEnvironment,
} from "./downloadImage";

function createEnvironment() {
  const anchor = {
    href: "",
    download: "",
    rel: "",
    style: { display: "" },
    click: vi.fn(),
    remove: vi.fn(),
  };
  let release: (() => void) | undefined;
  const environment: DownloadEnvironment = {
    createObjectUrl: vi.fn(() => "blob:specimen"),
    revokeObjectUrl: vi.fn(),
    createAnchor: vi.fn(() => anchor),
    appendAnchor: vi.fn(),
    scheduleRelease: vi.fn((callback) => {
      release = callback;
    }),
  };

  return { anchor, environment, getRelease: () => release };
}

describe("PNG download", () => {
  it("downloads the provided blob with the specimen file name", async () => {
    const blob = new Blob(["png"], { type: "image/png" });
    const { anchor, environment, getRelease } = createEnvironment();

    await downloadImage(blob, "微光标本-20260722.png", environment);

    expect(environment.createObjectUrl).toHaveBeenCalledWith(blob);
    expect(anchor).toMatchObject({
      href: "blob:specimen",
      download: "微光标本-20260722.png",
      rel: "noopener",
      style: { display: "none" },
    });
    expect(environment.appendAnchor).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(environment.scheduleRelease).toHaveBeenCalledWith(
      expect.any(Function),
      60_000,
    );

    getRelease()?.();
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:specimen");
  });

  it("removes the temporary link even when the browser rejects the click", async () => {
    const { anchor, environment } = createEnvironment();
    anchor.click.mockImplementation(() => {
      throw new Error("download blocked");
    });

    await expect(
      downloadImage(new Blob(["png"]), "specimen.png", environment),
    ).rejects.toThrow("download blocked");
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(environment.scheduleRelease).toHaveBeenCalledOnce();
  });
});

describe("image saving", () => {
  it("uses the system save window when the browser provides one", async () => {
    const { anchor, environment } = createEnvironment();
    const writable = { write: vi.fn(), close: vi.fn() };
    const showSaveFilePicker = vi.fn(async () => ({
      createWritable: vi.fn(async () => writable),
    }));
    const saveEnvironment: SaveEnvironment = { ...environment, showSaveFilePicker };
    const blob = new Blob(["png"], { type: "image/png" });

    await expect(saveImage(blob, "specimen.png", saveEnvironment)).resolves.toBe(
      "picker",
    );
    expect(showSaveFilePicker).toHaveBeenCalledWith({
      suggestedName: "specimen.png",
      types: [
        {
          description: "PNG 图片",
          accept: { "image/png": [".png"] },
        },
      ],
    });
    expect(writable.write).toHaveBeenCalledWith(await blob.arrayBuffer());
    expect(writable.close).toHaveBeenCalledOnce();
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it("falls back to a normal browser download when no save window is available", async () => {
    const { anchor, environment } = createEnvironment();

    await expect(
      saveImage(new Blob(["png"]), "specimen.png", environment),
    ).resolves.toBe("download");
    expect(anchor.click).toHaveBeenCalledOnce();
  });

  it("keeps the image in place when the user cancels the system save window", async () => {
    const { anchor, environment } = createEnvironment();
    const abortError = new DOMException("The user aborted a request.", "AbortError");
    const saveEnvironment: SaveEnvironment = {
      ...environment,
      showSaveFilePicker: vi.fn(async () => Promise.reject(abortError)),
    };

    await expect(
      saveImage(new Blob(["png"]), "specimen.png", saveEnvironment),
    ).rejects.toBeInstanceOf(SaveImageCanceledError);
    expect(anchor.click).not.toHaveBeenCalled();
  });
});
