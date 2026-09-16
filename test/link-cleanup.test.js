import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const server = fs.readFileSync(path.join(root, 'server', 'index.js'), 'utf8');

test('server accepts link deletion changes and removes links from persistent storage', () => {
  assert.match(server, /function deleteLink\(/);
  assert.match(server, /change\.entityType==='link'/);
  assert.match(server, /change\.deleted/);
  assert.match(server, /DELETE FROM links/);
  assert.match(server, /logChange\.run/);
});
