const LINKTRACER_DB='linktracer-local';
const LINKTRACER_DB_VERSION=4;
const LINKTRACER_STORES={
  links:{keyPath:'canonicalUrl'},
  outbox:{keyPath:'id',autoIncrement:true},
  meta:{keyPath:'key'},
  collections:{keyPath:'id'}
};

function ensureLinktracerStores(db){
  for(const [name,options] of Object.entries(LINKTRACER_STORES)){
    if(!db.objectStoreNames.contains(name)) db.createObjectStore(name,options);
  }
}

function openLinktracerDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(LINKTRACER_DB,LINKTRACER_DB_VERSION);
    request.onupgradeneeded=()=>ensureLinktracerStores(request.result);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Unable to open local database'));
    request.onblocked=()=>reject(new Error('Local database upgrade is blocked by another open tab. Close other Linktracer tabs and retry.'));
  });
}

window.LinktracerDb={open:openLinktracerDb,version:LINKTRACER_DB_VERSION,stores:Object.keys(LINKTRACER_STORES)};
