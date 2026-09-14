import { buildEvidenceModel } from '/confidence-engine.js';

const DB='linktracer-local';
const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB,3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const all=()=>open().then(db=>new Promise((resolve,reject)=>{const r=db.transaction('links').objectStore('links').getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)}));
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const badge=v=>`<span class="confidenceBadge ${String(v).toLowerCase().replace(/[^a-z]+/g,'-')}">${esc(v)}</span>`;

function render(model){
  const root=document.getElementById('researchConfidence');
  if(!root)return;
  const claims=[...model.checklist].filter(x=>x.classification!=='Well Supported').sort((a,b)=>a.quality-b.quality).slice(0,8);
  const topics=[...model.topics].sort((a,b)=>a.readiness==='Decision Ready'?1:-1 || a.avgEvidence-b.avgEvidence).slice(0,8);
  root.innerHTML=`<style>
  .confidenceSummary{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.confidenceSummary span{font-size:11px;padding:5px 8px;border-radius:999px;background:#f1f5f9;color:#475569}.confidenceGrid{display:grid;grid-template-columns:1.15fr .85fr;gap:12px}.confidenceGrid section{border:1px solid #e2e8f0;border-radius:10px;padding:12px;background:#fff}.confidenceGrid h3{font-size:14px;margin:0 0 9px}.confidenceRow{padding:9px 0;border-top:1px solid #f1f5f9}.confidenceRow:first-of-type{border-top:0}.confidenceHead{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.confidenceHead b{font-size:12px;line-height:1.35}.confidenceMeta{font-size:10px;color:#64748b;margin-top:4px}.confidenceBadge{font-size:9px;padding:3px 6px;border-radius:999px;background:#f1f5f9;color:#475569;white-space:nowrap}.confidenceBadge.conflicted{background:#fee2e2;color:#991b1b}.confidenceBadge.weak{background:#ffedd5;color:#9a3412}.confidenceBadge.needs-independent-evidence{background:#fef3c7;color:#92400e}.confidenceBadge.well-supported,.confidenceBadge.decision-ready{background:#dcfce7;color:#166534}.confidenceBadge.review{background:#e0f2fe;color:#075985}.confidenceBadge.research-needed{background:#fef3c7;color:#92400e}.confidenceActions{margin:6px 0 0 16px;padding:0}.confidenceActions li{font-size:10px;color:#475569;margin:3px 0}.confidenceFooter{margin-top:10px;font-size:11px;color:#64748b}@media(max-width:760px){.confidenceGrid{grid-template-columns:1fr}}
  </style>
  <div class="confidenceSummary"><span>${model.counts.wellSupported} well supported</span><span>${model.counts.needsIndependent} need independent evidence</span><span>${model.counts.conflicted} conflicted</span><span>${model.counts.weak} weak</span><span>${model.counts.decisionReadyTopics} decision-ready topics</span><span>${model.counts.researchNeededTopics} research-needed topics</span></div>
  <div class="confidenceGrid">
    <section><h3>Research Confidence</h3>${claims.map(x=>`<div class="confidenceRow"><div class="confidenceHead"><b>${esc(x.text)}</b>${badge(x.classification)}</div><div class="confidenceMeta">${x.quality}/100 confidence · ${x.sourceCount} source${x.sourceCount===1?'':'s'} · ${x.domainCount} domain${x.domainCount===1?'':'s'} · ${x.supportCount} support · ${x.contradictCount} contradict</div>${x.actions.length?`<ul class="confidenceActions">${x.actions.map(a=>`<li>${esc(a)}</li>`).join('')}</ul>`:''}</div>`).join('')||'<p class="muted">No claims need attention. Your explicit evidence graph is currently strong.</p>'}</section>
    <section><h3>Decision Readiness</h3>${topics.map(x=>`<div class="confidenceRow"><div class="confidenceHead"><b>${esc(x.tag)}</b>${badge(x.readiness)}</div><div class="confidenceMeta">${x.avgEvidence}/100 average evidence · ${x.sourceCount} sources · ${x.domainCount} domains · ${x.claimCount} tracked claims${x.conflictCount?` · ${x.conflictCount} conflict${x.conflictCount===1?'':'s'}`:''}</div></div>`).join('')||'<p class="muted">Add tags to saved sources to build decision-readiness signals.</p>'}</section>
  </div><div class="confidenceFooter">Decision Ready requires strong source context, multiple saved sources, independent hostnames and no unresolved claim conflict. Signals are deterministic and local; they are research readiness indicators, not factual certainty or advice.</div>`;
}

window.addEventListener('load',()=>{const run=()=>all().then(links=>render(buildEvidenceModel(links))).catch(()=>{});run();setInterval(run,15000)});
