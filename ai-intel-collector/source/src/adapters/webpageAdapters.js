const { normalizeTitle, normalizeUrl } = require("../utils/normalize");

function resolveLink(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch (_error) {
    return null;
  }
}

function textFrom($, element) {
  return normalizeTitle($(element).text());
}

function cleanAnthropicTitle(title) {
  let value = normalizeTitle(title).replace(/^(Product|Announcements|Research)/i, "");
  const date = extractDate(value);

  if (date && value.indexOf(date) > 0) {
    value = value.slice(0, value.indexOf(date));
  }

  return normalizeTitle(value.replace(/^(Product|Announcements|Research)/i, ""));
}

function splitAnthropicText(text) {
  const date = extractDate(text);
  let value = normalizeTitle(text);
  let title = value;
  let summary = "";

  if (date) {
    const dateIndex = value.indexOf(date);
    const beforeDate = normalizeTitle(value.slice(0, dateIndex).replace(/(Product|Announcements|Policy|Research)$/i, ""));
    const afterDate = normalizeTitle(value.slice(dateIndex + date.length).replace(/^(Product|Announcements|Research)/i, ""));
    title = beforeDate.length >= 12 ? beforeDate : afterDate;

    if (beforeDate && afterDate && afterDate.startsWith(beforeDate)) {
      title = beforeDate;
      summary = normalizeTitle(afterDate.slice(beforeDate.length));
    }
  }

  const summaryMarkers = ["Claude Tag is", "An upgrade", "AI is", "We’re", "The US government", "Claude Corps", "TCS and", "DXC will"];
  for (const marker of summaryMarkers) {
    const index = title.indexOf(marker);
    if (index > 8) {
      summary = normalizeTitle(title.slice(index));
      title = normalizeTitle(title.slice(0, index));
      break;
    }
  }

  return {
    title: cleanAnthropicTitle(title),
    published_at: date,
    summary_placeholder: summary
  };
}

function extractDate(text) {
  const matched = text.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i);
  return matched ? matched[0] : null;
}

function isBlockedTitle(title) {
  const blockedTitles = new Set([
    "skip to main content",
    "untitled",
    "research",
    "try claude",
    "download press kit",
    "facebook",
    "linkedin",
    "the keyword",
    "google deepmind",
    "google research",
    "gemini models",
    "quantum computing",
    "developer tools",
    "global network",
    "google cloud",
    "safety & security"
  ]);

  return blockedTitles.has(title.toLowerCase()) || title.toLowerCase().startsWith("view more");
}

function matchesSourcePattern(url, source) {
  if (!source.include_url_patterns || source.include_url_patterns.length === 0) {
    return true;
  }

  return source.include_url_patterns.some((pattern) => url.startsWith(pattern));
}

function buildLinkItems($, source, options = {}) {
  const found = new Map();
  const minimumTitleLength = options.minimumTitleLength || 12;

  $("article a, main a, a").each((_index, element) => {
    const title = textFrom($, element);
    const href = $(element).attr("href");
    const url = href ? normalizeUrl(resolveLink(href, source.url)) : "";

    if (
      !url ||
      url === normalizeUrl(source.url) ||
      title.length < minimumTitleLength ||
      isBlockedTitle(title) ||
      !matchesSourcePattern(url, source)
    ) {
      return;
    }

    const container = $(element).closest("article, li, div, section");
    const containerText = normalizeTitle(container.text());
    const headingTitle = normalizeTitle(container.find("h1, h2, h3").first().text());
    const publishedAt = container.find("time").attr("datetime") || extractDate(containerText);
    const summary = normalizeTitle(container.find("p").first().text()).slice(0, 360);
    const candidateTitle = headingTitle.length >= minimumTitleLength ? headingTitle : title;
    const finalTitle = options.cleanTitle ? options.cleanTitle(candidateTitle) : candidateTitle;

    if (finalTitle.length < minimumTitleLength || found.has(url)) {
      return;
    }

    found.set(url, {
      title: finalTitle,
      url,
      published_at: publishedAt || null,
      summary_placeholder: summary
    });
  });

  return Array.from(found.values());
}

function adaptGenericWebpage($, source) {
  const items = buildLinkItems($, source);

  if (items.length > 0) {
    return items;
  }

  const pageTitle = normalizeTitle(
    $("meta[property='og:title']").attr("content") ||
      $("meta[name='twitter:title']").attr("content") ||
      $("h1").first().text() ||
      $("title").first().text()
  );
  const summary = normalizeTitle(
    $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $("main p").first().text()
  );
  const publishedAt = $("time").first().attr("datetime") || null;

  if (!pageTitle || pageTitle === "Untitled") {
    return [];
  }

  return [
    {
      title: pageTitle,
      url: normalizeUrl(source.url),
      published_at: publishedAt,
      summary_placeholder: summary.slice(0, 360)
    }
  ];
}

function adaptAnthropicNews($, source) {
  const found = new Map();

  $("a[href^='/news/'], a[href^='/policy-']").each((_index, element) => {
    const href = $(element).attr("href");
    const url = href ? normalizeUrl(resolveLink(href, source.url)) : "";
    const parsed = splitAnthropicText(textFrom($, element));

    if (!url || !matchesSourcePattern(url, source) || !parsed.title || parsed.title.length < 12 || found.has(url)) {
      return;
    }

    found.set(url, {
      title: parsed.title,
      url,
      published_at: parsed.published_at,
      summary_placeholder: parsed.summary_placeholder
    });
  });

  return Array.from(found.values());
}

function adaptGoogleAiBlog($, source) {
  return buildLinkItems($, source, {
    minimumTitleLength: 18
  }).filter(
    (item) =>
      /\/innovation-and-ai\/.+/.test(item.url) &&
      !/models-and-research\/(google|gemini|quantum)/.test(item.url) &&
      !/\/technology\/research$/.test(item.url)
  );
}

function adaptQwenBlog($, source) {
  return buildLinkItems($, source, {
    minimumTitleLength: 10
  });
}

module.exports = {
  adaptGenericWebpage,
  adaptAnthropicNews,
  adaptGoogleAiBlog,
  adaptQwenBlog
};
