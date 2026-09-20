import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TRIAGE_STATES, triageState, sourceLabel, nextInboxLink } from '../public/triage.js';

const root=path.resolve(process.cwd(),'public');
const triageSource=fs.readFileSync(path.join(root,'triage.js'),'utf8');
const appSource=fs.readFileSync(path.join(root,'app.js'),'utf8');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const swSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const captureSource=fs.readFileSync(path.join(root,'capture-ecosystem.js'),'utf8');
const extensionSource=fs.readFileSync(path.join(process.cwd(),'extensions','chromium','popup.js'),'utf8');

test('triage states are explicit and legacy links remain actionable',()=>{
  assert.deepEqual(TRIAGE_STATES,['inbox','kept','archived']);
  assert.equal(triageState({}), 'inbox');
  assert.equal(triageState({triage:{status:'kept'}}), 'kept');
  assert.equal(triageState({sourceContext:{triage:{status:'archived'}}}), 'archived');
  assert.equal(triageState({triage:{status:'bad-value'}}), 'inbox');
});

test('source labels explain how a link entered the library',()=>{
  assert.equal(sourceLabel({sourceContext:{captureSource:'whatsapp-chat'}}),'WhatsApp');
  assert.equal(sourceLabel({sourceContext:{captureSource:'bookmarklet'}}),'Bookmarklet');
  assert.equal(sourceLabel({sourceContext:{captureSource:'extension'}}),'Extension');
  assert.equal(sourceLabel({sourceContext:{importSource:'text'}}),'Text import');
  assert.equal(sourceLabel({}), 'Manual capture');
});

test('nextInboxLink moves through newest unprocessed sources and wraps safely',()=>{
  const links=[
    {canonicalUrl:'a',updatedAt:30},
    {canonicalUrl:'b',updatedAt:20,triage:{status:'kept'}},
    {canonicalUrl:'c',updatedAt:10},
    {canonicalUrl:'d',updatedAt:5,triage:{status:'archived'}}
  ];
  assert.equal(nextInboxLink(links), 'a');
  assert.equal(nextInboxLink(links,'a'), 'c');
  assert.equal(nextInboxLink(links,'c'), 'a');
  assert.equal(nextInboxLink(links,'missing'), 'a');
  assert.equal(nextInboxLink(links,'a',{wrap:false}), 'c');
});

test('triage module is safe to import outside a browser runtime',()=>{
  assert.ok(triageSource.includes("typeof indexedDB!=='undefined'"));
});

test('triage mutations use IndexedDB and the durable outbox',()=>{
  assert.ok(triageSource.includes("transaction(['links','outbox'],'readwrite')"));
  assert.ok(triageSource.includes('changeId:crypto.randomUUID()'));
  assert.ok(triageSource.includes('triage:{...(link.triage||{}),status,processedAt}'));
  assert.ok(triageSource.includes('deleted:true'));
});

test('library cards expose triage actions, preview and source context',()=>{
  for(const marker of [
    'data-triage-action="keep"',
    'data-triage-action="archive"',
    'data-triage-action="favorite"',
    'data-triage-action="followup"',
    'data-triage-action="delete"',
    'data-triage-action="preview"',
    'data-triage-action="next"'
  ]) assert.ok(appSource.includes(marker) || triageSource.includes(marker), marker);
  assert.ok(appSource.includes('LinktracerTriage'));
  assert.ok(appSource.includes('openReader'));
  assert.ok(indexSource.includes('triage.js?v=20260921-1'));
  assert.ok(swSource.includes('triage.js?v=20260921-1'));
});

test('capture and extension provenance is retained',()=>{
  assert.ok(captureSource.includes('captureSource'));
  assert.ok(captureSource.includes('bookmarklet'));
  assert.match(extensionSource,/searchParams\.set\(['"]source['"]\s*,\s*['"]extension['"]\)/);
});

test('process-next reads one consistent inbox snapshot',()=>{
  assert.match(triageSource,/async function processNext\(currentUrl=''\)\{\s*const links=await readLinks\(\);\s*const next=nextInboxLink\(links,currentUrl\);/);
});

test('keyboard and mobile triage hooks are wired',()=>{
  assert.ok(triageSource.includes('keydown'));
  assert.ok(triageSource.includes('[data-triage-card]'));
  assert.ok(triageSource.includes('touchstart'));
  assert.ok(triageSource.includes('touchend'));
  assert.ok(triageSource.includes('Process next'));
});
