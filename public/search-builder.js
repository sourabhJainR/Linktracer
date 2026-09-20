const MANAGED_KEYS=['tag','type','domain','health','duplicate','triage','before','after'];
const $=id=>document.getElementById(id);
const tokenRx=/(?:[^\s"]+|"[^"]*")+/g;
function tokens(value){return String(value||'').match(tokenRx)||[]}
function managed(token){const i=token.indexOf(':');return i>0&&MANAGED_KEYS.includes(token.slice(0,i).toLowerCase())}
function parts(){return tokens($('search')?.value||'').map(token=>token.replace(/^"|"$/g,''))}
function setSearch(value){const input=$('search');if(!input)return;input.value=value.trim();input.dispatchEvent(new Event('input',{bubbles:true}))}
function managedTokens(){return tokens($('search')?.value||'').filter(managed)}
function syncFields(){
  const values={tags:[],domain:'',type:'',health:'',duplicate:'',triage:'',after:'',before:''};
  for(const token of managedTokens()){
    const i=token.indexOf(':'),k=token.slice(0,i).toLowerCase(),v=token.slice(i+1).replace(/^"|"$/g,'');
    if(k==='tag')values.tags.push(v);else if(k==='domain')values.domain=v;else if(k in values)values[k]=v;
  }
  if($('filterTags'))$('filterTags').value=values.tags.join(', ');
  if($('filterDomain'))$('filterDomain').value=values.domain;
  for(const id of ['type','health','duplicate','triage','after','before'])if($(('filter'+id[0].toUpperCase()+id.slice(1))))$(('filter'+id[0].toUpperCase()+id.slice(1))).value=values[id];
}
function buildTokens(){
  const keep=tokens($('search')?.value||'').filter(token=>!managed(token));
  const tags=String($('filterTags')?.value||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean).map(v=>`tag:${v}`);
  const domain=String($('filterDomain')?.value||'').trim().toLowerCase();
  const type=$('filterType')?.value||'',health=$('filterHealth')?.value||'',duplicate=$('filterDuplicate')?.value||'',triage=$('filterTriage')?.value||'',after=$('filterAfter')?.value||'',before=$('filterBefore')?.value||'';
  return [...keep,...tags,domain?`domain:${domain}`:[],type?`type:${type}`:[],health?`health:${health}`:[],duplicate?`duplicate:${duplicate}`:[],triage?`triage:${triage}`:[],after?`after:${after}`:[],before?`before:${before}`:[]].flat().join(' ');
}
function renderChips(){
  const host=$('activeFilters');if(!host)return;
  const chips=managedTokens();
  host.innerHTML=chips.map((token,i)=>`<button type="button" class="filterChip" data-filter-chip="${i}" title="Remove ${token}">${token}<span aria-hidden="true">×</span></button>`).join('');
  host.hidden=!chips.length;
}
function removeFilter(index){const next=tokens($('search')?.value||'').filter((token,i)=>!(managed(token)&&managedTokens().indexOf(token)===index));setSearch(next.join(' '));syncFields()}
function apply(){setSearch(buildTokens());syncFields();renderChips();close()}
function clear(){setSearch(tokens($('search')?.value||'').filter(token=>!managed(token)).join(' '));syncFields();renderChips()}
function close(){const panel=$('filterBuilder'),button=$('filterBuilderBtn');if(panel)panel.hidden=true;if(button)button.setAttribute('aria-expanded','false')}
function toggle(){const panel=$('filterBuilder'),button=$('filterBuilderBtn');if(!panel)return;const open=panel.hidden;panel.hidden=!open;if(button)button.setAttribute('aria-expanded',String(open));if(open)syncFields()}
function init(){
  if(!$('filterBuilderBtn'))return;
  $('filterBuilderBtn').addEventListener('click',toggle);
  $('applyFilters').addEventListener('click',apply);
  $('clearFilters').addEventListener('click',clear);
  $('search').addEventListener('input',renderChips);
  $('activeFilters').addEventListener('click',e=>{const chip=e.target.closest('[data-filter-chip]');if(chip)removeFilter(Number(chip.dataset.filterChip))});
  document.addEventListener('click',e=>{const panel=$('filterBuilder');if(panel?.hidden||e.target.closest('#filterBuilder')||e.target.closest('#filterBuilderBtn'))return;close()});
  renderChips();syncFields();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
export { MANAGED_KEYS, tokens, managed };
