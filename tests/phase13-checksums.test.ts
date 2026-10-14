import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manifest = 'Nasaq-POS-v1.0.2/checksums/DIST_CHECKSUMS.sha256';
const contents = readFileSync(join(process.cwd(), manifest), 'utf8');
const listedFiles = contents.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
assert.ok(listedFiles.length > 0, 'checksum manifest must not be empty');
for (const entry of listedFiles) {
  const match = entry.match(/^([a-f0-9]{64})\s+(.+)$/i);
  assert.ok(match, `invalid checksum entry: ${entry}`);
  const [, expected, relativePath] = match;
  const actual = createHash('sha256').update(readFileSync(join(process.cwd(), relativePath))).digest('hex');
  assert.equal(actual, expected.toLowerCase(), `checksum mismatch: ${relativePath}`);
}
console.log(`D3 checksum regression passed: ${listedFiles.length} files verified.`);
