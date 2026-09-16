import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeResearchSession, researchStatus, researchProgress, evidenceProgress } from '../public/research-mode.js';
import fs from 'node:fs';

test('normalizes research sessions with stable checklist and progress', () => {
  const session = normalizeResearchSession({
    id: 'research-session:1',
    name: 'AI decision',
    checklist: [{ id: 'a', label: 'One', done: true }, { id: 'a', label: 'Duplicate', done: false }],
    progress: 99
  });
  assert.equal(session.checklist.length, 1);
  assert.equal(session.progress, 100);
});

test('computes due-date status without mutating the session', () => {
  const now = Date.now();
  assert.equal(researchStatus({ status: 'completed', dueAt: now - 100000 }), 'Completed');
  assert.equal(researchStatus({ status: 'active', dueAt: now - 86400000 }, now), 'Overdue');
  assert.equal(researchStatus({ status: 'active', dueAt: now }, now), 'Due today');
  assert.equal(researchStatus({ status: 'active', dueAt: now + 2 * 86400000 }, now), 'Due soon');
});

test('evidence progress reflects independent sources and conflicts', () => {
  const state = evidenceProgress({ sourceCount: 3, domainCount: 2, quality: 84, supportCount: 2, contradictCount: 0 });
  assert.equal(state.independentSources, true);
  assert.equal(state.conflictFree, true);
  assert.equal(state.qualityReady, true);
  assert.ok(state.score >= 80);
});

test('research integration keeps IndexedDB at v6 and avoids a second persistence path', () => {
  const ui = fs.readFileSync('public/research-mode.js', 'utf8');
  const evidence = fs.readFileSync('public/research-evidence.js', 'utf8');
  assert.match(ui, /DB_VERSION\s*=\s*6/);
  assert.match(ui, /research-session:/);
  assert.doesNotMatch(evidence, /indexedDB\.open\(DB,3\)/);
});
