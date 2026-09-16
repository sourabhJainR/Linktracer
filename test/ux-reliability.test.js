import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('public/index.html');
const app = read('public/app.js');
const io = read('public/io.js');
const researchSync = read('public/research-sync.js');
const sw = read('public/sw.js');

const version = index.match(/styles\.css\?v=([^"']+)/)?.[1];

test('top-level I/O actions have a single controller', () => {
  assert.equal((app.match(/\$\('syncBtn'\)\.onclick/g) || []).length, 0);
  assert.equal((app.match(/\$\('exportBtn'\)\.onclick/g) || []).length, 0);
  assert.equal((app.match(/\$\('importBtn'\)\.onclick/g) || []).length, 0);
  assert.equal((app.match(/whatsappImportBtn/g) || []).length, 0);
  assert.match(io, /function ioWire\(\)/);
});

test('research synchronization is loaded by the application shell', () => {
  assert.match(index, /research-sync\.js\?v=/);
});

test('dynamic library actions use event delegation instead of per-card listeners', () => {
  assert.match(app, /addEventListener\(['"]click['"]/);
  assert.doesNotMatch(app, /querySelectorAll\('\[data-reader\]'\)/);
  assert.doesNotMatch(app, /querySelectorAll\('\[data-note\]'\)/);
  assert.doesNotMatch(app, /querySelectorAll\('\[data-health\]'\)/);
});

test('sync and background enrichment have explicit in-flight protection', () => {
  assert.match(app, /syncInFlight/);
  assert.match(app, /enrichInFlight/);
});

test('service worker and index use the same cache-busting revision', () => {
  assert.ok(version, 'index stylesheet revision should exist');
  assert.match(sw, new RegExp(`styles\\.css\\?v=${version}`));
  assert.match(sw, new RegExp(`app\\.js\\?v=${version}`));
  assert.match(sw, new RegExp(`io\\.js\\?v=${version}`));
});
