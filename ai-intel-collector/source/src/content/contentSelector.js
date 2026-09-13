const { normalizeTitle } = require("../utils/normalize");

function cleanText(text) {
  return normalizeTitle(String(text || "").replace(/\s+/g, " "));
}

function collectParagraphText($, selector) {
  const paragraphs = [];

  $(`${selector} p`).each((_index, element) => {
    const text = cleanText($(element).text());
    if (text.length >= 60) {
      paragraphs.push(text);
    }
  });

  return paragraphs.join("\n\n");
}

function selectArticleContent($, maxChars) {
  const metaDescription = cleanText(
    $("meta[property='og:description']").attr("content") ||
      $("meta[name='description']").attr("content") ||
      $("meta[name='twitter:description']").attr("content")
  );
  const candidates = [
    collectParagraphText($, "article"),
    collectParagraphText($, "main"),
    collectParagraphText($, "body")
  ].filter(Boolean);
  const bestBody = candidates.sort((a, b) => b.length - a.length)[0] || "";
  const combined = [metaDescription, bestBody].filter(Boolean).join("\n\n");
  const content = cleanText(combined).slice(0, maxChars);

  if (content.length < 160) {
    return {
      status: "insufficient_content",
      content_snippet: content,
      error: "Extracted content was too short for reliable summarization."
    };
  }

  return {
    status: "success",
    content_snippet: content,
    error: null
  };
}

module.exports = {
  selectArticleContent
};
