import { mkdirSync } from 'node:fs';
import { createApp } from './http.mjs';
const data=process.env.DATA_DIR||'./data';mkdirSync(data,{recursive:true,mode:0o700});
const aiURL=process.env.AI_URL||'http://ai:3501';
const {server}=createApp({dbPath:`${data}/fuerte.sqlite`,origin:process.env.APP_ORIGIN||'http://localhost:3500',staticRoot:process.env.STATIC_ROOT||'./dist-product',secureCookie:process.env.COOKIE_SECURE!=='false',registration:process.env.REGISTRATION!=='closed',
  aiStatus:async()=>{try{const response=await fetch(`${aiURL}/healthz`,{signal:AbortSignal.timeout(3000)});return response.ok&&(await response.json()).authenticated;}catch{return false;}},
  askAI:async payload=>{const response=await fetch(`${aiURL}/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(100000)});if(!response.ok)throw new Error('AI unavailable');return (await response.json()).answer;},
});
server.listen(Number(process.env.PORT||3500),'0.0.0.0',()=>console.log('Fuerte ready'));
