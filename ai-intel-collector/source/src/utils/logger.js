function log(message) {
  console.log(`[AI Intel Collector] ${message}`);
}

function warn(message) {
  console.warn(`[AI Intel Collector] WARN: ${message}`);
}

function error(message) {
  console.error(`[AI Intel Collector] ERROR: ${message}`);
}

module.exports = {
  log,
  warn,
  error
};
