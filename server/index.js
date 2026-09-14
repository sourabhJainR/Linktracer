import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(process.env.LINKTRACER_DB || path.join(dataDir, 'linktracer.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  descriptions TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  source_context TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_links_updated ON links(updated_at);
CREATE TABLE IF NOT EXISTS change_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_url TEXT NOT NULL,
  revision INTEGER NOT NULL,
  changed_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_change_log_seq ON change_log(seq);
CREATE TABLE IF NOT EXISTS sync_operations (
  change_id TEXT PRIMARY KEY,
  accepted_at INTEGER NOT NULL
);
`);

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'public')));

function canonicalize(raw) {
  const u = new URL(raw.trim());
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http and https links are supported');
  u.hash = '';
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(k => u.searchParams.delete(k));
  return u.toString().replace(/\/$/, '');
}
function autoTags(text) {
  const stop = new Set('the and for with from this that your have into about after before when what which where while link https http www com org net'.split(' '));
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !stop.has(w));
  const counts = new Map();
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 8).map(([w]) => w);
}
function classify(url, title = '', text = '') {
  const u = new URL(url);
  const haystack = `${u.hostname} ${u.pathname} ${title} ${text.slice(0, 4000)}`.toLowerCase();
  const rules = [
    ['video', /youtube|youtu\.be|vimeo|video|watch/],
    ['code', /github|gitlab|bitbucket|stackoverflow|\.md\b|repository|source code|api reference/],
    ['documentation', /docs\.|documentation|reference|developer|\/docs(?:\/|$)|\/api(?:\/|$)/],
    ['article', /article|blog|post|medium\.com|substack|news|journal|read|analysis/],
    ['paper', /arxiv|researchgate|doi\.org|paper|abstract|proceedings|publication/],
    ['social', /x\.com|twitter|linkedin|reddit|threads|facebook/],
    ['product', /product|pricing|features|shop|store|marketplace/]
  ];
  for (const [type, pattern] of rules) if (pattern.test(haystack)) return type;
  return 'webpage';
}
function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}
function extractMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const re of patterns) { const value = html.match(re)?.[1]?.trim(); if (value) return value; }
  return '';
}
async function fetchUrl(url, method = 'GET') {
  return fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(7000), headers: { 'user-agent': 'Linktracer/1.1' } });
}
async function enrich(url) {
  try {
    const response = await fetchUrl(url);
    const html = (await response.text()).slice(0, 2_000_000);
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '';
    const description = extractMeta(html, 'description') || extractMeta(html, 'og:description');
    const site = new URL(url).hostname.replace(/^www\./, '');
    const text = htmlToText(html).slice(0, 12000);
    return { title, description, site, status: response.status, finalUrl: response.url, responseTimeMs: null, favicon: `${new URL(url).origin}/favicon.ico`, excerpt: text, contentType: classify(url, title, `${description} ${text}`) };
  } catch {
    return { title: '', description: '', site: new URL(url).hostname.replace(/^www\./, ''), status: 0, finalUrl: url, responseTimeMs: null, favicon: '', excerpt: '', contentType: classify(url) };
  }
}
async function checkHealth(url) {
  const started = Date.now();
  try {
    let response = await fetchUrl(url, 'HEAD');
    if (response.status === 405 || response.status === 501) response = await fetchUrl(url, 'GET');
    return { status: response.status, finalUrl: response.url, responseTimeMs: Date.now() - started, checkedAt: Date.now(), healthy: response.ok };
  } catch (error) {
    return { status: 0, finalUrl: url, responseTimeMs: Date.now() - started, checkedAt: Date.now(), healthy: false, error: error.message || 'request failed' };
  }
}
function parseDescriptions(value) { try { return Array.isArray(value) ? value : JSON.parse(value || '[]'); } catch { return []; } }
function parseTags(value) { try { return [...new Set((Array.isArray(value) ? value : JSON.parse(value || '[]')).map(String).map(s => s.trim().toLowerCase()).filter(Boolean))]; } catch { return []; } }
function mergedDescriptions(items) {
  const seen = new Set();
  return items.filter(x => x?.text?.trim()).filter(x => { const k = x.text.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).map(x => ({ text: x.text.trim(), deviceId: x.deviceId || 'unknown', updatedAt: Number(x.updatedAt || 0) }));
}
function mergedDescription(items) { return mergedDescriptions(items).map(x => x.text).join('\n\n'); }
function rowToLink(row) {
  const descriptions = parseDescriptions(row.descriptions);
  return { id: row.id, url: row.url, canonicalUrl: row.canonical_url, title: row.title, description: mergedDescription(descriptions), descriptions, tags: parseTags(row.tags), sourceContext: JSON.parse(row.source_context || '{}'), createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision };
}
const get = db.prepare('SELECT * FROM links WHERE canonical_url = ?');
const insert = db.prepare('INSERT INTO links (id,canonical_url,url,title,descriptions,tags,source_context,created_at,updated_at,revision) VALUES (?,?,?,?,?,?,?,?,?,?)');
const update = db.prepare('UPDATE links SET url=?,title=?,descriptions=?,tags=?,source_context=?,updated_at=?,revision=revision+1 WHERE canonical_url=?');
const logChange = db.prepare('INSERT INTO change_log (canonical_url,revision,changed_at) VALUES (?,?,?)');
const seenOperation = db.prepare('SELECT 1 FROM sync_operations WHERE change_id = ?');
const recordOperation = db.prepare('INSERT INTO sync_operations (change_id,accepted_at) VALUES (?,?)');
function mergeLink(input, existing, now) {
  const canonicalUrl = canonicalize(input.url || input.canonicalUrl);
  const descriptions = existing ? parseDescriptions(existing.descriptions) : [];
  const incoming = Array.isArray(input.descriptions) && input.descriptions.length ? input.descriptions : (input.description ? [{ text: input.description, deviceId: input.deviceId || 'unknown', updatedAt: now }] : []);
  const merged = mergedDescriptions([...descriptions, ...incoming]);
  const tags = [...new Set([...(existing ? parseTags(existing.tags) : []), ...parseTags(input.tags || [])])];
  const context = { ...(existing ? JSON.parse(existing.source_context || '{}') : {}), ...(input.sourceContext || {}) };
  const title = input.title?.trim() || existing?.title || '';
  const url = input.url?.trim() || existing?.url || canonicalUrl;
  if (!existing) { const id = input.id || randomUUID(); insert.run(id, canonicalUrl, url, title, JSON.stringify(merged), JSON.stringify(tags), JSON.stringify(context), now, now, 1); logChange.run(canonicalUrl, 1, now); return rowToLink(get.get(canonicalUrl)); }
  update.run(url, title, JSON.stringify(merged), JSON.stringify(tags), JSON.stringify(context), now, canonicalUrl);
  const updated = get.get(canonicalUrl); logChange.run(canonicalUrl, updated.revision, now); return rowToLink(updated);
}
app.get('/api/links', (req, res) => {
  const cursor = Number(req.query.cursor || 0); const safeCursor = Number.isFinite(cursor) && cursor >= 0 ? cursor : 0;
  const changes = db.prepare('SELECT seq, canonical_url FROM change_log WHERE seq > ? ORDER BY seq ASC LIMIT 500').all(safeCursor);
  const uniqueUrls = [...new Set(changes.map(x => x.canonical_url))]; const rows = uniqueUrls.map(url => get.get(url)).filter(Boolean);
  const nextCursor = changes.length ? changes[changes.length - 1].seq : safeCursor;
  res.json({ links: rows.map(rowToLink), serverTime: Date.now(), cursor: nextCursor, hasMore: changes.length === 500 });
});
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = db.prepare('SELECT * FROM links ORDER BY updated_at DESC').all().map(rowToLink);
  if (!q) return res.json({ links: rows.slice(0, 100), count: rows.length });
  const terms = q.split(/\s+/).filter(Boolean);
  const results = rows.filter(link => { const hay = JSON.stringify(link).toLowerCase(); return terms.every(term => hay.includes(term)); }).slice(0, 100);
  res.json({ links: results, count: results.length });
});
const syncBatch = db.transaction((changes) => {
  const merged = [], acceptedChangeIds = [], rejectedChanges = [];
  for (const change of changes) {
    const changeId = String(change?.changeId || '');
    try { if (!changeId) throw new Error('missing changeId'); if (seenOperation.get(changeId)) { acceptedChangeIds.push(changeId); continue; } const canonical = canonicalize(change.url || change.canonicalUrl || ''); merged.push(mergeLink(change, get.get(canonical), Date.now())); recordOperation.run(changeId, Date.now()); acceptedChangeIds.push(changeId); }
    catch (error) { rejectedChanges.push({ changeId, error: error.message || 'invalid change' }); }
  }
  return { merged, acceptedChangeIds, rejectedChanges };
});
app.post('/api/sync', (req, res) => { const changes = Array.isArray(req.body?.changes) ? req.body.changes : []; const result = syncBatch(changes); res.json({ ...result, links: result.merged, serverTime: Date.now() }); });
app.post('/api/enrich', async (req, res) => { try { const url = canonicalize(req.body?.url || ''); const context = await enrich(url); res.json({ url, ...context, tags: autoTags(`${url} ${context.title} ${context.description} ${context.excerpt}`), enrichedAt: Date.now() }); } catch (e) { res.status(400).json({ error: e.message }); } });
app.post('/api/link-health', async (req, res) => { try { const url = canonicalize(req.body?.url || ''); res.json({ url, ...(await checkHealth(url)) }); } catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/health', (_req, res) => res.json({ ok: true, time: Date.now() }));
app.get('*splat', (_req, res) => res.sendFile(path.join(root, 'public', 'index.html')));

const port = Number(process.env.PORT || 8787);
app.listen(port, '0.0.0.0', () => console.log(`Linktracer running at http://localhost:${port}`));