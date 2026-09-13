const { adaptAnthropicNews } = require("./webpageAdapters");
const { adaptGoogleAiBlog } = require("./webpageAdapters");
const { adaptQwenBlog } = require("./webpageAdapters");
const { adaptGenericWebpage } = require("./webpageAdapters");
const { adaptRssItem } = require("./rssAdapters");
const { adaptGithubRelease } = require("./githubAdapters");

const webpageAdapters = {
  anthropic_news: adaptAnthropicNews,
  google_ai_blog: adaptGoogleAiBlog,
  qwen_blog: adaptQwenBlog,
  generic_webpage: adaptGenericWebpage
};

function getWebpageAdapter(source) {
  return webpageAdapters[source.adapter] || adaptGenericWebpage;
}

function getRssAdapter(_source) {
  return adaptRssItem;
}

function getGithubAdapter(_source) {
  return adaptGithubRelease;
}

module.exports = {
  getWebpageAdapter,
  getRssAdapter,
  getGithubAdapter
};
