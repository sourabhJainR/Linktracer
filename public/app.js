const DB_NAME = 'linktracer-local';
const DB_VERSION = 1;
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
async function clear(store) { return req((await tx(store,'readwrite')).clear()); }

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
  if(queue) await add('outbox',{...merged,id:undefined,deviceId,queuedAt:Date.now()});
  links=await all('links'); render();
}

async function enrichOnline(url) {
  const r=await fetch('/api/enrich',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url})});
  if(!r.ok) throw new Error('enrichment unavailable');
  return r.json();
}

async function sync() {
  if(!navigator.onLine) { setStatus('Offline'); return; }
  try {
    const outbox=await all('outbox');
    const response=await fetch('/api/sync',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({deviceId,changes:outbox})});
    if(!response.ok) throw new Error('sync failed');
    const payload=await response.json();
    for(const link of payload.links||[]) await put('links',merge((await all('links')).find(x=>x.canonicalUrl===link.canonicalUrl),link));
    await clear('outbox');
    const since=(await req((await tx('meta')).get('serverTime')))?.value||0;
    const pull=await fetch(`/api/links?since=${encodeURIComponent(since)}`);
    if(pull.ok){const p=await pull.json();for(const link of p.links||[]) await put('links',merge((await all('links')).find(x=>x.canonicalUrl===link.canonicalUrl),link));await put('meta',{key:'serverTime',value:p.serverTime});}
    links=await all('links'); render(); setStatus('Online and synced');
  } catch { setStatus('Offline mode - changes queued'); }
}
function setStatus(text){$('status').textContent=text;}
function render(){
  const q=$('search').value.toLowerCase().trim();
  const shown=links.filter(l=>!q||JSON.stringify(l).toLowerCase().includes(q)).sort((a,b)=>b.updatedAt-a.updatedAt);
  $('count').textContent=`${shown.length} link${shown.length===1?'':'s'}`;
  $('links').innerHTML=shown.map(l=>`<article class="card link"><a class="title" href="${escapeHtml(l.url)}" target="_blank" rel="noreferrer">${escapeHtml(l.title||l.url)}</a><div class="url">${escapeHtml(l.url)}</div>${l.description?`<p>${escapeHtml(l.description)}</p>`:''}<div class="tags">${(l.tags||[]).map(t=>`<span>${escapeHtml(t)}</span>`).join('')}</div><small>${new Date(l.updatedAt||Date.now()).toLocaleString()}</small></article>`).join('')||'<div class="empty">No links saved yet.</div>';
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

$('captureForm').addEventListener('submit',async e=>{
  e.preventDefault();
  try{
    const url=canonicalize($('url').value);
    let title=$('title').value.trim(); let description=$('description').value.trim();
    let tags=$('tags').value.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
    const now=Date.now();
    if(navigator.onLine){
      try{const c=await enrichOnline(url);title=title||c.title;description=description||c.description;tags=[...new Set([...tags,...c.tags])];$('enrichment').textContent='Source context extracted and tags suggested.';}catch{$('enrichment').textContent='Saved locally; source context will be added when connected.';}
    } else $('enrichment').textContent='Offline: saved locally. Context will be enriched after reconnect.';
    tags=[...new Set([...tags,...localTags(`${url} ${title} ${description}`)])];
    await saveLocal({canonicalUrl:url,url,title,description,descriptions:description?[{text:description,deviceId,updatedAt:now}]:[],tags,sourceContext:{deviceId},createdAt:now,updatedAt:now});
    e.target.reset();
    await sync();
  }catch(err){$('enrichment').textContent=err.message;}
});
$('search').addEventListener('input',render);
$('syncBtn').addEventListener('click',sync);
window.addEventListener('online',sync); window.addEventListener('offline',()=>setStatus('Offline - local storage active'));

(async()=>{links=await all('links');render();setStatus(navigator.onLine?'Online - syncing...':'Offline - local storage active');await sync();syncTimer=setInterval(sync,30000);})();
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
