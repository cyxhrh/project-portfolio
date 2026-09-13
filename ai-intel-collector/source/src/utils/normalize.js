const crypto = require("crypto");

function normalizeUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.searchParams.sort();
    return parsed.toString().replace(/\/$/, "");
  } catch (_error) {
    return String(url).trim();
  }
}

function hashUrl(url) {
  return crypto.createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

function normalizeTitle(title) {
  return String(title || "Untitled").replace(/\s+/g, " ").trim();
}

function makeItemId(sourceId, url) {
  return `${sourceId}:${hashUrl(url).slice(0, 16)}`;
}

module.exports = {
  normalizeUrl,
  hashUrl,
  normalizeTitle,
  makeItemId
};
