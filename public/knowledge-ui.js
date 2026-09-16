import { normalizeKnowledge, scoreEvidence, buildKnowledgeGraph } from './knowledge-layer.js';

const DB_NAME = 'linktracer-local';
const DB_VERSION = 6;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
    request.onerror = () => reject(request.error || new Error('Unable to open local knowledge database'));
  });
}

async function readLinks() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('links', 'readonly').objectStore('links').getAll();
      request.onsuccess = () => resolve((request.result || []).map(normalizeKnowledge));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function normalizeLocalKnowledge() {
  return readLinks();
}

function renderHealth(links) {
  const root = document.getElementById('knowledgeRadar');
  if (!root) return;
  const scores = links.map(scoreEvidence);
  const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const claims = links.reduce((sum, link) => sum + link.sourceContext.claims.length, 0);
  const relations = links.reduce((sum, link) => sum + link.sourceContext.evidenceRelations.length, 0);
  let panel = root.querySelector('.knowledgeHealth');
  if (!panel) { panel = document.createElement('div'); panel.className = 'knowledgeHealth'; root.appendChild(panel); }
  panel.innerHTML = `<div><span class="eyebrow">KNOWLEDGE HEALTH</span><strong>${average}/100</strong><small>Average evidence strength</small></div><div><strong>${claims}</strong><small>Claims</small></div><div><strong>${relations}</strong><small>Evidence links</small></div><span class="hint">Normalized locally; no external AI call required.</span>`;
}

async function refresh() {
  try {
    const links = await normalizeLocalKnowledge();
    renderHealth(links);
    const active = links[0]?.canonicalUrl;
    if (active) buildKnowledgeGraph(links, active);
  } catch (error) { console.warn('Knowledge layer refresh failed', error); }
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    refresh();
    setInterval(refresh, 15000);
  }, { once: true });
  window.LinktracerKnowledge = { normalizeLocalKnowledge, refresh, buildKnowledgeGraph, scoreEvidence };
}
