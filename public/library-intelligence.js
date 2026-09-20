const DB_NAME='linktracer-local',DB_VERSION=6;
const $=id=>document.getElementById(id);
const state={selected:new Set(),saved:JSON.parse(localStorage.getItem('linktracer-saved-searches')||'[]')};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>db.close();resolve(db)};r.onerror=()=>reject(r.error)})}
async function links(){return window.LinktracerApp?.getLinks?.()||[]}
async function visibleLinks(){return window.LinktracerApp?.getVisibleLinks?.()||await links()}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Bulk transaction aborted'))})}
function deviceId(){return localStorage.getItem('linktracer-device')||crypto.randomUUID()}
async function bulkMutate(action,selected,dueAt=null){
  if(!selected.length)return 0;
  const db=await openDb();
  try{
    const tx=db.transaction(['links','outbox'],'readwrite'),store=tx.objectStore('links'),out=tx.objectStore('outbox');
    for(const link of selected){
      const now=Date.now();
      if(action==='delete'){
        store.delete(link.canonicalUrl);
        out.add({entityType:'link',canonicalUrl:link.canonicalUrl,deleted:true,sourceContext:{removedReason:'bulk-delete-2.0',removedAt:now},changeId:crypto.randomUUID(),deviceId:deviceId(),queuedAt:now});
        continue;
      }
      const sourceContext={...(link.sourceContext||{})};
      let updated={...link,updatedAt:now};
      if(action==='favorite'){updated={...updated,favorite:true,sourceContext:{...sourceContext,favorite:true}}}
      if(action==='unfavorite'){updated={...updated,favorite:false,sourceContext:{...sourceContext,favorite:false}}}
      if(action==='followup'){const followUp={...(link.followUp||{}),enabled:true,dueAt};updated={...updated,followUp,sourceContext:{...sourceContext,followUp}}}
      if(action==='unfollowup'){const followUp={...(link.followUp||{}),enabled:false,dueAt:null};updated={...updated,followUp,sourceContext:{...sourceContext,followUp}}}
      if(action==='keep'||action==='archive'){
        const status=action==='keep'?'kept':'archived',processedAt=now;
        updated={...updated,triage:{...(link.triage||{}),status,processedAt},sourceContext:{...sourceContext,triage:{...(sourceContext.triage||{}),status,processedAt}}};
      }
      store.put(updated);
      out.add({...updated,changeId:crypto.randomUUID(),deviceId:deviceId(),queuedAt:now});
    }
    await txDone(tx);
    return selected.length;
  }finally{db.close()}
}
async function deleteLink(l){const db=await openDb();await new Promise((res,rej)=>{const tx=db.transaction(['links','outbox'],'readwrite');tx.objectStore('links').delete(l.canonicalUrl);tx.objectStore('outbox').add({entityType:'link',canonicalUrl:l.canonicalUrl,deleted:true,sourceContext:{removedReason:'bulk-delete',removedAt:Date.now()},changeId:crypto.randomUUID(),deviceId:localStorage.getItem('linktracer-device'),queuedAt:Date.now()});tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}
function saveSaved(){localStorage.setItem('linktracer-saved-searches',JSON.stringify(state.saved))}
function loadStyles(){if(document.getElementById('libraryIntelligenceStyles'))return;const s=document.createElement('style');s.id='libraryIntelligenceStyles';s.textContent=`.libraryIntelligence{margin:-2px 0 12px}.intelToolbar{display:flex;flex-wrap:wrap;gap:7px}.intelToolbar button{min-height:32px;font-size:11px}.intelPanel{margin-top:9px;padding:14px;border:1px solid var(--line,#e2e8f0);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 10px 28px rgba(15,23,42,.08);outline:none}.intelPanel[hidden]{display:none}.intelPanelHead{display:flex;align-items:center;gap:10px;margin-bottom:12px}.intelPanelHead strong{font-size:13px}.intelPanelHead span{font-size:11px;color:var(--muted,#64748b);margin-right:auto}.intelPanelHead button{margin-left:auto}.commandList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.commandList button{text-align:left}.duplicateGroup{display:grid;gap:7px;padding:10px 0;border-top:1px solid var(--line,#e2e8f0)}.duplicateGroup label,.bulkRow{display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:start;font-size:12px}.duplicateGroup label small,.bulkRow small{grid-column:2;color:var(--muted,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.savedSearchCreate{display:grid;grid-template-columns:1fr 2fr auto;gap:7px;margin-bottom:10px}.savedSearchRow{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:8px 0;border-top:1px solid var(--line,#e2e8f0)}.savedSearchRow code{font-size:10px;color:var(--muted,#64748b);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bulkActions{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}.bulkRow{grid-template-columns:auto minmax(0,1fr);padding:8px 0;border-top:1px solid var(--line,#e2e8f0)}.bulkRow span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bulkRow small{grid-column:2}@media(max-width:600px){.commandList,.savedSearchCreate,.savedSearchRow{grid-template-columns:1fr}.savedSearchRow code,.savedSearchRow button:last-child{justify-self:start}}`;document.head.appendChild(s)}
function layout(){const lib=document.querySelector('.librarySection');if(!lib)return;if(lib.querySelector('#libraryIntelligence'))return;const header=lib.querySelector('.libraryHeader');const box=document.createElement('div');box.id='libraryIntelligence';box.className='libraryIntelligence';box.innerHTML=`<div class="intelToolbar" role="toolbar" aria-label="Library intelligence"><button type="button" data-intel="command">Command</button><button type="button" data-intel="duplicates">Duplicates</button><button type="button" data-intel="saved">Saved searches</button><button type="button" data-intel="bulk" class="subtle">Bulk select</button></div><div id="intelPanel" class="intelPanel" hidden></div>`;header?.after(box)}
function panel(html){const p=$('intelPanel');if(!p)return;p.innerHTML=html;p.hidden=false;p.tabIndex=-1;p.focus()}
function closePanel(){const p=$('intelPanel');if(p)p.hidden=true}
function showCommand(){panel(`<div class="intelPanelHead"><strong>Command palette</strong><button type="button" data-intel-close>Close</button></div><input id="intelCommandSearch" type="search" placeholder="Search actions…"><div class="commandList"><button data-cmd="search">Search library</button><button data-cmd="duplicates">Review duplicates</button><button data-cmd="saved">Saved searches</button><button data-cmd="bulk">Select links</button><button data-cmd="clear">Clear search</button></div>`);$('intelCommandSearch')?.focus()}
async function showDuplicates(){const ls=await links(),groups=new Map();for(const l of ls){const title=String(l.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\b(the|a|an|official|home|homepage)\b/g,' ').replace(/\s+/g,' ').trim();if(title.length<10)continue;const host=(()=>{try{return new URL(l.url).hostname.replace(/^www\./,'').toLowerCase()}catch{return''}})();const k=host+'|'+title;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(l)}const dup=[...groups.values()].filter(g=>g.length>1);panel(`<div class="intelPanelHead"><strong>Duplicate center</strong><span>${dup.length} groups</span><button type="button" data-intel-close>Close</button></div>${dup.length?dup.map((g,i)=>`<section class="duplicateGroup"><strong>Possible duplicate ${i+1}</strong>${g.map(l=>`<label><input type="checkbox" data-dup-url="${esc(l.canonicalUrl)}"> ${esc(l.title||l.url)} <small>${esc(l.url)}</small></label>`).join('')}<button type="button" data-dup-search="${esc(g[0].title||'')}">Open in search</button></section>`).join(''):'<p>No likely duplicates found.</p>'}`)}
function showSaved(){panel(`<div class="intelPanelHead"><strong>Saved searches</strong><button type="button" data-intel-close>Close</button></div><div class="savedSearchCreate"><input id="savedSearchName" placeholder="Name"><input id="savedSearchQuery" placeholder="Search query"><button type="button" data-save-search>Save</button></div>${state.saved.length?state.saved.map((s,i)=>`<div class="savedSearchRow"><button type="button" data-run-search="${i}">${esc(s.name)}</button><code>${esc(s.query)}</code><button type="button" data-delete-search="${i}">Delete</button></div>`).join(''):'<p>No saved searches yet.</p>'}`)}
function showBulk(){
  state.selected.clear();
  panel(`<div class="intelPanelHead"><strong>Bulk actions</strong><span id="bulkScopeLabel">Current visible results</span><span data-bulk-count>0 selected</span><button type="button" data-intel-close>Close</button></div>
  <div class="bulkActions">
    <button type="button" data-bulk-select="all">Select all visible</button>
    <button type="button" data-bulk-select="clear">Clear selection</button>
    <button type="button" data-bulk-select="invert">Invert selection</button>
  </div>
  <div class="bulkActions">
    <button type="button" data-bulk-action="favorite">Favorite</button>
    <button type="button" data-bulk-action="unfavorite">Unfavorite</button>
    <button type="button" data-bulk-action="followup">Follow-up</button>
    <button type="button" data-bulk-action="unfollowup">Clear follow-up</button>
    <button type="button" data-bulk-action="keep">Keep</button>
    <button type="button" data-bulk-action="archive">Archive</button>
    <button type="button" data-bulk-action="delete">Delete</button>
  </div>
  <div class="bulkActions">
    <button type="button" data-bulk-action="open">Open selected</button>
    <button type="button" data-bulk-action="copy">Copy URLs</button>
    <button type="button" data-bulk-action="export">Export selected</button>
  </div>
  <div id="bulkList"></div>`);
  renderBulkList();
}
async function renderBulkList(){
  const target=$('bulkList');if(!target)return;
  const ls=await visibleLinks();
  for(const key of [...state.selected])if(!ls.some(l=>l.canonicalUrl===key))state.selected.delete(key);
  const count=document.querySelector('[data-bulk-count]');
  if(count)count.textContent=`${state.selected.size} selected`;
  const scope=$('bulkScopeLabel');
  if(scope)scope.textContent=`${ls.length} visible results`;
  target.innerHTML=ls.map(l=>`<label class="bulkRow"><input type="checkbox" data-bulk-url="${esc(l.canonicalUrl)}" ${state.selected.has(l.canonicalUrl)?'checked':''}><span>${esc(l.title||l.url)}</span><small>${esc(l.url)}</small></label>`).join('')||'<p>No links match the current library filters.</p>';
}
function downloadText(name,text,type='application/json'){
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
async function bulkAction(action){
  const scopedLinks=await visibleLinks(), selected=scopedLinks.filter(l=>state.selected.has(l.canonicalUrl));
  if(!selected.length){$('status')&&($('status').textContent='Select at least one link first');return}
  if(action==='open'){selected.slice(0,10).forEach(l=>window.open(l.url,'_blank','noopener,noreferrer'));$('status')&&($('status').textContent=`Opened ${Math.min(selected.length,10)} selected link${selected.length===1?'':'s'}`);return}
  if(action==='copy'){await navigator.clipboard?.writeText(selected.map(l=>l.url).join('\n'));$('status')&&($('status').textContent=`Copied ${selected.length} URLs`);return}
  if(action==='export'){downloadText(`linktracer-selected-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify({format:'linktracer-selected',version:1,exportedAt:new Date().toISOString(),links:selected},null,2));$('status')&&($('status').textContent=`Exported ${selected.length} selected links`);return}
  let dueAt=null;
  if(action==='followup'){
    const value=prompt('Follow-up date (YYYY-MM-DD, optional)','');
    if(value===null)return;
    if(value.trim()){const parsed=Date.parse(`${value.trim()}T23:59:59`);if(Number.isNaN(parsed)){ $('status')&&($('status').textContent='Invalid follow-up date');return } dueAt=parsed;}
  }
  if(action==='delete'&&!confirm(`Delete ${selected.length} selected link${selected.length===1?'':'s'}? This will queue deletions for sync.`))return;
  try{
    const count=await bulkMutate(action,selected,dueAt);
    state.selected.clear();
    $('status')&&($('status').textContent=`Bulk operation complete: ${count} link${count===1?'':'s'}`);
    await window.LinktracerApp?.refresh?.();
    closePanel();
  }catch(error){$('status')&&($('status').textContent=`Bulk operation failed: ${error.message||'unknown error'}`)}
}

document.addEventListener('change',e=>{
  const u=e.target.closest('[data-bulk-url]')?.dataset.bulkUrl;
  if(u){e.target.checked?state.selected.add(u):state.selected.delete(u);const count=document.querySelector('[data-bulk-count]');if(count)count.textContent=`${state.selected.size} selected`;}
});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-intel],[data-cmd],[data-bulk-action],[data-bulk-select],[data-save-search],[data-run-search],[data-delete-search],[data-dup-search],[data-intel-close]');if(!b)return;if(b.matches('[data-intel="command"]'))showCommand();else if(b.dataset.intel==='duplicates'||b.dataset.cmd==='duplicates')showDuplicates();else if(b.dataset.intel==='saved'||b.dataset.cmd==='saved')showSaved();else if(b.dataset.intel==='bulk'||b.dataset.cmd==='bulk')showBulk();else if(b.dataset.cmd==='search'){$('search')?.focus();closePanel()}else if(b.dataset.cmd==='clear'){$('clearSearch')?.click();closePanel()}else if(b.hasAttribute('data-intel-close'))closePanel();else if(b.hasAttribute('data-save-search')){const name=$('savedSearchName')?.value.trim(),query=$('savedSearchQuery')?.value.trim();if(name&&query){state.saved.push({name,query});saveSaved();showSaved()}}else if(b.hasAttribute('data-run-search')){$('search').value=state.saved[Number(b.dataset.runSearch)]?.query||'';$('search').dispatchEvent(new Event('input'));closePanel()}else if(b.hasAttribute('data-delete-search')){state.saved.splice(Number(b.dataset.deleteSearch),1);saveSaved();showSaved()}else if(b.hasAttribute('data-dup-search')){$('search').value=`${b.dataset.dupSearch||''} duplicate:true`;$('search').dispatchEvent(new Event('input'));closePanel()}else if(b.hasAttribute('data-bulk-select')){
    const visible=await visibleLinks();
    if(b.dataset.bulkSelect==='all')visible.forEach(l=>state.selected.add(l.canonicalUrl));
    if(b.dataset.bulkSelect==='clear')state.selected.clear();
    if(b.dataset.bulkSelect==='invert'){const keys=new Set(visible.map(l=>l.canonicalUrl));visible.forEach(l=>state.selected.has(l.canonicalUrl)?state.selected.delete(l.canonicalUrl):state.selected.add(l.canonicalUrl));for(const key of [...state.selected])if(!keys.has(key))state.selected.delete(key);}
    renderBulkList();
  }else if(b.hasAttribute('data-bulk-action'))await bulkAction(b.dataset.bulkAction)});
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();showCommand()}if(e.key==='Escape')closePanel()});
document.addEventListener('linktracer-rendered',()=>{layout();if(!$('intelPanel')?.hidden&&$('bulkList'))renderBulkList()});function init(){loadStyles();layout()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
