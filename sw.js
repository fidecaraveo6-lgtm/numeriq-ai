const CACHE='numeriq-ai-v1-8';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(e.request.method!=='GET')return;
  // Las Netlify Functions son dinámicas: nunca servir ni guardar respuestas antiguas (incluidos 404).
  if(url.origin===self.location.origin && url.pathname.startsWith('/.netlify/functions/')){
    e.respondWith(fetch(e.request,{cache:'no-store'}));
    return;
  }
  if(url.origin!==self.location.origin)return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{
    if(response.ok && response.type==='basic'){
      const copy=response.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
    }
    return response;
  }).catch(()=>cached)));
});
