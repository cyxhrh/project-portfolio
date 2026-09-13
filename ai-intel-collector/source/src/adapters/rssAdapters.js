const { normalizeTitle, normalizeUrl } = require("../utils/normalize");

function pickPublishedAt(entry) {
  return entry.isoDate || entry.pubDate || entry.published || entry.updated || null;
}

function pickSummary(entry) {
  return normalizeTitle(entry.contentSnippet || entry.summary || entry.content || entry.description || "").slice(0, 360);
}

function adaptRssItem(entry, source) {
  const categories = Array.isArray(entry.categories) ? entry.categories.filter(Boolean) : [];

  return {
    title: normalizeTitle(entry.title),
    url: normalizeUrl(entry.link || entry.guid || source.url),
    published_at: pickPublishedAt(entry),
    summary_placeholder: pickSummary(entry),
    tags: categories,
    raw: {
      guid: entry.guid || null,
      author: entry.creator || entry.author || null,
      categories
    }
  };
}

module.exports = {
  adaptRssItem
};
