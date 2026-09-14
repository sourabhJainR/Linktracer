import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceModel } from '../public/confidence-engine.js';

const link=(url,tags=['topic'],claims=[],relations=[],context={})=>({
  url,
  canonicalUrl:url,
  title:url,
  tags,
  sourceContext:{claims,evidenceRelations:relations,...context}
});
const claim=(id,text)=>({id,text});

test('classifies a claim as needing independent evidence when it has one hostname',()=>{
  const a=link('https://one.example/a',['ai'],[claim('c1','AI improves forecasting')]);
  const model=buildEvidenceModel([a]);
  assert.equal(model.claims[0].classification,'Needs Independent Evidence');
  assert.equal(model.claims[0].domainCount,1);
  assert.ok(model.checklist[0].actions.some(x=>x.includes('independent source')));
});

test('marks a claim conflicted when supporting and contradicting evidence exist',()=>{
  const a=link('https://one.example/a',['ai'],[claim('c1','AI improves forecasting')],[
    {claimId:'c1',targetCanonicalUrl:'https://two.example/b',type:'supports'},
    {claimId:'c1',targetCanonicalUrl:'https://three.example/c',type:'contradicts'}
  ]);
  const b=link('https://two.example/b',['ai']);
  const c=link('https://three.example/c',['ai']);
  const model=buildEvidenceModel([a,b,c]);
  assert.equal(model.claims[0].classification,'Conflicted');
  assert.equal(model.counts.conflicted,1);
  assert.ok(model.claims[0].quality < 100);
});

test('marks a strong topic decision-ready with independent sources and strong context',()=>{
  const context={excerpt:'substantial source context',enrichedAt:'2026-09-14',status:200,highlights:[{text:'evidence'}],annotations:[{text:'note'}]};
  const a=link('https://one.example/a',['forecast'],[],[],context);
  const b=link('https://two.example/b',['forecast'],[],[],context);
  const model=buildEvidenceModel([a,b]);
  assert.equal(model.topics[0].readiness,'Decision Ready');
  assert.equal(model.counts.decisionReadyTopics,1);
});

test('flags weak topics when source evidence is thin',()=>{
  const a=link('https://one.example/a',['forecast']);
  const model=buildEvidenceModel([a]);
  assert.equal(model.topics[0].readiness,'Research Needed');
  assert.equal(model.counts.researchNeededTopics,1);
});
