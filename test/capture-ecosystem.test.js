import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const index = fs.readFileSync('public/index.html', 'utf8');
const manifest = fs.readFileSync('public/manifest.webmanifest', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const capture = fs.readFileSync('public/capture-ecosystem.js', 'utf8');

test('PWA exposes a GET share target that carries URL, title and text', () => {
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.share_target.method, 'GET');
  assert.equal(parsed.share_target.action, '/');
  assert.deepEqual(parsed.share_target.params, { title: 'title', text: 'text', url: 'url' });
});

test('capture shell handles shared and bookmarklet query parameters', () => {
  assert.match(index, /capture-ecosystem\.js\?v=/);
  assert.match(capture, /URLSearchParams/);
  assert.match(capture, /capture-url/);
  assert.match(capture, /capture-title/);
  assert.match(capture, /capture-text/);
  assert.match(capture, /history\.replaceState/);
});

test('bookmarklet is generated for the current Linktracer origin without external dependencies', () => {
  assert.match(capture, /javascript:/);
  assert.match(capture, /location\.origin/);
  assert.match(capture, /encodeURIComponent/);
  assert.match(capture, /navigator\.clipboard/);
});

test('service worker caches the capture module and manifest', () => {
  assert.match(sw, /capture-ecosystem\.js\?v=/);
  assert.match(sw, /manifest\.webmanifest/);
});

test('capture ecosystem keeps extension instructions local and portable', () => {
  const extensionManifest = JSON.parse(fs.readFileSync('extensions/chromium/manifest.json', 'utf8'));
  assert.equal(extensionManifest.manifest_version, 3);
  assert.equal(extensionManifest.permissions.includes('tabs'), true);
  assert.match(fs.readFileSync('extensions/chromium/background.js', 'utf8'), /tabs\.query/);
  assert.match(fs.readFileSync('extensions/chromium/README.md', 'utf8'), /Load unpacked/i);
});
