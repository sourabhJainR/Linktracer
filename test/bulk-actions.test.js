import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd(),'public');
const intelligence=fs.readFileSync(path.join(root,'library-intelligence.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('bulk actions 2.0 supports scoped selection and visible-set controls',()=>{
  for(const marker of [
    'Select all visible',
    'Clear selection',
    'Invert selection',
    'visible results',
    'getVisibleLinks'
  ]) assert.ok(intelligence.includes(marker)||app.includes(marker), marker);
});

test('bulk actions expose durable mutations for favorite, follow-up and triage',()=>{
  for(const marker of [
    'data-bulk-action="favorite"',
    'data-bulk-action="followup"',
    'data-bulk-action="keep"',
    'data-bulk-action="archive"',
    'data-bulk-action="delete"',
    'transaction([\'links\',\'outbox\'],\'readwrite\')',
    'changeId:crypto.randomUUID()'
  ]) assert.ok(intelligence.includes(marker), marker);
});

test('bulk workflows include selection export and feedback',()=>{
  for(const marker of [
    'data-bulk-action="copy"',
    'data-bulk-action="export"',
    'data-bulk-count',
    'Bulk operation complete'
  ]) assert.ok(intelligence.includes(marker), marker);
});

test('bulk selection is wired to the existing local-first app surface',()=>{
  assert.ok(app.includes('getLinks:()=>links'));
  assert.ok(app.includes('getVisibleLinks:()=>visible'));
  assert.ok(intelligence.includes('bulkMutate'));
  assert.ok(intelligence.includes('visibleLinks'));
});

test('service worker cache is revisioned for bulk-action changes',()=>{
  assert.ok(sw.includes("const CACHE='linktracer-v24'"));
  assert.ok(sw.includes('library-intelligence.js?v=20260921-2'));
});
