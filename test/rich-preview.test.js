import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd(),'public');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cssSource=fs.readFileSync(path.join(root,'modern.css'),'utf8');
const swSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('rich source preview exposes provenance, health, type and saved context',()=>{
  for(const marker of ['readerSourcePreview','readerSourceBadge','readerHealth','readerType','readerTags','readerActions']){
    assert.ok(indexSource.includes(marker)||appSource.includes(marker)||cssSource.includes(marker),marker);
  }
  assert.match(appSource,/sourceLabelOf(l)/);
  assert.match(appSource,/contentType/);
  assert.match(appSource,/health/);
  assert.match(appSource,/readerOpenLink/);
});

test('rich preview preserves local-first reader content and knowledge',()=>{
  assert.match(appSource,/highlights(l)/);
  assert.match(appSource,/annotations(l)/);
  assert.match(appSource,/sourceContext/);
});

test('rich preview assets stay cache-busted',()=>{
  assert.match(indexSource,/modern\.css\?v=20260918-1/);
  assert.match(swSource,/modern\.css\?v=20260918-1/);
});