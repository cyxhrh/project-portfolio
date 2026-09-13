import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sinksideHtml = readFileSync(
  resolve(process.cwd(), 'public/sinkside/index.html'),
  'utf8',
);

test('holds the transition final frame while the hero video is loading', () => {
  expect(sinksideHtml).toMatch(
    /<video\b[^>]*\bposter="assets\/images\/after-cabinet\.png"[^>]*>/,
  );
});
