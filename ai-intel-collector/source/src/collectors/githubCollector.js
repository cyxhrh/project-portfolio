const axios = require("axios");
const { getGithubAdapter } = require("../adapters/registry");

async function collectGithub(source) {
  if (!source.repo) {
    return {
      status: "failed",
      items: [],
      error: "GitHub source is missing repo, expected owner/name."
    };
  }

  const repoUrl = `https://api.github.com/repos/${source.repo}`;
  const releasesUrl = `${repoUrl}/releases`;
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "AI-Intel-Collector/0.1"
  };
  const [repoResponse, releasesResponse] = await Promise.all([
    axios.get(repoUrl, {
      timeout: 15000,
      headers
    }),
    axios.get(releasesUrl, {
      timeout: 15000,
      headers
    })
  ]);

  const adaptRelease = getGithubAdapter(source);
  const releases = releasesResponse.data || [];
  const items = releases.slice(0, source.limit || 10).map((release) => adaptRelease(release, source, repoResponse.data));

  if (items.length === 0) {
    return {
      status: "failed",
      items: [],
      error: "No GitHub releases found."
    };
  }

  return {
    status: "success",
    items,
    error: null
  };
}

module.exports = {
  collectGithub
};
