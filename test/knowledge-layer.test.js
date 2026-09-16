import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKnowledge, buildKnowledgeGraph, scoreEvidence } from '../public/knowledge-layer.js';
import fs from 'node:fs';

test('normalizes claims and evidence relations without duplicate ids', () => {
  const link = {
    canonicalUrl: 'https://example.com/a',
    url: 'https://example.com/a',
    title: 'Example',
    tags: ['AI', 'ai'],
    sourceContext: {
      claims: [{ id: 'c1', text: 'A claim' }, { id: 'c1', text: 'duplicate' }],
      evidenceRelations: [
        { id: 'r1', claimId: 'c1', targetCanonicalUrl: 'https://example.com/b', type: 'supports' },
        { id: 'r1', claimId: 'c1', targetCanonicalUrl: 'https://example.com/b', type: 'supports' }
      ]
    }
  };
  const normalized = normalizeKnowledge(link);
  assert.deepEqual(normalized.tags, ['ai']);
  assert.equal(normalized.sourceContext.claims.length, 1);
  assert.equal(normalized.sourceContext.evidenceRelations.length, 1);
});

test('builds a deterministic graph with typed claim evidence and related sources', () => {
  const links = [
    normalizeKnowledge({ canonicalUrl: 'https://example.com/a', url: 'https://example.com/a', title: 'AI Forecasting', tags: ['ai', 'forecast'], sourceContext: { claims: [{ id: 'c1', text: 'Forecasting can use AI' }], evidenceRelations: [{ id: 'r1', claimId: 'c1', targetCanonicalUrl: 'https://example.com/b', type: 'supports', confidence: 0.8 }] } }),
    normalizeKnowledge({ canonicalUrl: 'https://example.com/b', url: 'https://example.com/b', title: 'AI Forecasting Research', tags: ['ai', 'forecast'] }),
    normalizeKnowledge({ canonicalUrl: 'https://other.example/c', url: 'https://other.example/c', title: 'Cooking', tags: ['food'] })
  ];
  const graph = buildKnowledgeGraph(links, 'https://example.com/a');
  assert.equal(graph.nodes.filter(n => n.type === 'link').length, 2);
  assert.equal(graph.nodes.filter(n => n.type === 'claim').length, 1);
  assert.ok(graph.edges.some(e => e.type === 'supports' && e.confidence === 0.8));
  assert.ok(graph.edges.some(e => e.type === 'related_to' && e.to === 'link:https://example.com/b'));
  assert.ok(!graph.edges.some(e => e.to === 'link:https://other.example/c'));
});

test('evidence scoring is bounded and rewards independent signals', () => {
  const weak = scoreEvidence({ sourceContext: {} });
  const strong = scoreEvidence({
    description: 'context', tags: ['one', 'two'],
    sourceContext: { excerpt: 'evidence', enrichedAt: Date.now(), status: 200, highlights: [{}], annotations: [{}], claims: [{ id: 'c', text: 'claim' }], evidenceRelations: [{ id: 'r', type: 'supports' }] }
  });
  assert.ok(weak >= 0 && weak <= 100);
  assert.ok(strong > weak);
  assert.ok(strong <= 100);
});

test('knowledge UI uses the shared engine and current IndexedDB schema', () => {
  const ui = fs.readFileSync('public/knowledge-ui.js', 'utf8');
  const index = fs.readFileSync('public/index.html', 'utf8');
  assert.match(ui, /knowledge-layer\.js/);
  assert.match(ui, /linktracer-local/);
  assert.match(ui, /indexedDB\.open\(DB_NAME, DB_VERSION\)/);
  assert.match(ui, /const DB_VERSION = 6/);
  assert.doesNotMatch(ui, /store\.put\(/);
  assert.match(index, /knowledge-ui\.js\?v=/);
});
