const { buildIntelCardPrompt } = require("../prompts/intelCardPrompt");
const { canCallModel, createChatCompletion } = require("../llm/openaiCompatibleClient");
const { scoreItem } = require("./scoringAgent");

function safeText(value, fallback = "") {
  return String(value || fallback).trim();
}

function buildRuleBasedCard(item, scoring, status, error = null, modelUsed = null) {
  const sourcePhrase = `${item.source_name}${item.published_at ? ` 在 ${item.published_at}` : ""}`;
  const summaryClue = item.summary_placeholder ? `已有线索：${item.summary_placeholder}` : "当前没有正文摘要，只能基于标题和来源做保守判断。";
  const oneSentence = `${sourcePhrase} 发布了「${item.title}」相关动态。`;
  const detailedSummary = `${oneSentence}${summaryClue}`;
  const action = scoring.should_deep_dive
    ? "打开原文，补充正文要点，并判断是否需要跟进为选题或功能实验。"
    : "先记录为观察项，后续若出现连续信号再深入研究。";

  return {
    id: item.id,
    title: item.title,
    url: item.url,
    source_name: item.source_name,
    source_type: item.source_type,
    source_priority: item.source_priority,
    published_at: item.published_at,
    collected_at: item.collected_at,
    category: item.category,
    importance: item.importance,
    summary_placeholder: item.summary_placeholder || "",
    tags: item.tags || [],
    raw: item.raw || {},
    importance_score: scoring.importance_score,
    importance_reason: scoring.importance_reason,
    selection_score: item.selection_score ?? null,
    selected_reason: item.selected_reason || null,
    one_sentence_summary: oneSentence.slice(0, 220),
    key_points: [
      `来源：${item.source_name}`,
      `分类：${item.category}`,
      item.content_snippet ? "已抓取正文片段，可用于进一步核对。" : "暂无可用正文片段。"
    ],
    detailed_summary: detailedSummary.slice(0, 620),
    why_it_matters: `这条情报来自 ${item.source_name}，分类为 ${item.category}，可作为 AI 行业方向判断的早期信号。`,
    relevance_to_my_projects: "可用于补充 AI Intel Collector 的来源质量评估、分类规则和日报选题。",
    project_inspiration: scoring.should_deep_dive ? "将该主题整理成一张深研卡片，跟踪后续官方更新和开源实现。" : "作为趋势观察样本，积累到后续周报或分类规则中。",
    should_deep_dive: scoring.should_deep_dive,
    deep_dive_reason: scoring.should_deep_dive ? scoring.importance_reason : "当前分数或正文质量不足，暂不建议深挖。",
    confidence: item.content_snippet ? "medium" : "low",
    content_insufficient: !item.content_snippet,
    suggested_actions: [action, "保留原文链接，等待下一轮正文抓取或人工复核。"],
    model_used: modelUsed,
    summary_status: status,
    summary_error: error,
    content_fetch_status: item.content_fetch_status || null,
    content_fetch_error: item.content_fetch_error || null,
    content_snippet: item.content_snippet || ""
  };
}

function parseModelJson(content) {
  try {
    return JSON.parse(content);
  } catch (_error) {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error("Model response was not valid JSON.");
  }
}

function mergeModelCard(item, scoring, modelCard, settings) {
  const fallback = buildRuleBasedCard(item, scoring, "success", null, settings.model);
  return {
    ...fallback,
    one_sentence_summary: safeText(modelCard.one_sentence_summary, fallback.one_sentence_summary),
    key_points: Array.isArray(modelCard.key_points) && modelCard.key_points.length > 0 ? modelCard.key_points : fallback.key_points,
    detailed_summary: safeText(modelCard.detailed_summary, fallback.detailed_summary),
    why_it_matters: safeText(modelCard.why_it_matters, fallback.why_it_matters),
    relevance_to_my_projects: safeText(modelCard.relevance_to_my_projects, fallback.relevance_to_my_projects),
    project_inspiration: safeText(modelCard.project_inspiration, fallback.project_inspiration),
    should_deep_dive: Boolean(modelCard.should_deep_dive ?? scoring.should_deep_dive),
    deep_dive_reason: safeText(modelCard.deep_dive_reason, fallback.deep_dive_reason),
    confidence: safeText(modelCard.confidence, fallback.confidence),
    content_insufficient: Boolean(modelCard.content_insufficient ?? fallback.content_insufficient),
    suggested_actions: Array.isArray(modelCard.suggested_actions) && modelCard.suggested_actions.length > 0 ? modelCard.suggested_actions : fallback.suggested_actions,
    summary_status: "ai_summary_success"
  };
}

async function summarizeItem(item, settings, aiBudget) {
  const scoring = scoreItem(item, settings);
  const attachSelection = (card) => ({
    ...card,
    selection_score: item.selection_score ?? card.selection_score ?? null,
    selected_reason: item.selected_reason || card.selected_reason || null
  });

  if (!canCallModel(settings)) {
    return attachSelection(buildRuleBasedCard(item, scoring, "skipped_no_api_key"));
  }

  if (!scoring.should_call_ai) {
    return attachSelection(buildRuleBasedCard(item, scoring, "skipped_low_value"));
  }

  if (aiBudget.remaining <= 0) {
    return attachSelection(buildRuleBasedCard(item, scoring, "skipped_budget_limit"));
  }

  aiBudget.remaining -= 1;

  try {
    const messages = buildIntelCardPrompt(item, scoring);
    const content = await createChatCompletion({ messages, settings });
    const modelCard = parseModelJson(content);
    return attachSelection(mergeModelCard(item, scoring, modelCard, settings));
  } catch (caughtError) {
    return attachSelection(buildRuleBasedCard(item, scoring, "failed", caughtError.message || "Unknown model error.", settings.model));
  }
}

async function summarizeItems(rawItems, settings) {
  const aiBudget = { remaining: settings.summaryMaxItems };
  const enhancedItems = [];

  for (const item of rawItems) {
    enhancedItems.push(await summarizeItem(item, settings, aiBudget));
  }

  return enhancedItems;
}

module.exports = {
  summarizeItems,
  summarizeItem,
  buildRuleBasedCard
};
