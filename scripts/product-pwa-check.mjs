import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {createApp} from '../server/http.mjs';

const root=path.resolve('dist-product');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'pwa/manifest.webmanifest'),'utf8'));
const worker=fs.readFileSync(path.join(root,'fuerte-sw.js'),'utf8');
const html=fs.readFileSync(path.join(root,'product.html'),'utf8');
const origin='https://fuerte.test';

async function gate(name,mutated,original){
  let detected=false;
  try{await mutated();}catch(error){if(error instanceof assert.AssertionError)detected=true;else throw error;}
  assert.equal(detected,true,`Mutation not detected: ${name}`);
  console.log(`RED: ${name}`);
  await original();
  console.log(`GREEN: ${name}`);
}

function installable(m){
  assert.equal(m.name,'Fuerte');assert.equal(m.id,'/');assert.equal(m.scope,'/');assert.equal(m.start_url,'/');
  assert.equal(m.display,'standalone');assert.equal(m.prefer_related_applications,false);
  for(const size of [192,512]){
    const icon=m.icons.find(i=>i.sizes===`${size}x${size}`&&i.purpose==='any');assert.ok(icon,`Missing icon ${size}`);
    const bytes=fs.readFileSync(path.join(root,icon.src.slice(1)));assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
  }
  assert.ok(m.icons.some(i=>i.purpose==='maskable'));
  assert.match(html,/rel="manifest" href="\/pwa\/manifest.webmanifest"/);
  assert.match(html,/rel="apple-touch-icon" sizes="180x180"/);
  assert.match(html,/apple-mobile-web-app-capable" content="yes"/);
}

function model(code,{offline=false}={}){
  const handlers={},stored=new Map(),deleted=[],puts=[],added=[];
  const cache={
    async addAll(requests){for(const req of requests){const url=new URL(req.url);added.push(req.url);stored.set(req.url,new Response(fs.readFileSync(path.join(root,url.pathname.slice(1)))))}},
    async match(req){return stored.get(typeof req==='string'?req:req.url)?.clone()},
    async put(req,response){puts.push(req.url);stored.set(req.url,response)}
  };
  const sandbox={URL,Request,Response,Set,self:{location:{origin},clients:{claim:async()=>{}},addEventListener:(name,callback)=>{handlers[name]=callback}},
    caches:{open:async()=>cache,keys:async()=>['fuerte-product:previous','unrelated-app:keep'],delete:async key=>{deleted.push(key);return true}},
    fetch:async()=>{if(offline)throw new TypeError('Offline fixture');return new Response('public fixture')}
  };
  vm.runInNewContext(code,sandbox);
  return {handlers,added,deleted,puts,stored};
}

async function trigger(handler,event={}){const pending=[];handler({...event,waitUntil:value=>{pending.push(value)}});await Promise.all(pending);}

function privateTraffic(code){
  const m=model(code);
  for(const mode of ['cors','navigate'])for(const endpoint of ['/api/v1/patients','/api/v1/me','/api/v1/patients/fixture/chat']){
    let intercepted=false;
    m.handlers.fetch({request:{method:'GET',url:origin+endpoint,mode},respondWith:()=>{intercepted=true}});
    assert.equal(intercepted,false,`API intercepted: ${endpoint} ${mode}`);
  }
  let intercepted=false;
  m.handlers.fetch({request:{method:'POST',url:origin+'/api/v1/patients',mode:'cors'},respondWith:()=>{intercepted=true}});
  assert.equal(intercepted,false);
}

async function offlineFallback(code){
  const m=model(code,{offline:true});await trigger(m.handlers.install);
  const pending=[];m.handlers.fetch({request:{method:'GET',url:origin+'/',mode:'navigate'},respondWith:value=>{pending.push(value)}});
  assert.equal(pending.length,1);const [response]=await Promise.all(pending);assert.equal(response.status,200);assert.match(await response.text(),/Volvemos cuando tengas conexión/);
  assert.ok(m.added.length>5);
  assert.ok(m.added.every(url=>new URL(url).pathname.startsWith('/assets/')||new URL(url).pathname.startsWith('/pwa/')));
  assert.equal(m.puts.length,0,'No runtime or private data should be written on navigation');
}

async function isolatedCache(code){const m=model(code);await trigger(m.handlers.activate);assert.deepEqual(m.deleted,['fuerte-product:previous']);}

async function headers(factory){
  const app=factory({dbPath:':memory:',origin:'http://fuerte.test',staticRoot:root,askAI:async()=>''});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const m=await fetch(base+'/pwa/manifest.webmanifest');assert.equal(m.status,200);assert.match(m.headers.get('content-type'),/application\/manifest\+json/);
    const sw=await fetch(base+'/fuerte-sw.js');assert.equal(sw.status,200);assert.equal(sw.headers.get('cache-control'),'no-cache');assert.match(sw.headers.get('content-type'),/javascript/);
    const privateResponse=await fetch(base+'/api/v1/me');assert.equal(privateResponse.status,401);assert.equal(privateResponse.headers.get('cache-control'),'no-store');
    const homepage=await fetch(base+'/');assert.equal(homepage.headers.get('cache-control'),'no-cache');
    const entry=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
    const asset=await fetch(base+entry);assert.equal(asset.status,200);assert.match(asset.headers.get('cache-control'),/immutable/);
    assert.match(homepage.headers.get('content-security-policy'),/worker-src 'self'/);
  }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.store.db.close();}
}

await gate('installable manifest and Apple metadata',()=>installable({...manifest,display:'browser'}),()=>installable(manifest));
const noApiGuard=worker.replace("if (url.pathname.startsWith('/api/')) return;",'');
assert.notEqual(noApiGuard,worker);
await gate('private API traffic never intercepted',()=>privateTraffic(noApiGuard),()=>privateTraffic(worker));
const noFallback=worker.replace('cache.match(OFFLINE_URL)',"cache.match(new URL('/missing.html', self.location.origin).href)");
assert.notEqual(noFallback,worker);
await gate('public offline fallback without patient cache',()=>offlineFallback(noFallback),()=>offlineFallback(worker));
const broadDelete=worker.replace('key.startsWith(CACHE_PREFIX)','true');assert.notEqual(broadDelete,worker);
await gate('only this product cache can be retired',()=>isolatedCache(broadDelete),()=>isolatedCache(worker));
let source=fs.readFileSync(new URL('../server/http.mjs',import.meta.url),'utf8');
source=source.replace(/from '\.\/([^']+)'/g,(_,file)=>`from '${pathToFileURL(path.resolve('server',file)).href}'`);
const changed=source.replace("res.setHeader('Cache-Control','public, max-age=31536000, immutable')","res.setHeader('Cache-Control','no-store')");assert.notEqual(changed,source);
const mutant=await import('data:text/javascript;base64,'+Buffer.from(changed).toString('base64'));
await gate('public asset cache and private HTTP headers',()=>headers(mutant.createApp),()=>headers(createApp));
console.log('PASS: 5/5 RED then GREEN, manifest/icons, API privacy, offline fallback, cache isolation, HTTP headers');
