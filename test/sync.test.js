import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(os.tmpdir(), 'linktracer-'));
const db = path.join(dir, 'test.db');
const port = 18787 + Math.floor(Math.random() * 500);
const child = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), LINKTRACER_DB: db }, stdio: 'ignore' });

async function waitForServer() {
  for (let i=0;i<30;i++) {
    try { const r=await fetch(`http://127.0.0.1:${port}/api/health`); if(r.ok) return; } catch {}
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('server did not start');
}
async function sync(changes) {
  return fetch(`http://127.0.0.1:${port}/api/sync`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({changes}) }).then(r=>r.json());
}

test('sync merges tags and distinct descriptions for the same URL without duplication', async () => {
  await waitForServer();
  const first = { changeId:'c1', canonicalUrl:'https://example.com/article', url:'https://example.com/article?utm_source=a', title:'Example', description:'Read this for architecture ideas', descriptions:[{text:'Read this for architecture ideas',deviceId:'phone',updatedAt:1}], tags:['architecture','reading'], deviceId:'phone' };
  const second = { changeId:'c2', canonicalUrl:'https://example.com/article', url:'https://example.com/article?utm_medium=b', title:'', description:'Useful reference for design', descriptions:[{text:'Useful reference for design',deviceId:'laptop',updatedAt:2},{text:'Read this for architecture ideas',deviceId:'laptop',updatedAt:3}], tags:['design','reference'], deviceId:'laptop' };
  await sync([first]);
  const data=await sync([second]);
  assert.deepEqual(new Set(data.links[0].tags),new Set(['architecture','reading','design','reference']));
  assert.equal(data.links[0].descriptions.length,2);
  assert.match(data.links[0].description,/architecture ideas/);
  assert.match(data.links[0].description,/Useful reference/);
  assert.deepEqual(data.acceptedChangeIds,['c2']);
});

test('replaying the same operation is acknowledged without creating another merge', async () => {
  await waitForServer();
  const change = {changeId:'idempotent-1',url:'https://example.com/idempotent',description:'one note',tags:['one']};
  const first=await sync([change]);
  const second=await sync([change]);
  assert.deepEqual(first.acceptedChangeIds,['idempotent-1']);
  assert.deepEqual(second.acceptedChangeIds,['idempotent-1']);
  const pull=await fetch(`http://127.0.0.1:${port}/api/links?cursor=0`).then(r=>r.json());
  const record=pull.links.find(x=>x.canonicalUrl==='https://example.com/idempotent');
  assert.equal(record.descriptions.length,1);
  assert.deepEqual(record.tags,['one']);
});

test('invalid changes are rejected and remain retryable instead of being silently acknowledged', async () => {
  await waitForServer();
  const data=await sync([{changeId:'bad-1',url:'file:///secret',tags:['lost']}]);
  assert.deepEqual(data.acceptedChangeIds,[]);
  assert.equal(data.rejectedChanges[0].changeId,'bad-1');
});

test('cursor returns server changes even when timestamps are identical', async () => {
  await waitForServer();
  await sync([{changeId:'cursor-1',url:'https://example.com/one',tags:['one']}]);
  const first=await fetch(`http://127.0.0.1:${port}/api/links?cursor=0`).then(r=>r.json());
  await sync([{changeId:'cursor-2',url:'https://example.com/two',tags:['two']}]);
  const second=await fetch(`http://127.0.0.1:${port}/api/links?cursor=${first.cursor}`).then(r=>r.json());
  assert.ok(second.links.some(x=>x.canonicalUrl==='https://example.com/two'));
  assert.ok(second.cursor>first.cursor);
});

test.after(async () => { child.kill(); await rm(dir,{recursive:true,force:true}); });
