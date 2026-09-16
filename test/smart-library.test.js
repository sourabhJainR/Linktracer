import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isConfirmed404, partitionLinks } from '../public/smart-library.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const smart = fs.readFileSync(path.join(root, 'public', 'smart-library.js'), 'utf8');

const link = (url, updatedAt, extra = {}) => ({ canonicalUrl: url, url, updatedAt, ...extra });

test('smart library keeps recent, favorites and follow-up links as separate views', () => {
  const result = partitionLinks([
    link('https://old.example', 100),
    link('https://favorite.example', 200, { favorite: true }),
    link('https://followup.example', 300, { sourceContext: { followUp: { enabled: true, dueAt: 400 } } }),
    link('https://new.example', 500)
  ]);

  assert.deepEqual(result.recent.map(x => x.url), ['https://new.example', 'https://followup.example', 'https://favorite.example']);
  assert.deepEqual(result.favorites.map(x => x.url), ['https://favorite.example']);
  assert.deepEqual(result.followUps.map(x => x.url), ['https://followup.example']);
  assert.equal(result.all.length, 4);
});

test('only an explicit HTTP 404 is treated as removable link health', () => {
  assert.equal(isConfirmed404({ status: 404, healthy: false }), true);
  assert.equal(isConfirmed404({ status: 404, healthy: true }), false);
  assert.equal(isConfirmed404({ status: 0, healthy: false }), false);
  assert.equal(isConfirmed404({ status: 500, healthy: false }), false);
});

test('capture and WhatsApp workspaces are transition panels rather than default content', () => {
  assert.match(index, /id=["']captureWorkspaceToggle["']/);
  assert.match(index, /id=["'](?:whatsappWorkspaceToggle|whatsappTopBtn)["']/);
  assert.match(index, /id=["']captureWorkspace["']/);
  assert.match(index, /id=["']whatsappWorkspace["']/);
  assert.match(smart, /togglePanel\(/);
  assert.match(smart, /data-smart-section=["']recent["']/);
  assert.match(smart, /data-smart-section=["']favorites["']/);
  assert.match(smart, /data-smart-section=["']followups["']/);
});

test('confirmed 404 cleanup uses a deletion change that can be synchronized', () => {
  assert.match(smart, /entityType:["']link["']/);
  assert.match(smart, /deleted:true/);
  assert.match(smart, /sourceContext.*removedReason/);
});
