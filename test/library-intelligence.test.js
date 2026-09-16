import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd(),'public');
const moduleSource=fs.readFileSync(path.join(root,'library-intelligence.js'),'utf8');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const swSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('library intelligence exposes the PR1 workflows',()=>{
  for(const marker of ['Command palette','Duplicate center','Saved searches','Bulk select','data-bulk-action="delete"','linktracer-saved-searches'])assert.match(moduleSource,new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
  assert.match(indexSource,/library-intelligence\.js\?v=20260917-2/);
  assert.match(swSource,/library-intelligence\.js\?v=20260917-2/);
});

test('bulk deletion uses the durable local outbox protocol',()=>{
  assert.match(moduleSource,/transaction\(\['links','outbox'\],'readwrite'\)/);
  assert.match(moduleSource,/deleted:true/);
  assert.match(moduleSource,/changeId:crypto\.randomUUID\(\)/);
  assert.match(moduleSource,/removedReason:'bulk-delete'/);
});

test('keyboard command palette and saved-search actions are wired',()=>{
  assert.match(moduleSource,/e\.ctrlKey\|\|e\.metaKey/);
  assert.match(moduleSource,/e\.key\.toLowerCase\(\)==='k'/);
  assert.match(moduleSource,/data-run-search/);
  assert.match(moduleSource,/data-delete-search/);
});
