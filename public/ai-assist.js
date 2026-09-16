const CONFIG_KEY = 'linktracer-ai-config';
const DB_NAME = 'linktracer-local';
const DB_VERSION = 6;
const DEFAULT_CONFIG = { enabled: false, endpoint: '', model: 'default' };
let selectedLink = null;

export function aiAssistConfig(overrides = {}) {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG_KEY) : null;
  let parsed = {};
  try { parsed = stored ? JSON.parse(stored) : {}; } catch { parsed = {}; }
  return { ...DEFAULT_CONFIG, ...parsed, ...overrides, enabled: Boolean(overrides.enabled ?? parsed.enabled ?? DEFAULT_CONFIG.enabled) };
}

export function sanitizeForAI(link = {}) {
  return {
    url: String(link.url || link.canonicalUrl || '').slice(0, 2000),
    title: String(link.title || '').slice(0, 300),
    description: String(link.description || '').slice(0, 2000),
    tags: [...new Set((Array.isArray(link.tags) ? link.tags : []).map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean))].slice(0, 30)
  };
}

export function validateAIResponse(response) {
  if (!response || typeof response !== 'object') throw new Error('AI response must be an object');
  const summary = String(response.summary || '').trim();
  const tags = [...new Set((Array.isArray(response.tags) ? response.tags : []).map(tag => String(tag || '').trim().toLowerCase()).filter(Boolean))].slice(0, 30);
  const confidence = Number(response.confidence);
  if (summary.length > 2000 || (summary && summary.length < 2) || tags.some(tag => tag.length > 60) || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error('AI response failed validation');
  return { summary, tags, confidence };
}

export async function enrichLink(link, overrides = {}) {
  const config = aiAssistConfig(overrides);
  if (!config.enabled) throw new Error('AI assistance is disabled; enable it explicitly first.');
  if (!config.endpoint) throw new Error('Configure an AI provider endpoint before enriching.');
  const payload = sanitizeForAI(link);
  const response = await fetch(config.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: config.model, input: payload }) });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  return validateAIResponse(await response.json());
}

export function setAIConfig(config) {
  const next = aiAssistConfig(config);
  if (typeof localStorage !== 'undefined') localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  return next;
}

function openDb() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); }; request.onerror = () => reject(request.error || new Error('Unable to open local database')); }); }
async function readLink(canonicalUrl) { const db = await openDb(); try { return await new Promise((resolve, reject) => { const request = db.transaction('links', 'readonly').objectStore('links').get(canonicalUrl); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); }); } finally { db.close(); } }
async function persistEnrichment(link, enrichment) {
  const db = await openDb();
  const updated = { ...link, sourceContext: { ...(link.sourceContext || {}), ai: { ...enrichment, enrichedAt: Date.now(), provider: aiAssistConfig().model } }, updatedAt: Date.now() };
  try {
    await new Promise((resolve, reject) => { const request = db.transaction('links', 'readwrite').objectStore('links').put(updated); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
    await new Promise((resolve, reject) => { const request = db.transaction('outbox', 'readwrite').objectStore('outbox').add({ ...updated, changeId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`, deviceId: localStorage.getItem('linktracer-device') || 'ai-assist', queuedAt: Date.now() }); request.onsuccess = resolve; request.onerror = () => reject(request.error); });
  } finally { db.close(); }
  window.LinktracerIO?.sync?.();
  window.LinktracerSmartLibrary?.refresh?.();
  document.dispatchEvent(new CustomEvent('linktracer-ai-enriched', { detail: updated }));
  return updated;
}

export function selectLink(link) { selectedLink = link ? sanitizeForAI(link) : null; return selectedLink; }

async function enrichSelected(status) {
  if (!selectedLink?.url) throw new Error('Select a source first.');
  const full = await readLink(selectedLink.url);
  if (!full) throw new Error('Selected source is no longer in the local library.');
  status.textContent = 'Calling the configured provider…';
  const enrichment = await enrichLink(full);
  await persistEnrichment(full, enrichment);
  status.textContent = 'Enrichment saved locally and queued for sync.';
}

function escapeAttr(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function render() {
  const root = document.getElementById('aiAssist');
  if (!root) return;
  const config = aiAssistConfig();
  root.innerHTML = `<div class="aiAssistHeader"><div><span class="eyebrow">OPTIONAL AI</span><strong>AI-assisted enrichment</strong><small>Off by default. No background AI calls. Only the selected source is sent.</small></div><label class="aiToggle"><input id="aiEnabled" type="checkbox" ${config.enabled ? 'checked' : ''}><span>Enable</span></label></div><div class="aiAssistForm"><label>Provider endpoint<input id="aiEndpoint" value="${escapeAttr(config.endpoint)}" inputmode="url" placeholder="https://your-provider.example/enrich"></label><label>Model<input id="aiModel" value="${escapeAttr(config.model)}"></label><button id="aiSave" type="button">Save settings</button><button id="aiEnrich" type="button" class="subtle" ${config.enabled && selectedLink ? '' : 'disabled'}>Enrich selected source</button></div><p id="aiStatus" class="hint">${selectedLink ? `Selected: ${selectedLink.title || selectedLink.url}` : 'Select a source from the library to begin.'}</p>`;
  root.querySelector('#aiSave').onclick = () => { setAIConfig({ enabled: root.querySelector('#aiEnabled').checked, endpoint: root.querySelector('#aiEndpoint').value.trim(), model: root.querySelector('#aiModel').value.trim() || DEFAULT_CONFIG.model }); render(); };
  root.querySelector('#aiEnabled').onchange = () => { root.querySelector('#aiEnrich').disabled = !root.querySelector('#aiEnabled').checked || !selectedLink; };
  root.querySelector('#aiEnrich').onclick = async () => { const status = root.querySelector('#aiStatus'); root.querySelector('#aiEnrich').disabled = true; try { await enrichSelected(status); } catch (error) { status.textContent = error.message; } finally { root.querySelector('#aiEnrich').disabled = !aiAssistConfig().enabled || !selectedLink; } };
}

if (typeof window !== 'undefined') {
  window.LinktracerAI = { aiAssistConfig, sanitizeForAI, validateAIResponse, enrichLink, setAIConfig, selectLink };
  window.addEventListener('linktracer-ai-select', event => { selectedLink = event.detail?.link ? sanitizeForAI(event.detail.link) : null; render(); document.getElementById('aiAssist')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  window.addEventListener('load', render);
}
