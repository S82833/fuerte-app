import {randomBytes,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://fuerte.signalvise.com/api/v1';let cookie='';
async function call(path,body){const response=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:'https://fuerte.signalvise.com',Cookie:cookie,...(body?{'Content-Type':'application/json','Idempotency-Key':randomUUID()}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(100000)});const c=response.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const data=await response.json();assert.ok(response.ok,`HTTP ${response.status}: ${JSON.stringify(data)}`);return data;}
const account=await call('/signup',{email:`smoke-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url'),name:'Verificacion tecnica',consent:true});
const p=await call('/patients',{name:'Perfil de prueba ficticio',birthDate:'2024-01-01',treatment:'Pauta de prueba. Ningun paciente real.'});
await call(`/patients/${p.id}/records`,{kind:'dose',occurred:'2026-09-20',body:'Registro ficticio para comprobar el sistema.'});
const result=await call(`/patients/${p.id}/chat`,{message:'Que dosis tengo registradas? Menciona la fecha.',consent:true});
assert.match(result.answer,/20/);assert.match(result.answer,/2026/);
const messages=await call(`/patients/${p.id}/chat`);assert.equal(messages.items.length,2);
await call('/logout',{});
console.log(JSON.stringify({status:'PASS',checks:['HTTPS signup','profile','persistent dose','Codex contextual answer','saved conversation','logout'],testUserId:account.user.id,answer:result.answer}));
