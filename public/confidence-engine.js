const normalizeClaim = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const hostname = value => { try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const evidenceScore = link => { const c = link?.sourceContext || {}; return Math.min(100, 20 + (c.excerpt ? 20 : 0) + (c.enrichedAt ? 10 : 0) + (c.status >= 200 && c.status < 400 ? 10 : 0) + ((link.tags || []).length >= 2 ? 10 : 0) + ((c.highlights || []).length ? 15 : 0) + ((c.annotations || []).length ? 15 : 0)); };
const claimsFor = link => Array.isArray(link?.sourceContext?.claims) ? link.sourceContext.claims : [];
const relationsFor = link => Array.isArray(link?.sourceContext?.evidenceRelations) ? link.sourceContext.evidenceRelations : [];

function buildEvidenceModel(links) {
  const byUrl = new Map(links.map(link => [link.canonicalUrl, link]));
  const claims = new Map(); const topics = new Map();
  for (const link of links) {
    const domain = hostname(link.url);
    for (const tag of (link.tags || [])) {
      const key = String(tag).trim().toLowerCase(); if (!key) continue;
      const topic = topics.get(key) || { tag:key, sources:new Set(), domains:new Set(), scores:[], claimKeys:new Set() };
      topic.sources.add(link.canonicalUrl); if (domain) topic.domains.add(domain); topic.scores.push(evidenceScore(link));
      for (const claim of claimsFor(link)) { const claimKey=normalizeClaim(claim.text); if (claimKey) topic.claimKeys.add(claimKey); }
      topics.set(key, topic);
    }
    for (const claim of claimsFor(link)) {
      const key=normalizeClaim(claim.text); if (!key) continue;
      const item=claims.get(key)||{key,text:claim.text,sources:new Set(),domains:new Set(),supports:new Set(),contradicts:new Set(),sourceLinks:new Set()};
      item.sources.add(link.canonicalUrl); item.sourceLinks.add(link.canonicalUrl); if (domain) item.domains.add(domain);
      for (const relation of relationsFor(link).filter(r=>r.claimId===claim.id)) {
        const target=byUrl.get(relation.targetCanonicalUrl); if (!target) continue;
        item.sources.add(target.canonicalUrl); const targetDomain=hostname(target.url); if (targetDomain) item.domains.add(targetDomain);
        if (relation.type==='supports') item.supports.add(target.canonicalUrl); if (relation.type==='contradicts') item.contradicts.add(target.canonicalUrl);
      }
      claims.set(key,item);
    }
  }
  const claimRows=[...claims.values()].map(item=>{
    const sourceCount=item.sources.size, domainCount=item.domains.size, conflict=item.supports.size>0&&item.contradicts.size>0, explicitEvidence=item.supports.size+item.contradicts.size;
    const quality=Math.max(0,Math.min(100,20+Math.min(30,sourceCount*15)+Math.min(25,domainCount*12)+Math.min(25,explicitEvidence*10)-(conflict?20:0)));
    let classification='Developing';
    if(conflict) classification='Conflicted';
    else if(quality>=75&&sourceCount>=2&&domainCount>=2) classification='Well Supported';
    else if(domainCount<2) classification='Needs Independent Evidence';
    else if(quality<50) classification='Weak';
    return {key:item.key,text:item.text,sourceCount,domainCount,supportCount:item.supports.size,contradictCount:item.contradicts.size,quality,classification,conflict,sourceLinks:[...item.sourceLinks]};
  });
  const topicRows=[...topics.values()].map(item=>{
    const avgEvidence=Math.round(item.scores.reduce((a,b)=>a+b,0)/Math.max(1,item.scores.length));
    const relatedClaims=claimRows.filter(claim=>item.claimKeys.has(claim.key)); const conflictCount=relatedClaims.filter(claim=>claim.conflict).length; const weakCount=relatedClaims.filter(claim=>claim.classification==='Weak').length;
    let readiness='Research Needed'; if(conflictCount) readiness='Conflicted'; else if(avgEvidence>=75&&item.sources.size>=2&&item.domains.size>=2&&weakCount===0) readiness='Decision Ready'; else if(avgEvidence>=55&&item.sources.size>=2) readiness='Review';
    return {tag:item.tag,sourceCount:item.sources.size,domainCount:item.domains.size,avgEvidence,claimCount:relatedClaims.length,conflictCount,readiness};
  });
  const checklist=claimRows.map(claim=>{const items=[]; if(claim.conflict) items.push('Resolve the supporting vs. contradicting evidence conflict.'); if(claim.domainCount<2) items.push('Add an independent source from a different hostname.'); if(claim.sourceCount<2) items.push('Add at least one additional source.'); if(claim.supportCount+claim.contradictCount===0) items.push('Link an explicit supporting or contradicting source.'); if(claim.quality<50) items.push('Capture stronger source context, highlights or annotations.'); return {...claim,actions:items};});
  return {claims:claimRows,topics:topicRows,checklist,counts:{wellSupported:claimRows.filter(x=>x.classification==='Well Supported').length,needsIndependent:claimRows.filter(x=>x.classification==='Needs Independent Evidence').length,conflicted:claimRows.filter(x=>x.classification==='Conflicted').length,weak:claimRows.filter(x=>x.classification==='Weak').length,decisionReadyTopics:topicRows.filter(x=>x.readiness==='Decision Ready').length,researchNeededTopics:topicRows.filter(x=>x.readiness==='Research Needed').length}};
}
export { buildEvidenceModel, evidenceScore, normalizeClaim };
