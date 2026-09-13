const axios = require("axios");
const cheerio = require("cheerio");
const { getWebpageAdapter } = require("../adapters/registry");

async function collectWebpage(source) {
  let response;

  try {
    response = await axios.get(source.url, {
      timeout: source.timeout_ms || 20000,
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "AI-Intel-Collector/0.1 (+local research tool)"
      }
    });
  } catch (caughtError) {
    if (caughtError.response && caughtError.response.status === 403) {
      return {
        status: "blocked_by_403",
        items: [],
        error: "Source blocked lightweight HTTP collection with 403."
      };
    }

    throw caughtError;
  }

  const $ = cheerio.load(response.data);
  const adaptPage = getWebpageAdapter(source);
  const items = adaptPage($, source).slice(0, source.limit || 10);

  if (items.length === 0) {
    return {
      status: "pending_adapter",
      items: [],
      error: "Page fetched but adapter found no article-like items."
    };
  }

  return {
    status: "success",
    items,
    error: null
  };
}

module.exports = {
  collectWebpage
};
