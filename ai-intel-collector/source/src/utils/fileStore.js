const fs = require("fs");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (!content.trim()) {
    return fallback;
  }

  return JSON.parse(content);
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

module.exports = {
  readJson,
  writeJson,
  writeText,
  ensureDir
};
