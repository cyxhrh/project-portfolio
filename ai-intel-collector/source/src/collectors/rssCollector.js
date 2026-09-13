const Parser = require("rss-parser");
const axios = require("axios");
const { getRssAdapter } = require("../adapters/registry");

const parser = new Parser({
  customFields: {
    item: ["media:content", "category"]
  }
});

async function collectRss(source) {
  const response = await axios.get(source.url, {
    timeout: source.timeout_ms || 30000,
    responseType: "text",
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "AI-Intel-Collector/0.1 (+local research tool)"
    }
  });

  const feed = await parser.parseString(response.data);
  const adaptItem = getRssAdapter(source);

  const items = (feed.items || [])
    .slice(0, source.limit || 10)
    .map((entry) => adaptItem(entry, source))
    .filter((item) => item.title && item.url);

  return {
    status: items.length > 0 ? "success" : "failed",
    items,
    error: items.length > 0 ? null : "RSS parsed successfully but produced no items."
  };
}

module.exports = {
  collectRss
};
