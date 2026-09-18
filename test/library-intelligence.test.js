import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd(),'public');
const moduleSource=fs.readFileSync(path.join(root,'library-intelligence.js'),'utf8');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const swSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const libraryUiSource=fs.readFileSync(path.join(root,'library-ui.js'),'utf8');
const smartLibrarySource=fs.readFileSync(path.join(root,'smart-library.js'),'utf8');

test('library intelligence exposes the PR1 workflows',()=>{
  for(const marker of ['Command palette','Duplicate center','Saved searches','Bulk select','data-bulk-action="delete"','linktracer-saved-searches'])assert.match(moduleSource,new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
  assert.match(indexSource,/library-intelligence\.js\?v=20260918-1/);
  assert.match(swSource,/library-intelligence\.js\?v=20260918-1/);
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

test('library exposes an explicit all-links view alongside smart views',()=>{
  assert.match(indexSource,/data-library-view="all"/);
  assert.match(indexSource,/>\s*All links\s*<\/span>/);
  assert.match(libraryUiSource,/data-library-view="recent"/);
  assert.match(libraryUiSource,/data-library-view="favorites"/);
  assert.match(libraryUiSource,/data-library-view="followups"/);
  assert.match(smartLibrarySource,/data-smart-section="\$\{sectionName\}"/);
  assert.match(smartLibrarySource,/section\('Recently added','recent'/);
  assert.match(smartLibrarySource,/section\('Favorites','favorites'/);
  assert.match(smartLibrarySource,/section\('Follow-up','followups'/);
});

test('list and grid views have distinct render classes and active controls',()=>{
  assert.match(libraryUiSource,/data-library-layout="list"/);
  assert.match(libraryUiSource,/data-library-layout="grid"/);
  assert.match(libraryUiSource,/classList\.toggle\('libraryList'/);
  assert.match(libraryUiSource,/classList\.toggle\('libraryGrid'/);
  assert.match(libraryUiSource,/aria-pressed/);
  assert.match(libraryUiSource,/dataset\.layout=layout/);
  assert.match(libraryUiSource,/grid-template-columns:repeat\(auto-fill,minmax\(310px,1fr\)/);
  assert.match(libraryUiSource,/grid-template-columns:1fr!important/);
});

test('library view and layout choices persist and reapply after library rerenders',()=>{
  assert.match(libraryUiSource,/LAYOUT_KEY='linktracer-layout'/);
  assert.match(libraryUiSource,/VIEW_KEY='linktracer-library-view'/);
  assert.match(libraryUiSource,/localStorage\.setItem\(VIEW_KEY/);
  assert.match(libraryUiSource,/localStorage\.getItem\(VIEW_KEY\)/);
  assert.match(libraryUiSource,/document\.addEventListener\('linktracer-rendered'/);
  assert.match(libraryUiSource,/applyLibraryView\(\)/);
});

test('library UI is explicitly cache-busted for the service worker and module import',()=>{
  assert.match(smartLibrarySource,/library-ui\.js\?v=20260918-1/);
  assert.match(swSource,/CACHE='linktracer-v20'/);
  assert.match(swSource,/library-ui\.js\?v=20260918-1/);
});


test('library command center exposes sorting and quick actions',()=>{
  assert.match(indexSource,/id="sortOrder"/);
  assert.match(moduleSource,/SORT_KEY='linktracer-sort'/);
  assert.match(moduleSource,/localStorage\.setItem\(SORT_KEY/);
  assert.match(moduleSource,/data-action="favorite"/);
  assert.match(moduleSource,/data-action="followup"/);
  assert.match(indexSource,/Most highlights/);
  assert.match(indexSource,/Most notes/);
});
