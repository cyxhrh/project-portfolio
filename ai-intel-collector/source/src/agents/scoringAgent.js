const HIGH_VALUE_CATEGORIES = new Set(["模型发布", "API更新", "Agent", "多模态", "开源模型", "论文研究", "产品动态"]);
const ARXIV_KEYWORDS = ["agent", "rag", "llm", "multimodal", "reasoning", "code", "benchmark", "memory", "tool", "workflow"];

function includesAny(text, keywords) {
  const normalized = String(text || "").toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function isGithubLowValueRelease(item) {
  const text = `${item.title || ""} ${item.summary_placeholder || ""}`.toLowerCase();
  return item.source_type === "github" && (text.includes("nightly") || text.includes("patch release") || text.match(/\bv?\d+\.\d+\.\d+\b/));
}

function isArxivDeepDiveCandidate(item, configuredKeywords) {
  if (!String(item.source_name || "").toLowerCase().includes("arxiv")) {
    return false;
  }

  return includesAny(item.title, configuredKeywords && configuredKeywords.length ? configuredKeywords : ARXIV_KEYWORDS);
}

function scoreItem(item, settings = {}) {
  let score = 35;
  const reasons = [];

  if (item.source_priority === "high") {
    score += 25;
    reasons.push("高优先级来源");
  } else if (item.source_priority === "medium") {
    score += 10;
    reasons.push("中优先级来源");
  }

  if (HIGH_VALUE_CATEGORIES.has(item.category)) {
    score += 18;
    reasons.push(`高价值分类：${item.category}`);
  }

  if (item.published_at) {
    score += 5;
    reasons.push("包含发布时间");
  }

  if (item.summary_placeholder && item.summary_placeholder.length > 40) {
    score += 7;
    reasons.push("已有摘要线索");
  }

  if (isArxivDeepDiveCandidate(item, settings.arxivDeepDiveKeywords)) {
    score += 18;
    reasons.push("arXiv 标题命中深挖关键词");
  }

  if (isGithubLowValueRelease(item)) {
    score -= 25;
    reasons.push("GitHub patch/nightly 类发布，降低深度摘要优先级");
  }

  score = Math.max(0, Math.min(100, score));

  const shouldDeepDive =
    score >= 70 &&
    !isGithubLowValueRelease(item) &&
    (!String(item.source_name || "").toLowerCase().includes("arxiv") || isArxivDeepDiveCandidate(item, settings.arxivDeepDiveKeywords));

  let summaryDepth = "short";
  if (shouldDeepDive) {
    summaryDepth = "full";
  } else if (score >= 55) {
    summaryDepth = "medium";
  }

  return {
    importance_score: score,
    importance_reason: reasons.join("；") || "基础情报，暂未命中高价值规则",
    should_deep_dive: shouldDeepDive,
    summary_depth: summaryDepth,
    should_call_ai: shouldDeepDive || (summaryDepth === "medium" && item.source_priority !== "low")
  };
}

module.exports = {
  scoreItem,
  isGithubLowValueRelease,
  isArxivDeepDiveCandidate
};
