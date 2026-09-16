const STOP_WORDS = new Set(['about','after','again','against','among','because','before','being','between','could','from','have','into','more','other','should','their','there','these','those','through','under','what','when','where','which','while','with','would']);

export function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : []).map(value => String(value || '').trim().toLowerCase()).filter(Boolean))].sort();
}

function textTokens(value) {
  return new Set(String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(token => token.length > 3 && !STOP_WORDS.has(token)));
}

function overlap(a, b) {
  let shared = 0;
  for (const token of a) if (b.has(token)) shared++;
  return shared / Math.max(1, new Set([...a, ...b]).size);
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

export function relatedScore(a, b) {
  const tags = overlap(new Set(normalizeTags(a?.tags)), new Set(normalizeTags(b?.tags)));
  const titles = overlap(textTokens(a?.title), textTokens(b?.title));
  const sameDomain = hostname(a?.url || a?.canonicalUrl) && hostname(a?.url || a?.canonicalUrl) === hostname(b?.url || b?.canonicalUrl) ? 0.2 : 0;
  return Math.min(1, tags * 0.6 + titles * 0.2 + sameDomain);
}

function uniqueById(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    const id = String(item?.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function normalizeKnowledge(link) {
  const sourceContext = { ...(link?.sourceContext || {}) };
  const claims = uniqueById(sourceContext.claims).map(claim => ({
    ...claim,
    text: String(claim.text || '').trim()
  })).filter(claim => claim.text);
  const claimIds = new Set(claims.map(claim => claim.id));
  const evidenceRelations = uniqueById(sourceContext.evidenceRelations).filter(relation =>
    claimIds.has(relation.claimId) && relation.targetCanonicalUrl && ['supports', 'contradicts', 'related_to'].includes(relation.type)
  ).map(relation => ({
    ...relation,
    confidence: Math.max(0, Math.min(1, Number.isFinite(Number(relation.confidence)) ? Number(relation.confidence) : 1))
  }));
  return {
    ...link,
    tags: normalizeTags(link?.tags),
    sourceContext: {
      ...sourceContext,
      claims,
      evidenceRelations
    }
  };
}

export function scoreEvidence(link) {
  const source = link?.sourceContext || {};
  let score = 0;
  score += link?.description ? 10 : 0;
  score += source.excerpt ? 15 : 0;
  score += source.enrichedAt ? 10 : 0;
  score += Number(source.status) >= 200 && Number(source.status) < 400 ? 10 : 0;
  score += normalizeTags(link?.tags).length >= 2 ? 10 : 0;
  score += Array.isArray(source.highlights) && source.highlights.length ? 15 : 0;
  score += Array.isArray(source.annotations) && source.annotations.length ? 10 : 0;
  score += Array.isArray(source.claims) && source.claims.length ? 10 : 0;
  score += Array.isArray(source.evidenceRelations) && source.evidenceRelations.length ? 10 : 0;
  return Math.max(0, Math.min(100, score));
}

export function buildKnowledgeGraph(links, activeCanonicalUrl) {
  const normalized = (Array.isArray(links) ? links : []).map(normalizeKnowledge);
  const active = normalized.find(link => link.canonicalUrl === activeCanonicalUrl);
  if (!active) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  const seenNodes = new Set();
  const addNode = (id, type, label, meta = {}) => {
    if (seenNodes.has(id)) return;
    seenNodes.add(id);
    nodes.push({ id, type, label, ...meta });
  };

  addNode(`link:${active.canonicalUrl}`, 'link', active.title || active.url, { url: active.url, evidence: scoreEvidence(active) });
  for (const tag of active.tags.slice(0, 12)) {
    addNode(`topic:${tag}`, 'topic', tag);
    edges.push({ from: `link:${active.canonicalUrl}`, to: `topic:${tag}`, type: 'same_topic', confidence: 1, reason: 'saved tag' });
  }
  for (const claim of active.sourceContext.claims) addNode(`claim:${claim.id}`, 'claim', claim.text, { claimId: claim.id });

  normalized
    .filter(link => link.canonicalUrl !== active.canonicalUrl)
    .map(link => ({ link, score: relatedScore(active, link) }))
    .filter(item => item.score > 0.1)
    .sort((a, b) => b.score - a.score || a.link.canonicalUrl.localeCompare(b.link.canonicalUrl))
    .slice(0, 8)
    .forEach(({ link, score }) => {
      addNode(`link:${link.canonicalUrl}`, 'link', link.title || link.url, { url: link.url, evidence: scoreEvidence(link) });
      edges.push({ from: `link:${active.canonicalUrl}`, to: `link:${link.canonicalUrl}`, type: 'related_to', confidence: Number(score.toFixed(4)), reason: score >= 0.6 ? 'shared tags/title concepts' : score >= 0.3 ? 'shared knowledge signals' : 'weak local affinity' });
    });

  for (const relation of active.sourceContext.evidenceRelations) {
    const target = normalized.find(link => link.canonicalUrl === relation.targetCanonicalUrl);
    if (!target) continue;
    addNode(`link:${target.canonicalUrl}`, 'link', target.title || target.url, { url: target.url, evidence: scoreEvidence(target) });
    edges.push({ from: `claim:${relation.claimId}`, to: `link:${target.canonicalUrl}`, type: relation.type, confidence: relation.confidence, reason: relation.reason || 'explicit evidence relation' });
  }

  return { nodes, edges };
}
