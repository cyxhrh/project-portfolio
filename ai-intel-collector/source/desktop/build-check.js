const fs = require("fs");
const path = require("path");

const requiredFiles = [
  "desktop/main.js",
  "desktop/preload.js",
  "desktop/renderer/index.html",
  "desktop/renderer/renderer.js",
  "desktop/renderer/styles.css"
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(__dirname, "..", file)));

if (missing.length > 0) {
  console.error("Desktop UI is missing files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log("Desktop UI files are present.");
console.log("Run `npm run desktop:dev` to open the local desktop console.");
console.log("Packaging as an installer is intentionally not configured in this local-only round.");
