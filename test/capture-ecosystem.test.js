import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bookmarkletCode, extractSharedUrl, queryCapture } from '../public/capture-ecosystem.js';

const index = fs.readFileSync('public/index.html', 'utf8');
const manifest = fs.readFileSync('public/manifest.webmanifest', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const capture = fs.readFileSync('public/capture-ecosystem.js', 'utf8');
const extensionPopup = fs.readFileSync('extensions/chromium/popup.js', 'utf8');

test('PWA exposes a GET share target that carries URL, title and text', () => {
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.share_target.method, 'GET');
  assert.equal(parsed.share_target.action, '/');
  assert.deepEqual(parsed.share_target.params, { title: 'title', text: 'text', url: 'url' });
});

test('shared text can supply a URL when the share provider omits the url field', () => {
  assert.equal(extractSharedUrl('Read this https://example.com/article?utm_source=share now'), 'https://example.com/article?utm_source=share');
  assert.equal(extractSharedUrl('No link here'), '');
});

test('capture shell handles shared and bookmarklet query parameters', () => {
  assert.match(index, /capture-ecosystem\.js\?v=/);
  assert.match(capture, /URLSearchParams/);
  assert.match(capture, /params\.get\('url'\)/);
  assert.match(capture, /params\.get\('title'\)/);
  assert.match(capture, /params\.get\('text'\)/);
  assert.match(capture, /history\.replaceState/);
  assert.deepEqual(queryCapture('?url=https%3A%2F%2Fexample.com&title=Example&text=Context'), { url: 'https://example.com', title: 'Example', text: 'Context' });
});

test('bookmarklet is generated for the current Linktracer origin without external dependencies', () => {
  const code = bookmarkletCode('http://localhost:8787');
  assert.match(code, /^javascript:/);
  assert.ok(code.includes('http://localhost:8787/'));
  assert.match(code, /encodeURIComponent/);
  assert.match(capture, /navigator\.clipboard/);
});

test('service worker caches the capture module and manifest', () => {
  assert.match(sw, /capture-ecosystem\.js\?v=/);
  assert.match(sw, /manifest\.webmanifest/);
});

test('capture extension is a portable Manifest V3 popup workflow', () => {
  const extensionManifest = JSON.parse(fs.readFileSync('extensions/chromium/manifest.json', 'utf8'));
  assert.equal(extensionManifest.manifest_version, 3);
  assert.equal(extensionManifest.permissions.includes('tabs'), true);
  assert.equal(extensionManifest.permissions.includes('storage'), true);
  assert.match(extensionPopup, /tabs\.query/);
  assert.match(extensionPopup, /storage\.local/);
  assert.match(fs.readFileSync('extensions/chromium/README.md', 'utf8'), /Load unpacked/i);
});
