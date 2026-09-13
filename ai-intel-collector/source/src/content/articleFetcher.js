const axios = require("axios");
const cheerio = require("cheerio");
const { selectArticleContent } = require("./contentSelector");

async function fetchArticleContent(item, options = {}) {
  const maxChars = options.maxChars || 5000;

  if (!item.url) {
    return {
      content_fetch_status: "skipped_no_url",
      content_fetch_error: "Item has no URL.",
      content_snippet: ""
    };
  }

  try {
    const response = await axios.get(item.url, {
      timeout: options.timeoutMs || 20000,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "AI-Intel-Collector/0.1 (+local content fetch)"
      }
    });
    const $ = cheerio.load(response.data);
    const selected = selectArticleContent($, maxChars);

    return {
      content_fetch_status: selected.status,
      content_fetch_error: selected.error,
      content_snippet: selected.content_snippet,
      content_fetched_at: new Date().toISOString()
    };
  } catch (caughtError) {
    const statusCode = caughtError.response && caughtError.response.status;
    const code = caughtError.code || "";
    let status = "failed";

    if (statusCode === 403) {
      status = "blocked_by_403";
    } else if (code.includes("TIME") || code === "ECONNABORTED") {
      status = "timeout";
    }

    return {
      content_fetch_status: status,
      content_fetch_error: caughtError.message || "Unknown content fetch error.",
      content_snippet: "",
      content_fetched_at: new Date().toISOString()
    };
  }
}

module.exports = {
  fetchArticleContent
};
