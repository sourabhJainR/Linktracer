import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForAI, validateAIResponse, aiAssistConfig } from '../public/ai-assist.js';
import fs from 'node:fs';

test('AI payload is explicit, minimal and excludes local-only fields', () => {
  const payload = sanitizeForAI({ url: 'https://example.com', title: 'Example', description: 'Context', tags: ['AI'], sourceContext: { claims: [{ id: 'secret', text: 'Claim' }], authToken: 'do-not-send' }, health: { status: 200 }, createdAt: 1 });
  assert.deepEqual(payload, { url: 'https://example.com', title: 'Example', description: 'Context', tags: ['ai'] });
});

test('AI responses require bounded structured fields', () => {
  assert.deepEqual(validateAIResponse({ summary: 'Useful', tags: ['AI', 'Research'], confidence: 0.8 }), { summary: 'Useful', tags: ['ai', 'research'], confidence: 0.8 });
  assert.throws(() => validateAIResponse({ summary: 'x'.repeat(2001), tags: [], confidence: 2 }));
});

test('AI is disabled by default and requires explicit opt-in', () => {
  const config = aiAssistConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.endpoint, '/api/ai');
  const ui = fs.readFileSync('public/ai-assist.js', 'utf8');
  const index = fs.readFileSync('public/index.html', 'utf8');
  assert.match(ui, /enabled.*false/);
  assert.match(ui, /explicit/i);
  assert.match(index, /ai-assist\.js\?v=/);
});
