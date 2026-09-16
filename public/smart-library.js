const SMART_DB='linktracer-local';
const SMART_DB_VERSION=6;

export function isConfirmed404(health){
  return Number(health?.status)===404 && health?.healthy===false;
}

export function partitionLinks(items){
  const all=[...(items||[])].sort((a,b)=>(b?.updatedAt||0)-(a?.updatedAt||0));
  return {
    recent: all.slice(0,6),
    favorites: all.filter(link=>link?.favorite===true).sort((a,b)=>(b?.updatedAt||0)-(a?.updatedAt||0)),
    followUps: all.filter(link=>link?.followUp?.enabled===true).sort((a,b)=>(a?.followUp?.dueAt||Number.MAX_SAFE_INTEGER)-(b?.followUp?.dueAt||Number.MAX_SAFE_INTEGER)),
    all
  };
}

const $=id=>document.getElementById(id);
const smartId=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(SMART_DB,SMART_DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('links'))db.createObjectStore('links',{keyPath:'canonicalUrl'});
      if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      if(!db.objectStoreNames.contains('collections'))db.createObjectStore('collections',{keyPath:'id'});
    };
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db)};
    request.onerror=()=>reject(request.error||new Error('Unable to open local database'));
  });
}

async function readLinks(){
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{const request=db.transaction('links','readonly').objectStore('links').getAll();request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)})}
  finally{db.close()}
}

async function writeLink(link){
  const db=await openDb();
  try{
    await new Promise((resolve,reject)=>{const request=db.transaction('links','readwrite').objectStore('links').put(link);request.onsuccess=resolve;request.onerror=()=>reject(request.error)});
    await new Promise((resolve,reject)=>{const request=db.transaction('outbox','readwrite').objectStore('outbox').add({...link,changeId:smartId(),deviceId:localStorage.getItem('linktracer-device')||smartId(),queuedAt:Date.now()});request.onsuccess=resolve;request.onerror=()=>reject(request.error)});
  }finally{db.close()}
}

async function deleteLink(canonicalUrl,reason='confirmed-404'){
  const db=await openDb();
  try{
    await new Promise((resolve,reject)=>{const request=db.transaction('links','readwrite').objectStore('links').delete(canonicalUrl);request.onsuccess=resolve;request.onerror=()=>reject(request.error)});
    await new Promise((resolve,reject)=>{const request=db.transaction('outbox','readwrite').objectStore('outbox').add({entityType:'link',canonicalUrl,deleted:true,sourceContext:{removedReason:reason,removedAt:Date.now()},changeId:smartId(),deviceId:localStorage.getItem('linktracer-device')||smartId(),queuedAt:Date.now()});request.onsuccess=resolve;request.onerror=()=>reject(request.error)});
  }finally{db.close()}
}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function host(url){try{return new URL(url).hostname.replace(/^www\./,'')}catch{return''}}
function formatDue(value){if(!value)return'No due date';const d=new Date(value);return Number.isNaN(d.getTime())?'No due date':`Due ${d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}`}
function smartCard(link,kind){
  const label=kind==='favorite'?'Favorite':kind==='followup'?formatDue(link.followUp?.dueAt):'New';
  return `<article class="smartLinkCard" data-smart-url="${escapeHtml(link.canonicalUrl)}"><div class="smartLinkMain"><span class="smartLabel">${escapeHtml(label)}</span><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.title||link.url)}</a><small>${escapeHtml(link.sourceContext?.site||host(link.url))}</small></div><div class="smartLinkActions"><button type="button" data-smart-action="favorite" aria-label="${link.favorite?'Remove from favorites':'Add to favorites'}">${link.favorite?'★':'☆'}</button><button type="button" data-smart-action="followup" aria-label="${link.followUp?.enabled?'Remove follow-up':'Add follow-up'}">${link.followUp?.enabled?'Follow-up':'Follow up'}</button><button type="button" data-smart-action="reader">Open</button></div></article>`;
}

function section(title,sectionName,items,kind,empty){
  if(!items.length)return `<section class="smartSection smartSectionEmpty" data-smart-section="${sectionName}"><div class="smartSectionHeader"><div><span class="eyebrow">${title==='Recently added'?'RECENT':'YOUR LIST'}</span><h3>${title}</h3></div></div><p>${empty}</p></section>`;
  return `<section class="smartSection" data-smart-section="${sectionName}"><div class="smartSectionHeader"><div><span class="eyebrow">${title==='Recently added'?'RECENT':title==='Favorites'?'PINNED':'FOLLOW-UP'}</span><h3>${title}</h3></div><span class="smartCount">${items.length}</span></div><div class="smartLinks">${items.map(x=>smartCard(x,kind)).join('')}</div></section>`;
}

function renderSmart(links){
  const library=document.querySelector('.librarySection');
  if(!library)return;
  let hostEl=$('smartLibrary');
  if(!hostEl){hostEl=document.createElement('div');hostEl.id='smartLibrary';library.insertBefore(hostEl,library.querySelector('.toolbar'));}
  const {recent,favorites,followUps}=partitionLinks(links);
  hostEl.innerHTML=[
    section('Recently added','recent',recent,'recent','New links will appear here as you save or import them.'),
    section('Favorites','favorites',favorites,'favorite','Star a link to keep it easy to find.'),
    section('Follow-up','followups',followUps,'followup','Add a follow-up when a source needs another look.')
  ].join('');
}

async function refreshSmart(){
  try{renderSmart(await readLinks())}catch(error){console.warn('Smart library refresh failed',error)}
}

async function updateSmartLink(canonicalUrl,patch){
  const links=await readLinks(),current=links.find(x=>x.canonicalUrl===canonicalUrl);
  if(!current)return;
  const updated={...current,...patch,updatedAt:Date.now()};
  await writeLink(updated);
  await refreshSmart();
  window.LinktracerIO?.sync?.();
}

async function toggleFavorite(url){
  const links=await readLinks(),current=links.find(x=>x.canonicalUrl===url);if(!current)return;
  await updateSmartLink(url,{favorite:!current.favorite});
}

async function toggleFollowup(url){
  const links=await readLinks(),current=links.find(x=>x.canonicalUrl===url);if(!current)return;
  const enabled=!current.followUp?.enabled;
  let dueAt=current.followUp?.dueAt||null;
  if(enabled){const value=prompt('Follow-up date (YYYY-MM-DD, optional)',dueAt?new Date(dueAt).toISOString().slice(0,10):'');if(value?.trim()){const parsed=Date.parse(`${value.trim()}T23:59:59`);if(!Number.isNaN(parsed))dueAt=parsed}else if(value!==null&&value.trim()!=='')return;}
  await updateSmartLink(url,{followUp:{...(current.followUp||{}),enabled,dueAt}});
}

async function cleanup404(url){
  await deleteLink(url,'confirmed-404');
  await refreshSmart();
  document.querySelector(`.link[data-url="${CSS.escape(url)}"]`)?.remove();
  const count=document.querySelector('#count');if(count){const links=await readLinks();count.textContent=`${links.length} link${links.length===1?'':'s'}`}
  window.LinktracerIO?.sync?.();
}

function togglePanel(id){
  const panel=$(id),capture=$('captureWorkspace'),whatsapp=$('whatsappWorkspace');
  if(!panel)return;
  for(const other of [capture,whatsapp])if(other&&other!==panel)other.classList.remove('smartPanelOpen');
  panel.classList.toggle('smartPanelOpen');
  if(panel.classList.contains('smartPanelOpen'))panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function wirePanels(){
  $('captureWorkspaceToggle')?.addEventListener('click',()=>togglePanel('captureWorkspace'));
  $('whatsappWorkspaceToggle')?.addEventListener('click',()=>togglePanel('whatsappWorkspace'));
}

function wireSmartActions(){
  document.addEventListener('click',async event=>{
    const button=event.target.closest('[data-smart-action]');
    if(button){
      const card=button.closest('[data-smart-url]');if(!card)return;
      const url=card.dataset.smartUrl;
      try{
        if(button.dataset.smartAction==='favorite')await toggleFavorite(url);
        if(button.dataset.smartAction==='followup')await toggleFollowup(url);
        if(button.dataset.smartAction==='reader')document.querySelector(`.link[data-url="${CSS.escape(url)}"] [data-action="reader"]`)?.click();
      }catch(error){$('status')&&( $('status').textContent=`Smart action failed: ${error.message}`)}
      return;
    }
  });

  document.addEventListener('linktracer-rendered',refreshSmart);
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action="health"]');
    if(!button)return;
    const url=button.dataset.url;
    const check=async()=>{
      for(let attempt=0;attempt<40;attempt++){
        await new Promise(resolve=>setTimeout(resolve,150));
        const current=(await readLinks()).find(x=>x.canonicalUrl===url);
        if(current?.sourceContext?.health){
          if(isConfirmed404(current.sourceContext.health))await cleanup404(url);
          return;
        }
      }
    };
    check().catch(()=>{});
  },true);
}

function init(){
  const capture=$('captureWorkspace'),whatsapp=$('whatsappWorkspace');
  if(capture)capture.classList.remove('smartPanelOpen');
  if(whatsapp)whatsapp.classList.remove('smartPanelOpen');
  wirePanels();
  wireSmartActions();
  refreshSmart();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
window.LinktracerSmartLibrary={refresh:refreshSmart,isConfirmed404,partitionLinks};
