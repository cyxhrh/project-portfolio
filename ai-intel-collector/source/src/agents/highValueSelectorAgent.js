const { scoreItem, isGithubLowValueRelease } = require("./scoringAgent");

const TARGET_CATEGORIES = new Set(["模型发布", "API更新", "Agent", "工具更新", "产品动态", "多模态", "开源模型"]);
const OFFICIAL_SOURCE_KEYWORDS = ["openai", "anthropic", "google", "qwen", "deepseek"];
const PROJECT_KEYWORDS = ["agent", "api", "codex", "workflow", "automation", "tool", "tools", "model", "release", "sdk", "computer use"];
const IMPORTANT_GITHUB_KEYWORDS = ["major", "release", "agent", "api", "codex", "workflow", "tool", "model", "breaking"];

function textFor(item) {
  return `${item.title || ""} ${item.summary_placeholder || ""} ${item.source_name || ""}`.toLowerCase();
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function isArxiv(item) {
  return String(item.source_name || "").toLowerCase().includes("arxiv");
}

function isOfficialSource(item) {
  const source = String(item.source_name || "").toLowerCase();
  return OFFICIAL_SOURCE_KEYWORDS.some((keyword) => source.includes(keyword));
}

function isUsefulGithubRelease(item) {
  if (item.source_type !== "github") {
    return true;
  }

  if (isGithubLowValueRelease(item)) {
    return false;
  }

  return includesAny(textFor(item), IMPORTANT_GITHUB_KEYWORDS);
}

function buildSelectedReason(item, selectionScore, reasons) {
  return `selection_score=${selectionScore}; ${reasons.join("；")}`;
}

function scoreForSelection(item, settings) {
  const scoring = item.importance_score === undefined ? scoreItem(item, settings) : null;
  const baseScore = item.importance_score === undefined ? scoring.importance_score : item.importance_score;
  const reasons = [];
  let selectionScore = baseScore;
  const text = textFor(item);

  if (isOfficialSource(item)) {
    selectionScore += 22;
    reasons.push("官方一手来源");
  }

  if (TARGET_CATEGORIES.has(item.category)) {
    selectionScore += 12;
    reasons.push(`项目相关分类：${item.category}`);
  }

  if (includesAny(text, PROJECT_KEYWORDS)) {
    selectionScore += 14;
    reasons.push("命中 Agent/API/Codex/自动化/工具/模型关键词");
  }

  if (item.source_priority === "high") {
    selectionScore += 12;
    reasons.push("高优先级来源");
  }

  if (item.content_fetch_status === "success") {
    selectionScore += 10;
    reasons.push("正文抓取成功");
  } else if (item.content_fetch_status) {
    selectionScore -= 18;
    reasons.push(`正文不可用：${item.content_fetch_status}`);
  }

  if (isArxiv(item)) {
    selectionScore -= 8;
    reasons.push("arXiv 论文限额参与");
  }

  if (item.source_type === "github") {
    selectionScore -= 10;
    reasons.push("GitHub release 默认降权");
  }

  return {
    ...item,
    importance_score: baseScore,
    importance_reason: item.importance_reason || (scoring && scoring.importance_reason) || "",
    selection_score: selectionScore,
    selected_reason: buildSelectedReason(item, selectionScore, reasons.length ? reasons : ["基础重要性排序"])
  };
}

function canUseForAiSummary(item) {
  if (!isUsefulGithubRelease(item)) {
    return false;
  }

  if (item.importance_score < 60) {
    return false;
  }

  return TARGET_CATEGORIES.has(item.category) || item.source_priority === "high";
}

function selectTopItemsForAiSummary(items, settings) {
  const scored = items.map((item) => scoreForSelection(item, settings));
  const sorted = scored.filter(canUseForAiSummary).sort((a, b) => b.selection_score - a.selection_score);
  const maxItems = settings.summaryMaxItems || 5;
  const maxArxivItems = settings.maxArxivTopItems ?? 2;
  const selected = [];
  let arxivCount = 0;

  for (const item of sorted) {
    if (selected.length >= maxItems) {
      break;
    }

    if (isArxiv(item)) {
      if (arxivCount >= maxArxivItems) {
        continue;
      }
      arxivCount += 1;
    }

    selected.push(item);
  }

  return selected;
}

module.exports = {
  selectTopItemsForAiSummary,
  canUseForAiSummary,
  scoreForSelection
};
