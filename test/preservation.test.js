import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const preservation=fs.readFileSync(path.join(root,'public','preservation.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server','index.js'),'utf8');
const index=fs.readFileSync(path.join(root,'public','index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'public','sw.js'),'utf8');

test('preservation UI and archive links are wired',()=>{
  for(const marker of ['data-preservation-action','Preservation:','https://web.archive.org/save/','https://web.archive.org/web/','/api/preservation'])assert.match(preservation,new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')));
  assert.match(index,/preservation\.js\?v=20260918-1/);
  assert.match(sw,/preservation\.js\?v=20260918-1/);
});

test('preservation state is durable through the existing link outbox',()=>{
  assert.match(preservation,/sourceContext:\{\.\.\.\(link\.sourceContext\|\|\{\}\),\[PRESERVATION\]:preservation\}/);
  assert.match(preservation,/transaction\('links','readwrite'\)/);
  assert.match(preservation,/transaction\('outbox','readwrite'\)/);
  assert.match(preservation,/changeId:globalThis\.crypto\?\.randomUUID/);
});

test('server checks Internet Archive availability without making it a required local dependency',()=>{
  assert.match(server,/app\.get\('\/api\/preservation'/);
  assert.match(server,/https:\/\/archive\.org\/wayback\/available/);
  assert.match(server,/AbortSignal\.timeout\(7000\)/);
  assert.match(server,/source:'internet-archive-wayback'/);
});
