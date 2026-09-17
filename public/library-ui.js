const LAYOUT_KEY='linktracer-layout';
const VIEW_KEY='linktracer-library-view';
const DEFAULT_LAYOUT='grid';
const DEFAULT_VIEW='all';

function layoutValue(){return localStorage.getItem(LAYOUT_KEY)||DEFAULT_LAYOUT}
function viewValue(){const value=localStorage.getItem(VIEW_KEY);return ['all','recent','favorites','followups'].includes(value)?value:DEFAULT_VIEW}
function setLayout(layout){const value=layout==='list'?'list':'grid';localStorage.setItem(LAYOUT_KEY,value);applyLayout(value);return value}
function setLibraryView(view){const value=['all','recent','favorites','followups'].includes(view)?view:DEFAULT_VIEW;localStorage.setItem(VIEW_KEY,value);applyLibraryView(value);return value}
function applyLayout(layout=layoutValue()){
  const target=document.getElementById('links');
  if(!target)return;
  target.classList.toggle('libraryList',layout==='list');
  target.classList.toggle('libraryGrid',layout==='grid');
  target.dataset.layout=layout;
  document.querySelectorAll('[data-library-layout]').forEach(button=>{
    const active=button.dataset.libraryLayout===layout;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}
function applyLibraryView(view=viewValue()){
  const value=['all','recent','favorites','followups'].includes(view)?view:DEFAULT_VIEW;
  const smart=document.getElementById('smartLibrary');
  const links=document.getElementById('links');
  if(smart)smart.hidden=value==='all';
  if(links)links.hidden=value!=='all';
  document.querySelectorAll('[data-library-view]').forEach(button=>{
    const active=button.dataset.libraryView===value;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',String(active));
    button.tabIndex=active?0:-1;
  });
  if(smart){
    document.querySelectorAll('[data-smart-section]').forEach(section=>{
      section.hidden=value!=='all'&&section.dataset.smartSection!==value;
    });
  }
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
function focusAfterImport(source){collapseInputWorkspace(source);window.setTimeout(focusLibrary,80)}
function wireLibraryControls(){
  const header=document.querySelector('.libraryHeader');
  if(!header)return;
  if(!document.getElementById('libraryViewTabs')){
    const views=document.createElement('div');
    views.id='libraryViewTabs';
    views.className='libraryViewTabs';
    views.setAttribute('role','tablist');
    views.setAttribute('aria-label','Library view');
    views.innerHTML='<button type="button" role="tab" data-library-view="all" aria-label="Show all saved links">All links</button><button type="button" role="tab" data-library-view="recent" aria-label="Show recently added links">Recent</button><button type="button" role="tab" data-library-view="favorites" aria-label="Show favorite links">Favorites</button><button type="button" role="tab" data-library-view="followups" aria-label="Show links needing follow-up">Follow-up</button>';
    header.appendChild(views);
    views.addEventListener('click',event=>{const button=event.target.closest('[data-library-view]');if(button)setLibraryView(button.dataset.libraryView)});
  }
  if(!document.getElementById('libraryLayoutToggle')){
    const toggle=document.createElement('div');
    toggle.id='libraryLayoutToggle';
    toggle.className='layoutToggle';
    toggle.setAttribute('role','group');
    toggle.setAttribute('aria-label','Link display layout');
    toggle.innerHTML='<button type="button" class="subtle" data-library-layout="list" aria-label="Show links as a list" title="List view"><span aria-hidden="true">☰</span> List</button><button type="button" class="subtle" data-library-layout="grid" aria-label="Show links as cards in a grid" title="Grid view"><span aria-hidden="true">▦</span> Grid</button>';
    header.appendChild(toggle);
    toggle.addEventListener('click',event=>{const button=event.target.closest('[data-library-layout]');if(button)setLayout(button.dataset.libraryLayout)});
  }
  applyLibraryView();
  applyLayout();
}
function wireImportFocus(){
  const capture=document.getElementById('captureForm');
  if(capture?.onsubmit&&!capture.onsubmit.__focusWrapped){
    const previous=capture.onsubmit;
    const wrapped=async function(event){try{await previous.call(this,event);if(document.getElementById('url')?.value==='')focusAfterImport(this)}catch(error){throw error}};
    wrapped.__focusWrapped=true;capture.onsubmit=wrapped;
  }
  const whatsapp=document.getElementById('whatsappImportBtn');
  if(whatsapp?.onclick&&!whatsapp.onclick.__focusWrapped){
    const previous=whatsapp.onclick;
    const wrapped=async function(event){const before=document.getElementById('whatsappBulkPreview')?.textContent||'';try{await previous.call(this,event);const after=document.getElementById('whatsappBulkPreview')?.textContent||'';if(/Imported \d+ new links/i.test(after)&&after!==before)focusAfterImport(this)}catch(error){throw error}};
    wrapped.__focusWrapped=true;whatsapp.onclick=wrapped;
  }
  const file=document.getElementById('importFile');
  if(file?.onchange&&!file.onchange.__focusWrapped){
    const previous=file.onchange;
    const wrapped=async function(event){try{await previous.call(this,event);const status=document.getElementById('status')?.textContent||'';if(/^Imported /i.test(status))focusAfterImport(this)}catch(error){throw error}};
    wrapped.__focusWrapped=true;file.onchange=wrapped;
  }
}
function loadStyles(){
  if(document.getElementById('libraryUiStyles'))return;
  const style=document.createElement('style');style.id='libraryUiStyles';style.textContent=`
.libraryHeader{display:grid;grid-template-columns:minmax(180px,1fr) auto auto;align-items:center;gap:12px}
.libraryViewTabs{display:flex;gap:3px;padding:3px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:11px;overflow:auto}
.libraryViewTabs button{border:0;border-radius:8px;background:transparent;color:#64748b;min-height:32px;padding:6px 11px;font-size:11px;font-weight:750;white-space:nowrap;box-shadow:none}
.libraryViewTabs button:hover{background:#e2e8f0;transform:none;box-shadow:none}
.libraryViewTabs button.active{background:#fff;color:#1e40af;box-shadow:0 2px 7px rgba(15,23,42,.10)}
.libraryViewTabs button:focus-visible{outline:2px solid #60a5fa;outline-offset:-2px}
.layoutToggle{display:flex;gap:3px;padding:3px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;box-shadow:0 2px 8px rgba(15,23,42,.04)}
.layoutToggle button{min-height:32px;padding:6px 10px;border:0;border-radius:8px;background:transparent;color:#64748b;font-size:11px;font-weight:750;box-shadow:none}
.layoutToggle button:hover{background:#f1f5f9;transform:none;box-shadow:none}
.layoutToggle button.active{background:#172033;color:#fff;box-shadow:0 2px 7px rgba(15,23,42,.14)}
.libraryGrid{grid-template-columns:repeat(auto-fill,minmax(310px,1fr))!important;align-items:stretch}
#links.libraryGrid .link{min-width:0}
#links.libraryList{grid-template-columns:1fr!important;gap:8px!important}
#links.libraryList .link{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"main actions" "description actions" "badges actions" "tags actions";align-items:center;column-gap:18px;padding:12px 15px!important;min-height:108px}
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
@media(max-width:900px){.libraryHeader{grid-template-columns:1fr auto}.libraryViewTabs{grid-column:1/-1;grid-row:2}.layoutToggle{grid-column:2;grid-row:1}}
@media(max-width:700px){.libraryHeader{align-items:center}.layoutToggle button{padding-inline:8px}.libraryViewTabs{width:100%}#links.libraryList .link{grid-template-columns:1fr;grid-template-areas:"main" "description" "badges" "tags" "actions"}#links.libraryList .linkActions{min-width:0;flex-direction:row;align-items:center;justify-content:space-between}#links.libraryList .linkActions>div{justify-content:flex-end}}
`;
  document.head.appendChild(style);
}
function init(){
  loadStyles();wireLibraryControls();wireImportFocus();
  document.addEventListener('linktracer-rendered',()=>{wireLibraryControls();applyLayout();applyLibraryView()},{passive:true});
  const observer=new MutationObserver(()=>{wireImportFocus();applyLibraryView()});observer.observe(document.body,{childList:true,subtree:true});
}
export {applyLayout,applyLibraryView,collapseInputWorkspace,focusLibrary,focusAfterImport,setLayout,setLibraryView};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init()}
