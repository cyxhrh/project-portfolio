import { useCallback, useEffect, useRef, useState } from "react";

import {
  MOODS,
  getBackgroundById,
  getBackgroundCandidates,
  getNextAvailableBackground,
  getNextBackground,
  type Mood,
} from "../backgrounds/manifest";
import {
  SPECIMEN_TAGS,
  SPECIMEN_TYPES,
  countCharacters,
  createSpecimen,
  emptyDraft,
  validateContent,
  validateDetails,
  withBackground,
  type DetailErrors,
  type SpecimenDraft,
  type SpecimenRecord,
  type SpecimenTag,
  type SpecimenType,
  truncateToCharacters,
} from "../domain/specimen";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { SaveImageCanceledError, saveImage } from "../downloading/downloadImage";
import { specimenFileName } from "../rendering/cardRenderer";
import type { SpecimenRepository } from "../storage/specimenRepository";
import { SpecimenCard } from "./SpecimenCard";

type FlowStage = "content" | "details" | "making" | "revealing" | "result";

interface HomeFlowProps {
  repository: SpecimenRepository;
  onUnsavedChange: (hasUnsavedCard: boolean) => void;
}

interface ChoiceGroupProps<T extends string> {
  legend: string;
  values: readonly T[];
  selected: readonly T[];
  onSelect: (value: T) => void;
  error?: string;
  multiple?: boolean;
  disableUnselected?: boolean;
  disabled?: boolean;
}

function ChoiceGroup<T extends string>({
  legend,
  values,
  selected,
  onSelect,
  error,
  multiple = false,
  disableUnselected = false,
  disabled = false,
}: ChoiceGroupProps<T>) {
  const errorId = `${legend}-error`;

  return (
    <fieldset
      className="choice-group"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
    >
      <legend>{legend}</legend>
      <div className="choice-list">
        {values.map((value) => {
          const isSelected = selected.includes(value);
          const isDisabled = disabled || (disableUnselected && !isSelected);

          return (
            <button
              key={value}
              className={isSelected ? "choice-chip is-selected" : "choice-chip"}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={isSelected}
              disabled={isDisabled}
              onClick={() => onSelect(value)}
            >
              {isSelected && <span aria-hidden="true">✓</span>}
              {value}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function DraftCardOutline({ draft }: { draft: SpecimenDraft }) {
  return (
    <div className="draft-card" aria-label="标本卡示意">
      <div className="draft-card-inner">
        <span className="draft-card-kicker">微光标本馆 · 示意</span>
        <p>{draft.content || "你的文字会被轻轻放进这里。"}</p>
        <div className="draft-card-meta">
          {draft.type && <span>{`类型 · ${draft.type}`}</span>}
          <span>{draft.mood ? `心情 · ${draft.mood}` : "心情待选择"}</span>
          {draft.tags.length > 0 && <span>{draft.tags.join("、")}</span>}
        </div>
      </div>
    </div>
  );
}

export function HomeFlow({
  repository,
  onUnsavedChange,
}: HomeFlowProps) {
  const [stage, setStage] = useState<FlowStage>("content");
  const [draft, setDraft] = useState<SpecimenDraft>(() => emptyDraft());
  const [contentError, setContentError] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<DetailErrors>({});
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [specimen, setSpecimen] = useState<SpecimenRecord | null>(null);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [actionBusy, setActionBusy] = useState<"save" | "download" | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const [cardError, setCardError] = useState("");
  const [makingMessage, setMakingMessage] = useState("正在寻找合适的背景…");
  const [renderAttempt, setRenderAttempt] = useState(0);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const detailsHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const failedBackgroundIdsRef = useRef(new Set<string>());
  const reducedMotion = useReducedMotion();

  const background = specimen ? getBackgroundById(specimen.backgroundId) : undefined;

  useEffect(() => {
    onUnsavedChange(isDirty);
  }, [isDirty, onUnsavedChange]);

  useEffect(() => {
    if (stage === "details") detailsHeadingRef.current?.focus();
    if (stage === "result") resultHeadingRef.current?.focus();
  }, [stage]);

  useEffect(() => {
    if (stage !== "making") return;
    setMakingMessage("正在寻找合适的背景…");
    const timer = window.setTimeout(
      () => setMakingMessage("正在装入你的文字…"),
      360,
    );
    return () => window.clearTimeout(timer);
  }, [stage]);

  const completeReveal = useCallback(() => {
    setStage("result");
  }, []);

  useEffect(() => {
    if (stage !== "revealing") return;
    const timer = window.setTimeout(completeReveal, 480);
    return () => window.clearTimeout(timer);
  }, [completeReveal, stage]);

  const handleContentChange = (content: string) => {
    const nextContent = truncateToCharacters(content, 300);
    const characterCount = countCharacters(nextContent);
    setDraft((current) => ({ ...current, content: nextContent }));
    setContentError(characterCount === 300 ? "最多写 300 字。" : null);
  };

  const continueToDetails = () => {
    const error = validateContent(draft.content);
    setContentError(error);

    if (error) {
      contentInputRef.current?.focus();
      return;
    }

    setStage("details");
  };

  const returnToContent = () => {
    setStage("content");
    window.requestAnimationFrame(() => {
      const input = contentInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  };

  const chooseType = (type: SpecimenType) => {
    setDraft((current) => ({
      ...current,
      type: current.type === type ? null : type,
    }));
  };

  const chooseMood = (mood: Mood) => {
    setDraft((current) => ({ ...current, mood }));
    setDetailErrors((current) => ({ ...current, mood: undefined }));
  };

  const toggleTag = (tag: SpecimenTag) => {
    setDraft((current) => {
      const tags = current.tags.includes(tag)
        ? current.tags.filter((item) => item !== tag)
        : [...current.tags, tag].slice(0, 3);
      return { ...current, tags };
    });
  };

  const updateAnnotation = (
    field: "source" | "author",
    value: string,
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const toggleCollectedDate = () => {
    setDraft((current) => ({
      ...current,
      showCollectedDate: !current.showCollectedDate,
    }));
  };

  const makeSpecimen = () => {
    const errors = validateDetails(draft);
    setDetailErrors(errors);
    if (Object.keys(errors).length > 0 || !draft.mood) return;

    const firstBackground = getBackgroundCandidates(draft.mood)[0];
    const nextSpecimen = createSpecimen(draft, firstBackground);
    setSpecimen(nextSpecimen);
    setCardBlob(null);
    setCardError("");
    setStatusMessage("");
    failedBackgroundIdsRef.current.clear();
    setIsSaved(false);
    setIsDirty(true);
    setStage("making");
  };

  const cancelMaking = () => {
    setStage("details");
    setSpecimen(null);
    setCardBlob(null);
    setCardError("");
    failedBackgroundIdsRef.current.clear();
    setIsDirty(false);
    setStatusMessage("");
  };

  const handleCardReady = () => {
    failedBackgroundIdsRef.current.clear();
    setIsSwitching(false);
    setCardError("");
    setStatusMessage((current) =>
      current === "这张背景暂时不可用，正在自动换一张。"
        ? "已自动换到可用背景。"
        : current,
    );

    if (stage === "making") {
      if (reducedMotion) completeReveal();
      else setStage("revealing");
    }
  };

  const handleCardError = (message: string) => {
    if (specimen) {
      failedBackgroundIdsRef.current.add(specimen.backgroundId);
      const nextBackground = getNextAvailableBackground(
        specimen.mood,
        specimen.backgroundId,
        failedBackgroundIdsRef.current,
      );

      if (nextBackground) {
        setIsSwitching(true);
        setCardBlob(null);
        setCardError("");
        setStatusMessage("这张背景暂时不可用，正在自动换一张。");
        setSpecimen(withBackground(specimen, nextBackground));
        return;
      }
    }

    setIsSwitching(false);
    setStatusMessage("");
    setCardError(message);
  };

  const retryCard = () => {
    failedBackgroundIdsRef.current.clear();
    setCardError("");
    setRenderAttempt((attempt) => attempt + 1);
  };

  const saveSpecimen = async () => {
    if (!specimen) return;
    setActionBusy("save");
    setStatusMessage("");

    try {
      await repository.save(specimen);
      setIsSaved(true);
      setIsDirty(false);
      setStatusMessage("已放进你的标本馆。");
    } catch {
      setStatusMessage("暂时没能保存，请再试一次。");
    } finally {
      setActionBusy(null);
    }
  };

  const downloadSpecimen = async () => {
    if (!specimen || !cardBlob) {
      setStatusMessage("图片还在准备，请稍等一下再下载。");
      return;
    }

    setActionBusy("download");
    setStatusMessage("");

    try {
      const method = await saveImage(cardBlob, specimenFileName(specimen));
      setStatusMessage(
        method === "picker"
          ? "已保存图片。可在刚才选择的位置找到它。"
          : "图片已下载。请在浏览器的下载内容或文件 App 中查看。",
      );
    } catch (error) {
      if (error instanceof SaveImageCanceledError) {
        setStatusMessage("已取消保存，图片仍在这里。");
        return;
      }
      setStatusMessage("图片下载失败，请再试一次。");
    } finally {
      setActionBusy(null);
    }
  };

  const switchBackground = () => {
    if (!specimen || isSwitching) return;
    const next = getNextBackground(specimen.mood, specimen.backgroundId);
    failedBackgroundIdsRef.current.clear();
    setIsSwitching(true);
    setCardBlob(null);
    setSpecimen(withBackground(specimen, next.background));
    setIsDirty(true);
    setStatusMessage(next.wrapped ? "已看完这一组背景。" : "");
  };

  const startAnother = () => {
    if (
      isDirty &&
      !window.confirm("这张标本还没有收入标本馆，仍要离开吗？")
    ) {
      return;
    }

    setStage("content");
    setDraft(emptyDraft());
    setContentError(null);
    setDetailErrors({});
    setIsAnnotationOpen(false);
    setSpecimen(null);
    setCardBlob(null);
    setIsSaved(false);
    setIsDirty(false);
    setStatusMessage("");
    setCardError("");
    failedBackgroundIdsRef.current.clear();
    window.requestAnimationFrame(() => contentInputRef.current?.focus());
  };

  if (stage === "content") {
    const contentIsEmpty = draft.content.trim().length === 0;

    return (
      <main className="page-shell home-step-one" id="main-content">
        <div className="content-step-grid">
          <section className="editor-panel" aria-labelledby="content-title">
            <p className="step-label"><span>01</span> / 写下此刻</p>
            <h1 id="content-title">今天想留下什么？</h1>
            <p className="page-lede">一闪而过的想法，也值得被听见。</p>
            <div className={contentError ? "writing-paper has-error" : "writing-paper"}>
              <label className="sr-only" htmlFor="specimen-content">
                标本内容
              </label>
              <textarea
                ref={contentInputRef}
                id="specimen-content"
                value={draft.content}
                aria-describedby="content-help content-error"
                aria-invalid={Boolean(contentError && draft.content.trim().length === 0)}
                placeholder="写下一句话、一个念头，或一个还没想明白的问题……"
                onChange={(event) => handleContentChange(event.target.value)}
              />
              <span className="character-count">{countCharacters(draft.content)} / 300</span>
            </div>
            <div className="message-slot" id="content-error" aria-live="polite">
              {contentError && <p className="field-error">{contentError}</p>}
            </div>
            <button
              className="primary-button full-button"
              type="button"
              aria-disabled={contentIsEmpty}
              onClick={continueToDetails}
            >
              继续
            </button>
            <p className="next-hint" id="content-help">
              <span aria-hidden="true" />下一步选择心情；其他标注可按需添加<span aria-hidden="true" />
            </p>
          </section>
          <aside className="desktop-draft-preview" aria-label="标本卡示意预览">
            <DraftCardOutline draft={draft} />
          </aside>
        </div>
      </main>
    );
  }

  if (stage === "details" || stage === "making") {
    const making = stage === "making";
    const tagLimitReached = draft.tags.length >= 3;

    return (
      <main className="page-shell" id="main-content">
        <div className="workspace-grid">
          <section className="editor-panel" aria-labelledby="details-title">
            <p className="step-label"><span>02</span> / 补充线索</p>
            <h1 ref={detailsHeadingRef} id="details-title" tabIndex={-1}>
              给这一刻一点气候
            </h1>
            <div className="content-summary">
              <p>{draft.content}</p>
              <button className="text-button" type="button" onClick={returnToContent} disabled={making}>
                返回修改
              </button>
            </div>
            <ChoiceGroup
              legend="心情 · 必选"
              values={MOODS}
              selected={draft.mood ? [draft.mood] : []}
              onSelect={chooseMood}
              error={detailErrors.mood}
              disabled={making}
            />
            <section className="annotation-section" aria-label="补充标注">
              <button
                className="annotation-toggle"
                type="button"
                aria-expanded={isAnnotationOpen}
                onClick={() => setIsAnnotationOpen((current) => !current)}
                disabled={making}
              >
                <span aria-hidden="true">{isAnnotationOpen ? "−" : "+"}</span>
                <span>
                  <strong>补充标注（可选）</strong>
                  <small>类型、标签、出处、作者与日期显示</small>
                </span>
                <i aria-hidden="true">{isAnnotationOpen ? "⌃" : "⌄"}</i>
              </button>
              {isAnnotationOpen && (
                <div className="annotation-fields">
                  <ChoiceGroup
                    legend="类型（可选）"
                    values={SPECIMEN_TYPES}
                    selected={draft.type ? [draft.type] : []}
                    onSelect={chooseType}
                    disabled={making}
                  />
                  <ChoiceGroup
                    legend="标签（可选）"
                    values={SPECIMEN_TAGS}
                    selected={draft.tags}
                    onSelect={toggleTag}
                    multiple
                    disabled={making}
                    disableUnselected={tagLimitReached}
                  />
                  {tagLimitReached && (
                    <p className="selection-note" role="status">
                      最多选择 3 个标签。
                    </p>
                  )}
                  <div className="source-fields">
                    <label>
                      <span>出处（可选）</span>
                      <input
                        type="text"
                        value={draft.source}
                        maxLength={60}
                        placeholder="作品、书籍、歌名或其他来源"
                        onChange={(event) => updateAnnotation("source", event.target.value)}
                        disabled={making}
                      />
                    </label>
                    <label>
                      <span>作者（可选）</span>
                      <input
                        type="text"
                        value={draft.author}
                        maxLength={40}
                        placeholder="作者、创作者或说话的人"
                        onChange={(event) => updateAnnotation("author", event.target.value)}
                        disabled={making}
                      />
                    </label>
                  </div>
                  <label className="date-visibility-toggle">
                    <input
                      type="checkbox"
                      checked={draft.showCollectedDate}
                      onChange={toggleCollectedDate}
                      disabled={making}
                    />
                    <span>在卡片上显示采集日期</span>
                  </label>
                </div>
              )}
            </section>
            <button
              className="primary-button full-button"
              type="button"
              disabled={making}
              onClick={makeSpecimen}
            >
              {making ? "正在制作…" : "制作这张标本"}
            </button>
            {making && (
              <button className="text-button cancel-making" type="button" onClick={cancelMaking}>
                取消
              </button>
            )}
          </section>
          <aside className="card-column">
            {making && specimen && background ? (
              <SpecimenCard
                key={`${specimen.id}-${renderAttempt}`}
                specimen={specimen}
                background={background}
                className="is-making"
                loadingLabel={makingMessage}
                onBlobReady={setCardBlob}
                onReady={handleCardReady}
                onError={handleCardError}
              />
            ) : (
              <DraftCardOutline draft={draft} />
            )}
            {cardError && (
              <div className="inline-recovery" role="alert">
                <p>这次没有制作成功。你的内容还在。</p>
                <button className="secondary-button" type="button" onClick={retryCard}>
                  再试一次
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>
    );
  }

  if (!specimen || !background) return null;

  return (
    <main className="page-shell result-page" id="main-content">
      <div className="result-grid home-result-grid">
        <section className="result-intro" aria-labelledby="result-title">
          <p className="step-label"><span>标本</span> / {specimen.type ?? specimen.mood}</p>
          <h1 ref={resultHeadingRef} id="result-title" tabIndex={-1}>
            你的标本已制成
          </h1>
          <p className="page-lede">把这一刻收入馆中，或保存图片留在身边。</p>
        </section>
        <section className="result-action-panel" aria-label="标本操作">
          <div className="result-actions">
            <button
              className="primary-button"
              type="button"
              disabled={actionBusy !== null || (isSaved && !isDirty)}
              onClick={() => void saveSpecimen()}
            >
              {actionBusy === "save"
                ? "正在保存…"
                : isSaved && isDirty
                  ? "保存更改"
                  : isSaved
                    ? "已收入标本馆"
                    : "收入标本馆"}
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={actionBusy !== null || !cardBlob}
              onClick={() => void downloadSpecimen()}
            >
              {actionBusy === "download" ? "正在保存…" : "保存图片"}
            </button>
          </div>
          <p className="download-guidance">
            电脑端建议保存到「桌面／微光标本馆」；手机请在下载内容或文件 App 中查看。
          </p>
          <div className="secondary-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={isSwitching}
              onClick={switchBackground}
            >
              {isSwitching ? "正在换一张…" : "换一张背景"}
            </button>
            <button className="text-button" type="button" onClick={startAnother}>
              再做一张
            </button>
          </div>
          <div className="status-message" aria-live="polite">
            {statusMessage}
          </div>
        </section>
        <section className="card-column result-card-column" aria-label="生成结果">
          <SpecimenCard
            key={`${specimen.id}-${renderAttempt}`}
            specimen={specimen}
            background={background}
            className={`${stage === "revealing" ? "is-revealing" : ""} ${isSwitching ? "is-switching" : ""}`}
            loadingLabel={isSwitching ? "正在换一张…" : "正在装入你的文字…"}
            onBlobReady={setCardBlob}
            onReady={handleCardReady}
            onError={handleCardError}
          />
          {stage === "revealing" && !reducedMotion && (
            <button className="skip-reveal" type="button" onClick={completeReveal}>
              跳过动画
            </button>
          )}
          {cardError && (
            <div className="inline-recovery" role="alert">
              <p>{cardError}</p>
              <button className="secondary-button" type="button" onClick={retryCard}>
                再试一次
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
