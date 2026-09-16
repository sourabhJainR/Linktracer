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
const dbInit = read('public/db-init.js');
const researchSync = read('public/research-sync.js');
const categorySync = read('public/category-sync.js');
const sw = read('public/sw.js');
const server = read('server/index.js');

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

test('local database bootstrap is durable and shared at version 6', () => {
  assert.match(index, /db-init\.js\?v=/);
  assert.ok(index.indexOf('db-init.js') < index.indexOf('app.js'), 'database bootstrap must load before app.js');
  assert.match(dbInit, /LINKTRACER_DB_VERSION=6/);
  assert.match(dbInit, /onversionchange=\(\)=>db\.close\(\)/);
  for(const store of ['links','outbox','meta','collections'])assert.match(dbInit,new RegExp(store));
  assert.match(dbInit, /indexedDB\.open=\(name,version/);
  assert.match(dbInit, /version<LINKTRACER_DB_VERSION/);
  assert.match(app, /DB_VERSION=5/);
  assert.match(io, /IO_DB_VERSION=6/);
  assert.match(researchSync, /indexedDB\.open\(DB,5\)/);
  assert.match(categorySync, /indexedDB\.open\(DB,6\)/);
});

test('local link writes are queued before any network sync', () => {
  assert.match(app, /await put\('links',m\);if\(queue\)await add\('outbox'/);
  assert.match(io, /await ioPut\('links',merged\);await ioAdd\('outbox'/);
});

test('server stores application data on disk so restart does not reset links', () => {
  assert.match(server, /new Database\(process\.env\.LINKTRACER_DB \|\| path\.join\(dataDir,'linktracer\.db'\)\)/);
  assert.match(server, /journal_mode = WAL/);
  assert.match(server, /CREATE TABLE IF NOT EXISTS links/);
});

test('service worker and index use the same cache-busting revision', () => {
  assert.ok(version, 'index stylesheet revision should exist');
  assert.match(sw, new RegExp(`styles\\.css\\?v=${version}`));
  assert.match(sw, new RegExp(`app\\.js\\?v=${version}`));
  assert.match(sw, new RegExp(`io\\.js\\?v=${version}`));
  assert.match(sw, new RegExp(`db-init\\.js\\?v=${version}`));
});
