function normalizeTitle(value){
  return String(value||'').toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .replace(/\b(the|a|an|official|home|homepage)\b/g,' ')
    .replace(/\s+/g,' ').trim();
}
function host(url){
  try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase()}catch{return''}
}
function duplicateKey(link){
  const title=normalizeTitle(link?.title);
  if(title.length<10)return '';
  return host(link?.url)+'|'+title;
}
function duplicateGroups(links){
  const groups=new Map();
  for(const link of links||[]){
    const key=duplicateKey(link);
    if(!key)continue;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(link);
  }
  return [...groups.values()].filter(group=>group.length>1);
}
function uniqueRecords(records){
  const seen=new Set(),result=[];
  for(const item of records||[]){
    if(!item)continue;
    const key=String(item.text||'').trim().toLowerCase()+'|'+String(item.note||'').trim().toLowerCase();
    if(!key||seen.has(key))continue;
    seen.add(key);result.push(item);
  }
  return result;
}
function firstAvailable(items,key){
  for(const item of items){const value=item?.sourceContext?.[key];if(value)return value}
  return undefined;
}
function mergeDuplicateMetadata(keeper,duplicates){
  const sources=[keeper,...(duplicates||[])];
  const descriptions=uniqueRecords(sources.flatMap(x=>x?.descriptions||[]));
  const contextSources=sources.map(x=>x?.sourceContext||{});
  const annotations=uniqueRecords(contextSources.flatMap(x=>x.annotations||[]));
  const highlights=uniqueRecords(contextSources.flatMap(x=>x.highlights||[]));
  const sourceContext={...(keeper?.sourceContext||{})};
  for(const key of ['site','status','finalUrl','favicon','excerpt','contentType','health']){
    if(sourceContext[key]===undefined)sourceContext[key]=firstAvailable(sources,key);
  }
  const favorite=sources.some(x=>x?.favorite===true||x?.sourceContext?.favorite===true);
  if(favorite){sourceContext.favorite=true}
  const followUp=sources.map(x=>x?.followUp||x?.sourceContext?.followUp).find(x=>x?.enabled===true);
  if(followUp)sourceContext.followUp={...followUp};
  const keeperTriage=keeper?.triage||keeper?.sourceContext?.triage;
  if(keeperTriage)sourceContext.triage={...keeperTriage};
  const mergedFrom=[...new Set([...(keeper?.sourceContext?.mergedSources||[]),...(duplicates||[]).map(x=>x.canonicalUrl).filter(Boolean)])];
  if(mergedFrom.length)sourceContext.mergedSources=mergedFrom;
  if(annotations.length)sourceContext.annotations=annotations;
  if(highlights.length)sourceContext.highlights=highlights;
  return {
    ...keeper,
    title:keeper?.title||sources.find(x=>x?.title)?.title||'',
    descriptions,
    description:descriptions.map(x=>x.text).join('\n\n'),
    tags:[...new Set(sources.flatMap(x=>x?.tags||[]))],
    favorite,
    sourceContext,
    followUp:followUp?{...followUp}:keeper?.followUp,
    createdAt:Math.min(...sources.map(x=>Number(x?.createdAt||Date.now()))),
    updatedAt:Math.max(...sources.map(x=>Number(x?.updatedAt||0)),Number(keeper?.updatedAt||0))
  };
}
export { normalizeTitle, duplicateKey, duplicateGroups, mergeDuplicateMetadata };
