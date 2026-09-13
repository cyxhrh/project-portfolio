const { readJson } = require("./utils/fileStore");
const { sourcesPath, categoriesPath } = require("./utils/paths");
const { log, error } = require("./utils/logger");

const allowedTypes = new Set(["webpage", "rss", "github"]);
const allowedPriorities = new Set(["high", "medium", "low"]);
const allowedStatuses = new Set(["active", "pending_confirm", "pending_adapter", "disabled"]);

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function main() {
  const sources = readJson(sourcesPath, []);
  const categories = readJson(categoriesPath, []);
  const failures = [];
  const ids = new Set();

  assert(Array.isArray(sources), "sources.json must be an array.", failures);
  assert(Array.isArray(categories), "categories.json must be an array.", failures);

  for (const source of sources) {
    assert(source.id, "Every source needs id.", failures);
    assert(source.name, `Source ${source.id || "(missing id)"} needs name.`, failures);
    assert(allowedTypes.has(source.type), `Source ${source.id} has invalid type: ${source.type}`, failures);
    assert(allowedPriorities.has(source.priority), `Source ${source.id} has invalid priority: ${source.priority}`, failures);
    assert(allowedStatuses.has(source.status), `Source ${source.id} has invalid status: ${source.status}`, failures);
    assert(source.url, `Source ${source.id} needs url.`, failures);

    if (source.type === "github") {
      assert(source.repo, `GitHub source ${source.id} needs repo.`, failures);
    }

    if (ids.has(source.id)) {
      failures.push(`Duplicate source id: ${source.id}`);
    }
    ids.add(source.id);
  }

  const categoryNames = new Set(categories.map((category) => category.name));
  ["模型发布", "API更新", "Agent", "多模态", "开源模型", "论文研究", "产品动态", "政策监管", "工具更新", "其他"].forEach((name) => {
    assert(categoryNames.has(name), `Missing category: ${name}`, failures);
  });

  if (failures.length > 0) {
    failures.forEach((failure) => error(failure));
    process.exitCode = 1;
    return;
  }

  log(`Sources OK: ${sources.length}`);
  log(`Categories OK: ${categories.length}`);
}

main();
