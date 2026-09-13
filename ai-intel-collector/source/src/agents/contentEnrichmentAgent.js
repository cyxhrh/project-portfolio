const { fetchArticleContent } = require("../content/articleFetcher");

async function enrichItemsWithContent(items, options = {}) {
  const enriched = [];

  for (const item of items) {
    const content = await fetchArticleContent(item, options);
    enriched.push({
      ...item,
      ...content
    });
  }

  return enriched;
}

module.exports = {
  enrichItemsWithContent
};
