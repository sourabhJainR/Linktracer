const CONFIG_KEY = 'linktracer-ai-config';
const DEFAULT_CONFIG = { enabled: false, endpoint: '/api/ai', model: 'default' };

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

function render() {
  const root = document.getElementById('aiAssist');
  if (!root) return;
  const config = aiAssistConfig();
  root.innerHTML = `<div class="aiAssistHeader"><div><span class="eyebrow">OPTIONAL AI</span><strong>AI-assisted enrichment</strong><small>Off by default. No background AI calls.</small></div><label class="aiToggle"><input id="aiEnabled" type="checkbox" ${config.enabled ? 'checked' : ''}><span>Enable</span></label></div><div class="aiAssistForm"><label>Provider endpoint<input id="aiEndpoint" value="${config.endpoint.replace(/\"/g,'&quot;')}" inputmode="url"></label><label>Model<input id="aiModel" value="${config.model.replace(/\"/g,'&quot;')}"></label><button id="aiSave" type="button">Save settings</button><button id="aiEnrich" type="button" class="subtle" ${config.enabled ? '' : 'disabled'}>Enrich selected source</button></div><p id="aiStatus" class="hint">${config.enabled ? 'AI is enabled. Enrichment is still manual and per-source.' : 'AI is disabled. Enable it to use a configured provider.'}</p>`;
  root.querySelector('#aiSave').onclick = () => { const next = setAIConfig({ enabled: root.querySelector('#aiEnabled').checked, endpoint: root.querySelector('#aiEndpoint').value.trim() || DEFAULT_CONFIG.endpoint, model: root.querySelector('#aiModel').value.trim() || DEFAULT_CONFIG.model }); render(); if (next.enabled) root.querySelector('#aiStatus').textContent = 'AI is enabled. Select a source and use Enrich when you want an external AI call.'; };
  root.querySelector('#aiEnabled').onchange = () => { root.querySelector('#aiEnrich').disabled = !root.querySelector('#aiEnabled').checked; };
  root.querySelector('#aiEnrich').onclick = () => { root.querySelector('#aiStatus').textContent = 'Manual enrichment is ready; select a source in the library first.'; };
}

if (typeof window !== 'undefined') { window.LinktracerAI = { aiAssistConfig, sanitizeForAI, validateAIResponse, enrichLink, setAIConfig }; window.addEventListener('load', render); }
