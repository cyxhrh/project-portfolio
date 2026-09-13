import { useEffect, useRef, useState } from "react";

import type { BackgroundAsset } from "../backgrounds/manifest";
import type { SpecimenRecord } from "../domain/specimen";
import { renderSpecimenToCanvas } from "../rendering/cardRenderer";

interface SpecimenCardProps {
  specimen: SpecimenRecord;
  background: BackgroundAsset;
  className?: string;
  loadingLabel?: string;
  onReady?: () => void;
  onBlobReady?: (blob: Blob) => void;
  onError?: (message: string) => void;
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片生成失败，请再试一次。"));
    }, "image/png");
  });
}

export function SpecimenCard({
  specimen,
  background,
  className = "",
  loadingLabel = "正在装入你的文字…",
  onReady,
  onBlobReady,
  onError,
}: SpecimenCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onReady, onBlobReady, onError });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    callbacks.current = { onReady, onBlobReady, onError };
  }, [onBlobReady, onError, onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stagingCanvas = document.createElement("canvas");
    let cancelled = false;

    if (!canvas) return;
    setState("loading");

    void renderSpecimenToCanvas(stagingCanvas, specimen, background)
      .then(async () => {
        const blob = await canvasBlob(stagingCanvas);
        if (cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) throw new Error("当前浏览器无法绘制标本卡。");
        canvas.width = stagingCanvas.width;
        canvas.height = stagingCanvas.height;
        context.drawImage(stagingCanvas, 0, 0);
        setState("ready");
        callbacks.current.onBlobReady?.(blob);
        callbacks.current.onReady?.();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "这次没有制作成功。你的内容还在。";
        setState("error");
        callbacks.current.onError?.(message);
      });

    return () => {
      cancelled = true;
    };
  }, [background, specimen]);

  return (
    <div className={`specimen-card-shell ${className}`} data-state={state}>
      <canvas
        ref={canvasRef}
        className="specimen-card-canvas"
        role="img"
        aria-label={`${specimen.type ?? specimen.mood}标本：${specimen.content}`}
      />
      {state === "loading" && (
        <div className="card-loading" role="status">
          {loadingLabel}
        </div>
      )}
      {state === "error" && (
        <div className="card-loading card-loading-error" role="alert">
          这张背景暂时不可用。
        </div>
      )}
    </div>
  );
}
