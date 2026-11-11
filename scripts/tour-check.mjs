import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../product/tour-state.mjs',import.meta.url),'utf8');
const load=async code=>import(`data:text/javascript,${encodeURIComponent(code)}`);
const original=await load(source);
let checks=0;
async function check(name,needle,replacement,verify){
  assert.ok(source.includes(needle),`Mutación no aplicada: ${name}`);
  const mutant=await load(source.replace(needle,replacement));
  let red=false;
  try{verify(mutant);}catch{red=true;}
  assert.ok(red,`La prueba no detecta la mutación: ${name}`);
  verify(original);
  checks++;
  console.log(`RED → GREEN: ${name}`);
}

const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};};
await check('estado aislado por cuenta','${userId}`','constant`',mod=>{
  const store=storage();
  assert.equal(mod.markTourSeen(store,'account-A'),true);
  assert.equal(mod.hasSeenTour(store,'account-A'),true);
  assert.equal(mod.hasSeenTour(store,'account-B'),false);
});
await check('versión y usuario requeridos','if (!key) return true;','if (!key) return false;',mod=>{
  assert.equal(mod.hasSeenTour(storage(),''),true);
  assert.match(mod.tourKey('account-A'),/v1:account-A$/);
});
await check('trigger conserva otros parámetros','url.searchParams.delete(TOUR_QUERY);','url.search = \'\';',mod=>{
  const location={href:'https://example.test/app?tour=1&source=demo#paso'};
  let next='';const history={state:{x:1},replaceState(_state,_unused,url){next=url;}};
  assert.equal(mod.consumeTourRequest(location,history),true);
  assert.equal(next,'/app?source=demo#paso');
});
await check('guarda panel clínico y trabajo abierto','!clinical && !busy','!busy',mod=>{
  const base={loading:false,workspaceReady:true,clinical:false,busy:false,creating:false,profileReady:true,hasUnsavedWork:false};
  assert.equal(mod.tourMayStart({...base,clinical:true}),false);
  assert.equal(mod.tourMayStart({...base,hasUnsavedWork:true}),false);
  assert.equal(mod.tourMayStart(base),true);
});
await check('espera workspace y perfil','workspaceReady &&','true &&',mod=>{
  const base={loading:false,workspaceReady:false,clinical:false,busy:false,creating:false,profileReady:true,hasUnsavedWork:false};
  assert.equal(mod.tourMayStart(base),false);
  assert.equal(mod.tourMayStart({...base,workspaceReady:true,profileReady:false}),false);
});
await check('respeta borrador del primer perfil',"['name', 'birth', 'treatment']","[]",mod=>{
  const root=values=>({querySelector:selector=>selector==='[data-tour="profile-create"]'?{elements:{namedItem:key=>({value:values[key]||''})}}:null});
  for(const key of ['name','birth','treatment'])assert.equal(mod.hasUnsavedTourWork(root({[key]:' dato '})),true);
  assert.equal(mod.hasUnsavedTourWork(root({})),false);
});
console.log(`${checks} verificaciones de tutorial pasaron con mutación RED y original GREEN.`);
