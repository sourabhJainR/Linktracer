import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const io = fs.readFileSync(path.join(root, 'public', 'io.js'), 'utf8');
const smart = fs.readFileSync(path.join(root, 'public', 'smart-library.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const version = index.match(/styles\.css\?v=([^"']+)/)?.[1];

test('top-bar actions and WhatsApp entry point are present', () => {
  for (const id of ['captureWorkspaceToggle', 'whatsappTopBtn', 'syncBtn', 'exportBtn', 'importBtn', 'importFile']) assert.match(index, new RegExp(`id=[\"']${id}[\"']`));
  assert.match(index, /href=[\"']#whatsappWorkspace[\"']/);
  assert.match(index, /id=[\"']whatsappWorkspace[\"']/);
  assert.match(smart, /whatsappWorkspaceToggle.*whatsappTopBtn/);
});

test('I/O controller owns export, import, sync and WhatsApp actions', () => {
  assert.match(io, /sync\.onclick=async/);
  assert.match(io, /exp\.onclick=async/);
  assert.match(io, /imp\.onclick=\(\)=>file\?\.click\(\)/);
  assert.match(io, /file\.onchange=async/);
  assert.match(io, /bulk\.onclick=async/);
  assert.match(io, /paste\.onclick=ioClipboardPaste/);
  assert.match(io, /ioSync\(\)/);
});

test('browser assets use a cache-busting revision and matching service-worker cache', () => {
  assert.ok(version, 'index stylesheet revision should exist');
  for(const asset of ['app.js','io.js','modern.css','smart-library.js']) assert.match(index,new RegExp(`${asset}\\?v=${version}`));
  const cache=sw.match(/CACHE='([^']+)'/)?.[1];
  assert.ok(cache,'service worker cache revision should exist');
  for(const asset of ['app.js','io.js','modern.css','smart-library.js']) assert.match(sw,new RegExp(`${asset}\\?v=${version}`));
});
