const TRIAGE_DB='linktracer-local';
const TRIAGE_DB_VERSION=6;
const TRIAGE_STATES=['inbox','kept','archived'];
const $=id=>document.getElementById(id);

function openDb(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(TRIAGE_DB,TRIAGE_DB_VERSION);
    r.onupgradeneeded=()=>{
      const db=r.result;
      if(!db.objectStoreNames.contains('links'))db.createObjectStore('links',{keyPath:'canonicalUrl'});
      if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'id',autoIncrement:true});
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      if(!db.objectStoreNames.contains('collections'))db.createObjectStore('collections',{keyPath:'id'});
    };
    r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>db.close();resolve(db)};
    r.onerror=()=>reject(r.error||new Error('Unable to open local database'));
  });
}
const dbp=typeof indexedDB!=='undefined'?(globalThis.LinktracerDbReady?globalThis.LinktracerDbReady.then(openDb):openDb()):null;
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transaction aborted'))})}
function deviceId(){return localStorage.getItem('linktracer-device')||crypto.randomUUID()}
function triageState(link){
  const value=link?.triage?.status||link?.sourceContext?.triage?.status;
  return TRIAGE_STATES.includes(value)?value:'inbox';
}
function sourceLabel(link){
  const source=link?.sourceContext?.captureSource||link?.sourceContext?.importSource;
  return {
    'whatsapp-chat':'WhatsApp',
    whatsapp:'WhatsApp',
    'share-target':'Share target',
    bookmarklet:'Bookmarklet',
    extension:'Extension',
    text:'Text import'
  }[source]||'Manual capture';
}
function nextInboxLink(links,currentUrl='',options={wrap:true}){
  const queue=[...(links||[])].filter(link=>triageState(link)==='inbox').sort((a,b)=>(b?.updatedAt||0)-(a?.updatedAt||0));
  if(!queue.length)return '';
  const currentIndex=queue.findIndex(link=>link?.canonicalUrl===currentUrl);
  if(currentIndex<0)return queue[0].canonicalUrl;
  const next=currentIndex+1<queue.length?queue[currentIndex+1]:options.wrap!==false?queue[0]:null;
  return next?.canonicalUrl||'';
}
function localLinkState(link,status){
  const processedAt=status==='inbox'?null:Date.now();
  return {
    ...link,
    triage:{...(link.triage||{}),status,processedAt},
    sourceContext:{...(link.sourceContext||{}),triage:{...(link.sourceContext?.triage||{}),status,processedAt}},
    updatedAt:Date.now()
  };
}
async function readLinks(){
  const db=await dbp;
  try{return await request(db.transaction('links','readonly').objectStore('links').getAll())}
  finally{db.close()}
}
async function persistTriage(canonicalUrl,status){
  if(!TRIAGE_STATES.includes(status))throw new Error('Invalid triage state');
  const db=await dbp;
  try{
    const transaction=db.transaction(['links','outbox'],'readwrite');
    const linksStore=transaction.objectStore('links');
    const current=await request(linksStore.get(canonicalUrl));
    if(!current){transaction.abort();throw new Error('Link not found')}
    const updated=localLinkState(current,status);
    linksStore.put(updated);
    transaction.objectStore('outbox').add({...updated,changeId:crypto.randomUUID(),deviceId:deviceId(),queuedAt:Date.now()});
    await txDone(transaction);
    return updated;
  }finally{db.close()}
}
async function deleteTriageLink(canonicalUrl){
  const db=await dbp;
  try{
    const transaction=db.transaction(['links','outbox'],'readwrite');
    const linksStore=transaction.objectStore('links');
    const current=await request(linksStore.get(canonicalUrl));
    if(!current){transaction.abort();throw new Error('Link not found')}
    linksStore.delete(canonicalUrl);
    transaction.objectStore('outbox').add({...current,deleted:true,changeId:crypto.randomUUID(),deviceId:deviceId(),queuedAt:Date.now()});
    await txDone(transaction);
  }finally{db.close()}
}
async function refreshAndContinue(currentUrl='',openNext=false){
  await window.LinktracerApp?.refresh?.();
  renderTriageBar();
  if(openNext)await processNext(currentUrl);
}
async function applyAction(action,canonicalUrl){
  if(!action||!canonicalUrl)return;
  try{
    if(action==='favorite'){
      await window.LinktracerSmartLibrary?.toggleFavorite?.(canonicalUrl);
      await window.LinktracerApp?.refresh?.();
    }else if(action==='followup'){
      await window.LinktracerSmartLibrary?.toggleFollowup?.(canonicalUrl);
      await window.LinktracerApp?.refresh?.();
    }else if(action==='preview'){
      const link=(await readLinks()).find(x=>x.canonicalUrl===canonicalUrl);
      window.LinktracerApp?.openReader?.(link);
    }else if(action==='keep'){
      await persistTriage(canonicalUrl,'kept');
      setStatus('Kept in your library');
      await refreshAndContinue(canonicalUrl,true);
    }else if(action==='archive'){
      await persistTriage(canonicalUrl,'archived');
      setStatus('Archived');
      await refreshAndContinue(canonicalUrl,true);
    }else if(action==='delete'){
      const link=(await readLinks()).find(x=>x.canonicalUrl===canonicalUrl);
      if(!link||!confirm(`Delete “${link.title||link.url}”? This can be synchronized as a deletion.`))return;
      await deleteTriageLink(canonicalUrl);
      setStatus('Deleted and queued for sync');
      await refreshAndContinue(canonicalUrl,true);
    }else if(action==='next'){
      await processNext(canonicalUrl);
    }
  }catch(error){
    setStatus(`Triage action failed: ${error.message||'unknown error'}`);
  }
}
function setStatus(message){const e=$('status');if(e)e.textContent=message}
async function processNext(currentUrl=''){
  const links=await readLinks();
  const next=nextInboxLink(links,currentUrl);
  if(next){const item=links.find(x=>x.canonicalUrl===next);window.LinktracerApp?.openReader?.(item);return}
  setStatus('Inbox is clear');
}
async function renderTriageBar(){
  const host=$('triageBar');
  if(!host)return;
  try{
    const links=await readLinks();
    const inbox=links.filter(link=>triageState(link)==='inbox').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    const label=inbox.length===1?'source':'sources';
    host.innerHTML=`<div class="triageBarMain"><div><span class="eyebrow">INBOX</span><strong>${inbox.length} unprocessed ${label}</strong><span class="hint">${inbox.length?'Review, keep, archive or delete without leaving the library.':'Nothing waiting for triage.'}</span></div><button type="button" class="primaryAction" data-triage-action="next" data-triage-url="">Process next</button></div>`;
  }catch{host.textContent=''}
}
function focusCards(direction=1){
  const cards=[...document.querySelectorAll('[data-triage-card][data-triage-state="inbox"]')];
  if(!cards.length)return;
  const active=document.activeElement?.closest?.('[data-triage-card]');
  let index=active?cards.indexOf(active):-1;
  index=(index+direction+cards.length)%cards.length;
  cards[index].focus({preventScroll:false});
}
function isTypingTarget(target){
  return target?.matches?.('input,textarea,select,[contenteditable="true"]')||target?.closest?.('dialog');
}
function wireKeyboard(){
  if(document.__linktracerTriageKeyboard)return;
  document.__linktracerTriageKeyboard=true;
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||isTypingTarget(event.target))return;
    if(event.key==='j'){event.preventDefault();focusCards(1)}
    else if(event.key==='k'){event.preventDefault();focusCards(-1)}
    else if(event.key==='Enter'){
      const card=document.activeElement?.closest?.('[data-triage-card]');
      if(card){event.preventDefault();applyAction('preview',card.dataset.url)}
    }else if(event.key==='a'){
      const card=document.activeElement?.closest?.('[data-triage-card]');
      if(card&&triageStateFromCard(card)==='inbox'){event.preventDefault();applyAction('archive',card.dataset.url)}
    }else if(event.key==='c'){
      const card=document.activeElement?.closest?.('[data-triage-card]');
      if(card&&triageStateFromCard(card)==='inbox'){event.preventDefault();applyAction('keep',card.dataset.url)}
    }
  });
}
function triageStateFromCard(card){return card?.dataset?.triageState||'inbox'}
function wireActions(){
  if(document.__linktracerTriageActions)return;
  document.__linktracerTriageActions=true;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-triage-action]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    const card=button.closest('[data-triage-card]');
    const url=button.dataset.triageUrl||card?.dataset?.url||'';
    applyAction(button.dataset.triageAction,url);
  });
}
function wireSwipes(){
  if(document.__linktracerTriageSwipes)return;
  document.__linktracerTriageSwipes=true;
  let start=null;
  document.addEventListener('touchstart',event=>{
    if(event.touches.length!==1)return;
    const card=event.target.closest?.('[data-triage-card]');
    if(!card||event.target.closest('button,a,input,textarea,select,details')){start=null;return}
    start={card,x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  document.addEventListener('touchend',event=>{
    if(!start||event.changedTouches.length!==1)return;
    const end=event.changedTouches[0],dx=end.clientX-start.x,dy=end.clientY-start.y,card=start.card;
    start=null;
    if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.25)return;
    applyAction(dx>0?'keep':'archive',card.dataset.url);
  },{passive:true});
}
function init(){
  wireActions();
  wireKeyboard();
  wireSwipes();
  document.addEventListener('linktracer-rendered',renderTriageBar);
  renderTriageBar();
}
const api={TRIAGE_STATES,triageState,sourceLabel,nextInboxLink,persistTriage,deleteTriageLink,processNext,renderTriageBar,applyAction};
if(typeof document!=='undefined'){
  window.LinktracerTriage=api;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
}
export { TRIAGE_STATES, triageState, sourceLabel, nextInboxLink, persistTriage, deleteTriageLink, processNext };
