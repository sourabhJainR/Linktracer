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

test('sync merges tags and distinct descriptions for the same URL', async () => {
  await waitForServer();
  const url = `http://127.0.0.1:${port}/api/sync`;
  const first = { canonicalUrl:'https://example.com/article', url:'https://example.com/article?utm_source=a', title:'Example', description:'Read this for architecture ideas', descriptions:[{text:'Read this for architecture ideas',deviceId:'phone',updatedAt:1}], tags:['architecture','reading'], deviceId:'phone' };
  const second = { canonicalUrl:'https://example.com/article', url:'https://example.com/article?utm_medium=b', title:'', description:'Useful reference for design', descriptions:[{text:'Useful reference for design',deviceId:'laptop',updatedAt:2}], tags:['design','reference'], deviceId:'laptop' };
  await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({changes:[first]})});
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({changes:[second]})});
  const data=await r.json();
  assert.equal(data.links.length,1);
  assert.deepEqual(new Set(data.links[0].tags),new Set(['architecture','reading','design','reference']));
  assert.equal(data.links[0].descriptions.length,2);
  assert.match(data.links[0].description,/architecture ideas/);
  assert.match(data.links[0].description,/Useful reference/);
});

test.after(async () => { child.kill(); await rm(dir,{recursive:true,force:true}); });
