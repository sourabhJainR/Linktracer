const LINKTRACER_DB='linktracer-local';
const LINKTRACER_DB_VERSION=5;
const LINKTRACER_STORES={
  links:{keyPath:'canonicalUrl'},
  outbox:{keyPath:'id',autoIncrement:true},
  meta:{keyPath:'key'},
  collections:{keyPath:'id'}
};

function ensureLinktracerStores(db){
  for(const [name,options] of Object.entries(LINKTRACER_STORES)){
    if(!db.objectStoreNames.contains(name))db.createObjectStore(name,options);
  }
}

window.LinktracerDbReady=new Promise((resolve,reject)=>{
  const request=indexedDB.open(LINKTRACER_DB,LINKTRACER_DB_VERSION);
  request.onupgradeneeded=()=>ensureLinktracerStores(request.result);
  request.onsuccess=()=>{
    const db=request.result;
    const missing=Object.keys(LINKTRACER_STORES).filter(name=>!db.objectStoreNames.contains(name));
    if(missing.length){
      db.close();
      reject(new Error(`Local database is missing required stores: ${missing.join(', ')}`));
      return;
    }
    db.close();
    resolve();
  };
  request.onerror=()=>reject(request.error||new Error('Unable to initialize local database'));
  request.onblocked=()=>reject(new Error('Local database upgrade is blocked by another Linktracer tab. Close other tabs and retry.'));
});
