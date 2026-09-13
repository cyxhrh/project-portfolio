const { normalizeTitle, normalizeUrl } = require("../utils/normalize");

function adaptGithubRelease(release, source, repoMetadata) {
  const tag = release.tag_name || "";
  const releaseName = normalizeTitle(release.name || tag || "Untitled release");
  const repoName = repoMetadata && repoMetadata.full_name ? repoMetadata.full_name : source.repo;

  return {
    title: tag && !releaseName.includes(tag) ? `${releaseName} (${tag})` : releaseName,
    url: normalizeUrl(release.html_url),
    published_at: release.published_at || release.created_at || null,
    summary_placeholder: normalizeTitle(release.body || repoMetadata.description || "").slice(0, 420),
    tags: tag ? [tag] : [],
    raw: {
      repo: repoName,
      tag,
      prerelease: Boolean(release.prerelease),
      draft: Boolean(release.draft),
      release_name: releaseName
    }
  };
}

module.exports = {
  adaptGithubRelease
};
