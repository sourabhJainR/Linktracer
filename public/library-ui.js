const LAYOUT_KEY='linktracer-layout';
const DEFAULT_LAYOUT='grid';

function layoutValue(){return localStorage.getItem(LAYOUT_KEY)||DEFAULT_LAYOUT}
function setLayout(layout){const value=layout==='list'?'list':'grid';localStorage.setItem(LAYOUT_KEY,value);applyLayout(value);return value}
function applyLayout(layout=layoutValue()){
  const target=document.getElementById('links');
  if(!target)return;
  target.classList.toggle('libraryList',layout==='list');
  target.dataset.layout=layout;
  document.querySelectorAll('[data-library-layout]').forEach(button=>{
    const active=button.dataset.libraryLayout===layout;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function focusLibrary(){
  const library=document.querySelector('.librarySection');
  if(!library)return;
  library.setAttribute('tabindex','-1');
  library.scrollIntoView({behavior:'smooth',block:'start'});
  window.setTimeout(()=>library.focus({preventScroll:true}),220);
  const links=document.getElementById('links');
  if(links){links.classList.remove('libraryFocusPulse');void links.offsetWidth;links.classList.add('libraryFocusPulse');}
}
function collapseInputWorkspace(source){
  const active=source?.closest?.('.smartPanel, .inputWorkspace');
  const panels=[...document.querySelectorAll('.smartPanel.smartPanelOpen, .inputWorkspace.isOpen')];
  if(active&&!panels.includes(active))panels.push(active);
  panels.forEach(panel=>panel.classList.remove('smartPanelOpen','isOpen'));
}
function focusAfterImport(source){
  collapseInputWorkspace(source);
  window.setTimeout(focusLibrary,80);
}
function wireLayoutToggle(){
  const header=document.querySelector('.libraryHeader');
  if(!header||document.getElementById('libraryLayoutToggle'))return;
  const toggle=document.createElement('div');
  toggle.id='libraryLayoutToggle';
  toggle.className='layoutToggle';
  toggle.setAttribute('role','group');
  toggle.setAttribute('aria-label','Link display layout');
  toggle.innerHTML='<button type="button" class="subtle" data-library-layout="list" aria-label="Show links as a list" title="List view">List</button><button type="button" class="subtle" data-library-layout="grid" aria-label="Show links as cards in a grid" title="Grid view">Grid</button>';
  header.appendChild(toggle);
  toggle.addEventListener('click',event=>{
    const button=event.target.closest('[data-library-layout]');
    if(button)setLayout(button.dataset.libraryLayout);
  });
  applyLayout();
}
function wireImportFocus(){
  const capture=document.getElementById('captureForm');
  if(capture?.onsubmit&&!capture.onsubmit.__focusWrapped){
    const previous=capture.onsubmit;
    const wrapped=async function(event){
      try{await previous.call(this,event);if(document.getElementById('url')?.value==='')focusAfterImport(this)}catch(error){throw error}}
    wrapped.__focusWrapped=true;
    capture.onsubmit=wrapped;
  }
  const whatsapp=document.getElementById('whatsappImportBtn');
  if(whatsapp?.onclick&&!whatsapp.onclick.__focusWrapped){
    const previous=whatsapp.onclick;
    const wrapped=async function(event){
      const before=document.getElementById('whatsappBulkPreview')?.textContent||'';
      try{await previous.call(this,event);const after=document.getElementById('whatsappBulkPreview')?.textContent||'';if(/Imported \d+ new links/i.test(after)&&after!==before)focusAfterImport(this)}catch(error){throw error}}
    wrapped.__focusWrapped=true;
    whatsapp.onclick=wrapped;
  }
  const file=document.getElementById('importFile');
  if(file?.onchange&&!file.onchange.__focusWrapped){
    const previous=file.onchange;
    const wrapped=async function(event){
      try{await previous.call(this,event);const status=document.getElementById('status')?.textContent||'';if(/^Imported /i.test(status))focusAfterImport(this)}catch(error){throw error}}
    wrapped.__focusWrapped=true;
    file.onchange=wrapped;
  }
}
function loadStyles(){
  if(document.getElementById('libraryUiStyles'))return;
  const style=document.createElement('style');
  style.id='libraryUiStyles';
  style.textContent=`
.layoutToggle{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:10px;background:rgba(255,255,255,.88);box-shadow:0 2px 8px rgba(15,23,42,.04)}
.layoutToggle button{min-height:30px;padding:5px 10px;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:11px;font-weight:700}
.layoutToggle button.active{background:var(--brand-soft);color:#4338ca}
#links.libraryList{display:grid;grid-template-columns:1fr;gap:8px}
#links.libraryList .link{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"main actions" "description actions" "badges actions" "tags actions";align-items:center;column-gap:18px;padding:12px 15px!important}
#links.libraryList .linkTop{grid-area:main;min-width:0}
#links.libraryList .linkTop .linkHead{min-width:0}
#links.libraryList .link>p{grid-area:description;margin:2px 0 0;max-width:75ch;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#links.libraryList .badges{grid-area:badges;margin-top:2px}
#links.libraryList .tags{grid-area:tags;margin-top:1px}
#links.libraryList .linkActions{grid-area:actions;align-self:center;display:flex;flex-direction:column;gap:8px;min-width:190px}
#links.libraryList .linkActions>div{display:flex;justify-content:flex-end;gap:4px}
#links.libraryList .linkActions small{text-align:right}
.libraryFocusPulse{animation:libraryFocusPulse .7s ease-out}
@keyframes libraryFocusPulse{0%{box-shadow:0 0 0 0 rgba(99,102,241,.24)}100%{box-shadow:0 0 0 14px rgba(99,102,241,0)}}
@media(max-width:700px){.libraryHeader{align-items:center}.layoutToggle button{padding-inline:8px}#links.libraryList .link{grid-template-columns:1fr;grid-template-areas:"main" "description" "badges" "tags" "actions"}#links.libraryList .linkActions{min-width:0;flex-direction:row;align-items:center;justify-content:space-between}#links.libraryList .linkActions>div{justify-content:flex-end}}
`;
  document.head.appendChild(style);
}
function init(){
  loadStyles();
  wireLayoutToggle();
  wireImportFocus();
  document.addEventListener('linktracer-rendered',()=>applyLayout(),{passive:true});
  const observer=new MutationObserver(()=>wireImportFocus());
  observer.observe(document.body,{childList:true,subtree:true});
}
export {applyLayout,collapseInputWorkspace,focusLibrary,focusAfterImport,setLayout};
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
}
