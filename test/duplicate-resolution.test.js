import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { duplicateGroups, mergeDuplicateMetadata } from '../public/duplicate-resolution.js';

const root=path.resolve(process.cwd(),'public');
const resolutionSource=fs.readFileSync(path.join(root,'duplicate-resolution.js'),'utf8');
const intelligenceSource=fs.readFileSync(path.join(root,'library-intelligence.js'),'utf8');
const indexSource=fs.readFileSync(path.join(root,'index.html'),'utf8');
const swSource=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('duplicate grouping is deterministic by host and normalized title',()=>{
  const links=[
    {canonicalUrl:'a',url:'https://example.com/a',title:'The Example Home Page'},
    {canonicalUrl:'b',url:'https://example.com/b',title:'Example Home Page'},
    {canonicalUrl:'c',url:'https://other.com/c',title:'Example Home Page'}
  ];
  const groups=duplicateGroups(links);
  assert.equal(groups.length,1);
  assert.deepEqual(groups[0].map(x=>x.canonicalUrl),['a','b']);
});

test('duplicate metadata merge preserves keeper identity and unions useful knowledge',()=>{
  const keeper={
    canonicalUrl:'a',url:'https://example.com/a',title:'Example',
    tags:['one'],favorite:false,createdAt:30,updatedAt:40,
    descriptions:[{text:'Keeper note'}],
    sourceContext:{health:{healthy:true},annotations:[{text:'A'}],highlights:[{text:'H1'}],favorite:false}
  };
  const duplicate={
    canonicalUrl:'b',url:'https://example.com/b',title:'Example',
    tags:['two'],favorite:true,createdAt:20,updatedAt:50,
    descriptions:[{text:'Other note'}],
    sourceContext:{excerpt:'extra',annotations:[{text:'B'}],highlights:[{text:'H2'}],followUp:{enabled:true,dueAt:123}}
  };
  const merged=mergeDuplicateMetadata(keeper,[duplicate]);
  assert.equal(merged.canonicalUrl,'a');
  assert.equal(merged.url,'https://example.com/a');
  assert.deepEqual(merged.tags,['one','two']);
  assert.equal(merged.favorite,true);
  assert.equal(merged.sourceContext.favorite,true);
  assert.equal(merged.sourceContext.excerpt,'extra');
  assert.equal(merged.createdAt,20);
  assert.equal(merged.updatedAt,50);
  assert.equal(merged.descriptions.length,2);
  assert.equal(merged.sourceContext.annotations.length,2);
  assert.equal(merged.sourceContext.highlights.length,2);
  assert.equal(merged.sourceContext.followUp.enabled,true);
});

test('duplicate resolution UI requires an explicit keeper and offers merge or delete-others',()=>{
  for(const marker of [
    'data-dup-keeper',
    'data-dup-merge',
    'data-dup-delete',
    'Merge into keeper',
    'Delete other copies'
  ]) assert.ok(intelligenceSource.includes(marker), marker);
});

test('duplicate resolution writes one durable local-first mutation set',()=>{
  assert.ok(intelligenceSource.includes("duplicate-resolution.js"));
  assert.ok(intelligenceSource.includes("transaction(['links','outbox'],'readwrite')"));
  assert.ok(intelligenceSource.includes("removedReason:'duplicate-resolved'"));
  assert.ok(intelligenceSource.includes('changeId:crypto.randomUUID()'));
});

test('duplicate resolution asset is cache-busted',()=>{
  assert.ok(indexSource.includes('duplicate-resolution.js?v=20260921-1'));
  assert.ok(swSource.includes('duplicate-resolution.js?v=20260921-1'));
  assert.ok(swSource.includes("const CACHE='linktracer-v25'"));
});
