import { useCallback, useEffect, useRef, useState } from "react";

import {
  getBackgroundById,
  getBackgroundCandidates,
  type BackgroundAsset,
} from "../backgrounds/manifest";
import type { SpecimenRecord } from "../domain/specimen";
import { SaveImageCanceledError, saveImage } from "../downloading/downloadImage";
import { specimenFileName } from "../rendering/cardRenderer";
import type { SpecimenRepository } from "../storage/specimenRepository";
import {
  formatCardMeta,
  formatMonth,
  groupSpecimensByMonth,
  monthKey,
} from "./galleryRevisit";
import { SpecimenCard } from "./SpecimenCard";

interface GalleryProps {
  repository: SpecimenRepository;
  onNavigateHome: () => void;
}

interface PendingListRestore {
  focusCardId?: string;
  targetMonth?: string;
  top: number;
}

function resolveBackground(specimen: SpecimenRecord): BackgroundAsset {
  return (
    getBackgroundById(specimen.backgroundId) ??
    getBackgroundCandidates(specimen.mood)[0]
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

export function Gallery({ repository, onNavigateHome }: GalleryProps) {
  const [specimens, setSpecimens] = useState<SpecimenRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [blobs, setBlobs] = useState<Record<string, Blob>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const listScrollPositionRef = useRef(0);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingListRestoreRef = useRef<PendingListRestore | null>(null);

  const loadSpecimens = useCallback(async () => {
    setLoading(true);
    try {
      setSpecimens(await repository.list());
    } catch {
      setStatus("暂时没能打开标本馆，请刷新后再试一次。");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void loadSpecimens();
  }, [loadSpecimens]);

  const selected = specimens.find((item) => item.id === selectedId);
  const groups = groupSpecimensByMonth(specimens);

  useEffect(() => {
    if (!selected) return;

    window.scrollTo({ top: 0, behavior: "auto" });
    detailHeadingRef.current?.focus({ preventScroll: true });
  }, [selected]);

  useEffect(() => {
    if (loading || selectedId !== null || !pendingListRestoreRef.current) return;

    const pending = pendingListRestoreRef.current;
    pendingListRestoreRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      const month = pending.targetMonth
        ? monthRefs.current[pending.targetMonth]
        : null;

      if (month) month.scrollIntoView({ block: "start" });
      else window.scrollTo({ top: pending.top, behavior: "auto" });

      if (pending.focusCardId) {
        cardRefs.current[pending.focusCardId]?.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loading, selectedId, specimens]);

  const openSpecimen = (id: string) => {
    listScrollPositionRef.current = window.scrollY;
    setStatus("");
    setSelectedId(id);
  };

  const closeDetail = () => {
    const currentId = selectedId ?? undefined;
    pendingListRestoreRef.current = {
      focusCardId: currentId,
      top: listScrollPositionRef.current,
    };
    setSelectedId(null);
  };

  const deleteSpecimen = async (specimen: SpecimenRecord) => {
    if (!window.confirm("确定从标本馆删除这张卡吗？删除后无法恢复。")) return;

    const targetMonth = monthKey(specimen.createdAt);
    setBusyId(specimen.id);
    setStatus("");
    try {
      await repository.remove(specimen.id);
      pendingListRestoreRef.current = {
        targetMonth,
        top: listScrollPositionRef.current,
      };
      setSpecimens((current) => current.filter((item) => item.id !== specimen.id));
      setSelectedId(null);
      setStatus("这张标本已从馆中移除。");
    } catch {
      setStatus("暂时没能删除，请再试一次。");
    } finally {
      setBusyId(null);
    }
  };

  const downloadSpecimen = async (specimen: SpecimenRecord) => {
    const blob = blobs[specimen.id];
    if (!blob) {
      setStatus("图片还在准备，请稍等一下再下载。");
      return;
    }

    setBusyId(specimen.id);
    setStatus("");
    try {
      const method = await saveImage(blob, specimenFileName(specimen));
      setStatus(
        method === "picker"
          ? "已保存图片。可在刚才选择的位置找到它。"
          : "图片已下载。请在浏览器的下载内容或文件 App 中查看。",
      );
    } catch (error) {
      if (error instanceof SaveImageCanceledError) {
        setStatus("已取消保存，图片仍在这里。");
        return;
      }
      setStatus("图片下载失败，请再试一次。");
    } finally {
      setBusyId(null);
    }
  };

  if (selected) {
    const background = resolveBackground(selected);
    const selectedMonth = formatMonth(selected.createdAt);

    return (
      <main className="page-shell gallery-detail" id="main-content">
        <div className="gallery-detail-layout">
          <section className="gallery-detail-card card-column" aria-label="标本卡">
            <SpecimenCard
              specimen={selected}
              background={background}
              onBlobReady={(blob) =>
                setBlobs((current) => ({ ...current, [selected.id]: blob }))
              }
            />
          </section>
          <section className="gallery-detail-copy" aria-labelledby="gallery-detail-title">
            <button className="text-button back-link" type="button" onClick={closeDetail}>
              ← 返回 {selectedMonth}
            </button>
            <p className="step-label"><span>馆藏</span> / {selected.type ?? selected.mood}</p>
            <h1 ref={detailHeadingRef} id="gallery-detail-title" tabIndex={-1}>
              这一刻仍在发光
            </h1>
            <p className="page-lede">采集于 {formatDate(selected.createdAt)}</p>
            <div className="gallery-detail-actions">
              <button
                className="primary-button"
                type="button"
                disabled={busyId === selected.id || !blobs[selected.id]}
                onClick={() => void downloadSpecimen(selected)}
              >
                {busyId === selected.id ? "正在保存…" : "保存图片"}
              </button>
              <button
                className="danger-text-button"
                type="button"
                disabled={busyId === selected.id}
                onClick={() => void deleteSpecimen(selected)}
              >
                删除这张标本
              </button>
            </div>
            <div className="status-message" aria-live="polite">{status}</div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell gallery-page" id="main-content">
      <header className="gallery-heading">
        <div>
          <p className="step-label"><span>馆藏</span> / 按月回看</p>
          <h1>标本馆</h1>
          <p className="page-lede">把留住的片刻，按月份慢慢翻看。</p>
          {!loading && <p className="gallery-total">共 {specimens.length} 份标本</p>}
        </div>
      </header>

      <div className="status-message gallery-status" aria-live="polite">{status}</div>

      {loading ? (
        <div className="gallery-loading" role="status">正在打开标本馆…</div>
      ) : specimens.length === 0 ? (
        <section className="empty-gallery">
          <div className="empty-card-outline" aria-hidden="true" />
          <h2>这里还没有标本。</h2>
          <p>把一句想留下的话，做成第一张小卡片吧。</p>
          <button className="primary-button" type="button" onClick={onNavigateHome}>
            去制作一张
          </button>
        </section>
      ) : (
        <div className="monthly-galleries" aria-label="按月保存的标本">
          {groups.map((group) => (
            <section
              className="monthly-gallery"
              key={group.key}
              ref={(element) => { monthRefs.current[group.key] = element; }}
              aria-labelledby={`month-${group.key}`}
            >
              <header className="monthly-gallery-heading">
                <h2 id={`month-${group.key}`}>{group.title}</h2>
                <p>{group.summary}</p>
              </header>
              <div className="gallery-grid">
                {group.specimens.map((specimen) => {
                  const background = resolveBackground(specimen);
                  const cardMeta = formatCardMeta(specimen);

                  return (
                    <article className="gallery-item" key={specimen.id}>
                      <button
                        className="gallery-card-button"
                        type="button"
                        ref={(element) => { cardRefs.current[specimen.id] = element; }}
                        aria-label={`查看标本：${specimen.content}`}
                        onClick={() => openSpecimen(specimen.id)}
                      >
                        <SpecimenCard specimen={specimen} background={background} />
                        <span className="gallery-card-excerpt">{specimen.content}</span>
                        <span className="gallery-card-meta">{cardMeta}</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
