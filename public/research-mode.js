const DB_NAME = 'linktracer-local';
const DB_VERSION = 6;
const SESSION_PREFIX = 'research-session:';

function uniqueChecklist(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  }).map(item => ({ ...item, label: String(item.label || '').trim(), done: Boolean(item.done) })).filter(item => item.label);
}

export function researchProgress(session) {
  const checklist = uniqueChecklist(session?.checklist);
  if (!checklist.length) return Math.max(0, Math.min(100, Number(session?.progress || 0)));
  return Math.round(checklist.filter(item => item.done).length / checklist.length * 100);
}

export function normalizeResearchSession(session) {
  const normalized = { ...session, checklist: uniqueChecklist(session?.checklist), updatedAt: Number(session?.updatedAt || Date.now()) };
  normalized.progress = researchProgress(normalized);
  if (normalized.progress === 100) normalized.status = 'completed';
  return normalized;
}

export function researchStatus(session, now = Date.now()) {
  if (session?.status === 'completed') return 'Completed';
  if (session?.status === 'paused') return 'Paused';
  const due = session?.dueAt ? Number(session.dueAt) : null;
  if (!Number.isFinite(due)) return 'Active';
  const days = Math.ceil((due - now) / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days <= 3) return 'Due soon';
  return 'Active';
}

export function evidenceProgress(evidence = {}) {
  const independentSources = Number(evidence.domainCount || 0) >= 2;
  const conflictFree = Number(evidence.contradictCount || 0) === 0;
  const qualityReady = Number(evidence.quality || 0) >= 75;
  const sourceReady = Number(evidence.sourceCount || 0) >= 2;
  const score = Math.round((independentSources ? 30 : 0) + (conflictFree ? 25 : 0) + (qualityReady ? 25 : Math.min(25, Number(evidence.quality || 0) / 3)) + (sourceReady ? 20 : Math.min(20, Number(evidence.sourceCount || 0) * 10)));
  return { independentSources, conflictFree, qualityReady, sourceReady, score: Math.max(0, Math.min(100, score)) };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => db.close(); resolve(db); };
    request.onerror = () => reject(request.error || new Error('Unable to open research database'));
  });
}

async function readStore(store) {
  const db = await openDb();
  try { return await new Promise((resolve, reject) => { const request = db.transaction(store, 'readonly').objectStore(store).getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); }); }
  finally { db.close(); }
}

async function renderResearchHealth() {
  const root = document.getElementById('researchWorkspace');
  if (!root) return;
  const sessions = (await readStore('collections')).filter(item => String(item.id || '').startsWith(SESSION_PREFIX)).map(normalizeResearchSession);
  const links = await readStore('links');
  let panel = root.querySelector('.researchModeHealth');
  if (!panel) { panel = document.createElement('div'); panel.className = 'researchModeHealth'; root.appendChild(panel); }
  const overdue = sessions.filter(s => researchStatus(s) === 'Overdue').length;
  const dueSoon = sessions.filter(s => ['Due today', 'Due soon'].includes(researchStatus(s))).length;
  const complete = sessions.filter(s => researchStatus(s) === 'Completed').length;
  const average = sessions.length ? Math.round(sessions.reduce((sum, s) => sum + researchProgress(s), 0) / sessions.length) : 0;
  panel.innerHTML = `<div><span class="eyebrow">RESEARCH MODE</span><strong>${average}%</strong><small>Average plan progress</small></div><div><strong>${dueSoon}</strong><small>Due soon</small></div><div><strong>${overdue}</strong><small>Overdue</small></div><div><strong>${complete}</strong><small>Completed</small></div><span class="hint">${links.length} saved sources available for evidence work.</span>`;
}

if (typeof window !== 'undefined') {
  window.LinktracerResearchMode = { normalizeResearchSession, researchStatus, researchProgress, evidenceProgress, refresh: renderResearchHealth };
  window.addEventListener('load', () => { renderResearchHealth().catch(error => console.warn('Research mode refresh failed', error)); setInterval(() => renderResearchHealth().catch(() => {}), 15000); });
}
