import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createApp,parseByteRange} from '../server/http.mjs';

const scratch=fs.mkdtempSync(path.resolve('work/landing-check-'));
fs.copyFileSync('dist-product/landing.html',path.join(scratch,'landing.html'));
fs.copyFileSync('dist-product/product.html',path.join(scratch,'product.html'));
for(const page of ['terminos','privacidad']){fs.mkdirSync(path.join(scratch,page));fs.copyFileSync(`dist-product/${page}/index.html`,path.join(scratch,page,'index.html'));}
fs.mkdirSync(path.join(scratch,'tutorials'));
const fixture=Buffer.from(Array.from({length:4096},(_,i)=>i%256));
fs.writeFileSync(path.join(scratch,'tutorials/fixture.mp4'),fixture);
let source=fs.readFileSync(new URL('../server/http.mjs',import.meta.url),'utf8');
source=source.replace(/from '\.\/([^']+)'/g,(_,file)=>`from '${pathToFileURL(path.resolve('server',file)).href}'`);

async function gate(name,mutated,original){let red=false;try{await mutated()}catch(error){if(error instanceof assert.AssertionError)red=true;else throw error}assert.equal(red,true,`Mutation not detected: ${name}`);console.log('RED: '+name);await original();console.log('GREEN: '+name)}
async function factory(text){return (await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'))).createApp}
async function serve(make,fn){const app=make({dbPath:':memory:',origin:'http://fuerte.test',staticRoot:scratch,askAI:async()=>''});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));try{await fn(`http://127.0.0.1:${app.server.address().port}`)}finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.store.db.close()}}
function ranges(parse){assert.equal(parse(undefined,100),undefined);assert.deepEqual(parse('bytes=2-9',100),{start:2,end:9});assert.deepEqual(parse('bytes=90-',100),{start:90,end:99});assert.deepEqual(parse('bytes=-5',100),{start:95,end:99});assert.deepEqual(parse('bytes=0-999',100),{start:0,end:99});for(const value of ['bytes=100-','bytes=9-2','bytes=-0','bytes=0-1,4-5','bytes=-','bytes=9999999999999999999999-'])assert.equal(parse(value,100),null)}
async function routes(make){await serve(make,async base=>{const home=await fetch(base+'/');assert.equal(home.status,200);const text=await home.text();assert.match(text,/id="tutoriales"/);assert.match(text,/id="preguntas"/);assert.ok(!text.includes('<div id="root">'));assert.ok(!text.includes('href="https://fuerte.signalvise.com/"'));assert.match(text,/href="\/login"/);for(const route of ['/login','/app','/login/','/app/']){const r=await fetch(base+route);assert.equal(r.status,200);assert.match(await r.text(),/id="root"/)}const api=await fetch(base+'/api/v1/me');assert.equal(api.status,401);assert.equal(api.headers.get('cache-control'),'no-store')})}
async function partial(make){await serve(make,async base=>{const r=await fetch(base+'/tutorials/fixture.mp4',{headers:{Range:'bytes=2-33'}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),'bytes 2-33/4096');assert.equal(r.headers.get('content-length'),'32');assert.equal(r.headers.get('accept-ranges'),'bytes');assert.equal(r.headers.get('content-type'),'video/mp4');assert.deepEqual(Buffer.from(await r.arrayBuffer()),fixture.subarray(2,34));const suffix=await fetch(base+'/tutorials/fixture.mp4',{headers:{Range:'bytes=-16'}});assert.equal(suffix.status,206);assert.deepEqual(Buffer.from(await suffix.arrayBuffer()),fixture.subarray(-16));const head=await fetch(base+'/tutorials/fixture.mp4',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'4096');assert.equal((await head.arrayBuffer()).byteLength,0)})}
async function invalid(make){await serve(make,async base=>{const r=await fetch(base+'/tutorials/fixture.mp4',{headers:{Range:'bytes=4096-'}});assert.equal(r.status,416);assert.equal(r.headers.get('content-range'),'bytes */4096')})}
async function legalRoutes(make){await serve(make,async base=>{for(const route of ['/terminos','/terminos/','/privacidad','/privacidad/']){const r=await fetch(base+route);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);const text=await r.text();assert.match(text,/privacidad@fuerte\.example/);assert.match(text,/sin recepción de mensajes/);assert.match(text,/href="\/login"/);assert.ok(!text.includes('id="root"'));}const home=await (await fetch(base+'/')).text();assert.match(home,/href="\/terminos"/);assert.match(home,/href="\/privacidad"/);})}

await gate('byte range validation',()=>ranges(()=>undefined),()=>ranges(parseByteRange));
let changed=source.replace("path==='/'?'/landing.html'","path==='/'?'/product.html'");assert.notEqual(changed,source);
await gate('landing root and dedicated app paths',()=>factory(changed).then(routes),()=>routes(createApp));
changed=source.replace('res.writeHead(range?206:200)','res.writeHead(200)');assert.notEqual(changed,source);
await gate('partial video streaming and HEAD',()=>factory(changed).then(partial),()=>partial(createApp));
changed=source.replace('res.writeHead(416,','res.writeHead(200,');assert.notEqual(changed,source);
await gate('unsatisfiable ranges return 416',()=>factory(changed).then(invalid),()=>invalid(createApp));
changed=source.replace('Object.hasOwn(legal,path)?legal[path]:path','path');assert.notEqual(changed,source);
await gate('public legal pages and disclosure of example contact',()=>factory(changed).then(legalRoutes),()=>legalRoutes(createApp));
console.log('PASS: 5/5 RED then GREEN, public routing, legal pages and bounded streaming');
