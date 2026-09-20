import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd(),'public');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const builderSource=fs.readFileSync(path.join(root,'search-builder.js'),'utf8');
const swSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('search builder exposes compatible visual filters',()=>{
  for(const marker of ['filterBuilder','Tag','Content type','Domain','Health','Duplicate','Triage','dateAfter','dateBefore','Apply filters','Clear filters']){
    assert.ok(indexSource.includes(marker)||builderSource.includes(marker),marker);
  }
  assert.ok(builderSource.includes('tag:'));
  assert.ok(builderSource.includes('type:'));
  assert.ok(builderSource.includes('domain:'));
  assert.ok(builderSource.includes('health:'));
  assert.ok(builderSource.includes('duplicate:'));
  assert.ok(builderSource.includes('triage:'));
});

test('search builder renders removable active filter chips',()=>{
  assert.match(builderSource,/data-filter-chip/);
  assert.match(builderSource,/removeFilter/);
  assert.match(builderSource,/renderChips/);
});

test('search builder stays cache-busted with the PWA shell',()=>{
  assert.match(indexSource,/search-builder\.js\?v=20260921-1/);
  assert.match(swSource,/search-builder\.js\?v=20260921-1/);
});