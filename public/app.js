const DB_NAME = 'linktracer-local';
const DB_VERSION = 2;
const deviceId = localStorage.getItem('linktracer-device') || crypto.randomUUID();
localStorage.setItem('linktracer-device', deviceId);
let links = [];
let syncTimer;

const $ = id => document.getElementById(id);
function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('links')) db.createObjectStore('links', { keyPath: 'canonicalUrl' });
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
const dbp = openDb();
function tx(store, mode='readonly') { return dbp.then(db => db.transaction(store, mode).objectStore(store)); }
function req(r) { return new Promise((resolve,reject) => { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
async function all(store) { return req((await tx(store)).getAll()); }
async function put(store, value) { return req((await tx(store,'readwrite')).put(value)); }
async function add(store, value) { return req((await tx(store,'readwrite')).add(value)); }
async function remove(store, key) { return req((await tx(store,'readwrite')).delete(key)); }

function canonicalize(raw) {
  const u = new URL(raw.trim());
  if (!['http:','https:'].includes(u.protocol)) throw new Error('Only http and https links are supported');
  u.hash=''; ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(k=>u.searchParams.delete(k));
  return u.toString().replace(/\/$/,'');
}
function localTags(text) {
  const stop = new Set('the and for with from this that your have into about after before when what which where while link https http www com org net'.split(' '));
  const counts = {};
  text.toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>=4&&!stop.has(w)).forEach(w=>counts[w]=(counts[w]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,6).map(x=>x[0]);
}
function merge(a,b) {
  const descriptions=[...(a?.descriptions||[]),...(b?.descriptions||[])];
  const seen=new Set();
  const unique=descriptions.filter(d=>d?.text?.trim()).filter(d=>{const k=d.text.trim().toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
  return {
    ...(a||{}), ...(b||{}),
    canonicalUrl:b?.canonicalUrl||a?.canonicalUrl,
    url:b?.url||a?.url,
    title:b?.title||a?.title||'',
    descriptions:unique,
    description:unique.map(d=>d.text).join('\n\n'),
    tags:[...new Set([...(a?.tags||[]),...(b?.tags||[])])],
    sourceContext:{...(a?.sourceContext||{}),...(b?.sourceContext||{})},
    updatedAt:Math.max(a?.updatedAt||0,b?.updatedAt||0)
  };
}
async function saveLocal(link, queue=true) {
  const current=(await all('links')).find(x=>x.canonicalUrl===link.canonicalUrl);
  const merged=merge(current,link);
  await put('links',merged);
  if(queue) await add('outbox',{...merged,changeId:crypto.randomUUID(),deviceId,queuedAt:Date.now()});
  links=await all('links'); render();
  if (navigator.onLine && 'serviceWorker' in navigator) navigator.serviceWorker.ready.then(r => r.sync?.register('linktracer-sync')).catch(()=>{});
}
async function enrichOnline(url) {
  const r=await fetch('/api/enrich',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
  if(!r.ok) throw new Error('enrichment unavailable');
  return r.json();
}
async function enrichPending() {
  if (!navigator.onLine) return;
  const current = await all('links');
  const candidates = current.filter(l => !l.sourceContext?.enrichedAt).slice(0, 5);
  for (const link of candidates) {
    try {
      const c = await enrichOnline(link.url);
      const enriched = merge(link, {
        ...link,
        title: link.title || c.title,
        description: c.description || link.description,
        descriptions: c.description ? [{text:c.description,deviceId:'source',updatedAt:c.enrichedAt}] : [],
        tags: [...new Set([...(link.tags||[]), ...(c.tags||[]), ...localTags(`${link.url} ${c.title} ${c.description} ${c.excerpt}`)])],
        sourceContext: {...(link.sourceContext||{}), site:c.site, status:c.status, favicon:c.favicon, excerpt:c.excerpt, enrichedAt:c.enrichedAt}
      });
      await saveLocal(enriched, true);
    } catch {}
  }
}
async function sync() {
  if(!navigator.onLine) { setStatus('Offline - local storage active'); return; }
  try {
    const outbox=await all('outbox');
    if (outbox.length) {
      const response=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId,changes:outbox})});
      if(!response.ok) throw new Error('sync failed');
      const payload=await response.json();
      for(const link of payload.links||[]) {
        const current=(await all('links')).find(x=>x.canonicalUrl===link.canonicalUrl);
        await put('links',merge(current,link));
      }
      for (const change of outbox) if ((payload.acceptedChangeIds||[]).includes(change.changeId)) await remove('outbox', change.id);
      if ((payload.rejectedChanges||[]).length) setStatus(`${payload.rejectedChanges.length} change(s) retained for retry`);
    }
    const cursor=(await req((await tx('meta')).get('cursor')))?.value||0;
    let nextCursor=cursor;
    let more=true;
    while (more) {
      const pull=await fetch(`/api/links?cursor=${encodeURIComponent(nextCursor)}`);
      if(!pull.ok) throw new Error('pull failed');
      const p=await pull.json();
      for(const link of p.links||[]) {
        const current=(await all('links')).find(x=>x.canonicalUrl===link.canonicalUrl);
        await put('links',merge(current,link));
      }
      nextCursor=p.cursor ?? nextCursor;
      more=Boolean(p.hasMore);
      await put('meta',{key:'cursor',value:nextCursor});
    }
    await enrichPending();
    links=await all('links'); render();
    const remaining=await all('outbox');
    setStatus(remaining.length ? `Online - ${remaining.length} change(s) queued` : 'Online and synced');
  } catch { setStatus('Offline mode - changes queued safely'); }
}
async function exportBackup() {
  const payload={format:'linktracer-backup',version:1,exportedAt:new Date().toISOString(),links:await all('links')};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`linktracer-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  setStatus('Local backup exported');
}
async function importBackup(file) {
  const payload=JSON.parse(await file.text());
  if(payload?.format!=='linktracer-backup'||!Array.isArray(payload.links)) throw new Error('Invalid Linktracer backup');
  for(const link of payload.links) {
    if(!link.canonicalUrl||!link.url) continue;
    await saveLocal({...link,canonicalUrl:canonicalize(link.canonicalUrl),deviceId},true);
  }
  await sync();
}
function setStatus(text){$('status').textContent=text;}
function render(){
  const q=$('search').value.toLowerCase().trim();
  const shown=links.filter(l=>!q||JSON.stringify(l).toLowerCase().includes(q)).sort((a,b)=>b.updatedAt-a.updatedAt);
  $('count').textContent=`${shown.length} link${shown.length===1?'':'s'}`;
  $('links').innerHTML=shown.map(l=>{
    const c=l.sourceContext||{};
    const excerpt=c.excerpt||'';
    const favicon=c.favicon?`<img class="favicon" src="${escapeHtml(c.favicon)}" alt="" loading="lazy" onerror="this.hidden=true">`:'';
    return `<article class="card link">${favicon}<a class="title" href="${escapeHtml(l.url)}" target="_blank" rel="noreferrer">${escapeHtml(l.title||l.url)}</a><div class="url">${escapeHtml(c.site||l.url)}</div>${l.description?`<p>${escapeHtml(l.description)}</p>`:''}${excerpt?`<details><summary>Saved source context</summary><p class="excerpt">${escapeHtml(excerpt)}</p></details>`:''}<div class="tags">${(l.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div><small>${new Date(l.updatedAt||Date.now()).toLocaleString()}</small></article>`;
  }).join('')||'<div class="empty">No links saved yet.</div>';
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

$('captureForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const url=canonicalize($('url').value);
    let title=$('title').value.trim(); let description=$('description').value.trim();
    let tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    let sourceContext={deviceId};
    const now=Date.now();
    if(navigator.onLine){
      try{const c=await enrichOnline(url);title=title||c.title;description=description||c.description;tags=[...new Set([...tags,...c.tags])];sourceContext={...sourceContext,site:c.site,status:c.status,favicon:c.favicon,excerpt:c.excerpt,enrichedAt:c.enrichedAt};$('enrichment').textContent='Source context extracted and tags suggested.';}catch{$('enrichment').textContent='Saved locally; source context will be added when connected.';}
    } else $('enrichment').textContent='Offline: saved locally. Context will be enriched after reconnect.';
    tags=[...new Set([...tags,...localTags(`${url} ${title} ${description}`)])];
    await saveLocal({canonicalUrl:url,url,title,description,descriptions:description?[{text:description,deviceId,updatedAt:now}]:[],tags,sourceContext,createdAt:now,updatedAt:now});
    e.target.reset();
    await sync();
  }catch(err){$('enrichment').textContent=err.message;}
});
$('search').addEventListener('input',render);
$('syncBtn').addEventListener('click',sync);
$('exportBtn').addEventListener('click',exportBackup);
$('importBtn').addEventListener('click',()=>$('importFile').click());
$('importFile').addEventListener('change',async e=>{try{if(e.target.files[0])await importBackup(e.target.files[0]);}catch(err){setStatus(`Import failed: ${err.message}`);}finally{e.target.value='';}});
window.addEventListener('online',sync); window.addEventListener('offline',()=>setStatus('Offline - local storage active'));
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.type === 'LINKTRACER_SYNC') sync(); });
(async()=>{links=await all('links');render();setStatus(navigator.onLine?'Online - syncing...':'Offline - local storage active');await sync();syncTimer=setInterval(sync,30000);})();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');