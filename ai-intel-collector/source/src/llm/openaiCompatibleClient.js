const axios = require("axios");
const dotenv = require("dotenv");
const { readJson } = require("../utils/fileStore");
const { modelConfigPath, projectRoot } = require("../utils/paths");

dotenv.config({ path: `${projectRoot}/.env`, quiet: true });

function toBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function loadModelSettings() {
  const config = readJson(modelConfigPath, {});
  const provider = process.env.AI_MODEL_PROVIDER || config.provider || "deepseek";
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || "";

  return {
    provider,
    apiKey,
    baseURL: process.env.AI_MODEL_BASE_URL || config.base_url || "https://api.deepseek.com",
    model: process.env.AI_MODEL_NAME || config.model || "deepseek-chat",
    temperature: toNumber(process.env.AI_MODEL_TEMPERATURE, config.temperature ?? 0.2),
    maxTokens: toNumber(process.env.AI_MODEL_MAX_TOKENS, config.max_tokens ?? 900),
    requestTimeoutMs: toNumber(process.env.AI_MODEL_TIMEOUT_MS, config.request_timeout_ms ?? 60000),
    summaryEnabled: toBoolean(process.env.AI_SUMMARY_ENABLED, Boolean(config.summary_enabled)),
    summaryMaxItems: toNumber(process.env.AI_SUMMARY_MAX_ITEMS, config.summary_max_items ?? 20),
    maxArxivTopItems: toNumber(process.env.AI_MAX_ARXIV_TOP_ITEMS, config.max_arxiv_top_items ?? 2),
    contentMaxChars: toNumber(process.env.CONTENT_FETCH_MAX_CHARS, config.content_max_chars ?? 5000),
    deepDiveCategories: config.deep_dive_categories || [],
    arxivDeepDiveKeywords: config.arxiv_deep_dive_keywords || []
  };
}

function canCallModel(settings) {
  return Boolean(settings.summaryEnabled && settings.apiKey);
}

async function createChatCompletion({ messages, settings }) {
  const url = `${settings.baseURL.replace(/\/$/, "")}/v1/chat/completions`;
  const response = await axios.post(
    url,
    {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      response_format: { type: "json_object" }
    },
    {
      timeout: settings.requestTimeoutMs,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices?.[0]?.message?.content || "";
}

module.exports = {
  loadModelSettings,
  canCallModel,
  createChatCompletion
};
