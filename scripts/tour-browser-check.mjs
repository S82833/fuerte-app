import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createApp} from '../server/http.mjs';

// Local, isolated DB; generated credentials remain only in process memory.
const runtime=process.env.RUNTIME_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const {chromium}=await import(pathToFileURL(resolve(runtime,'playwright/index.mjs')));
const out=resolve('work/tour-visibility-20261116');await mkdir(out,{recursive:true});
const app=createApp({dbPath:':memory:',origin:'https://fuerte.test',staticRoot:resolve('dist-product'),secureCookie:false,askAI:async()=>{throw new Error('Tour must not send chat');},aiStatus:async()=>true});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.TOUR_CHROMIUM?{executablePath:process.env.TOUR_CHROMIUM}:{channel:'chrome'})});
const sizes=process.env.TOUR_VIEWPORTS?JSON.parse(process.env.TOUR_VIEWPORTS):[[1536,754],[1917,940],[1366,768],[390,844],[320,568],[844,390]];
const targets=[null,'dose-card','nav-historial','add-record','record-editor','nav-inicio','edit-treatment','treatment-editor','nav-chat','chat-consent'];
const results=[];
function checkGeometry(g,label){
  assert.ok(g.card.x>=-1&&g.card.y>=-1&&g.card.right<=g.width+1&&g.card.bottom<=g.height+1,`${label}: card outside viewport`);
  assert.ok(g.intersection<1,`${label}: card covers highlighted target (${Math.round(g.intersection)} px2)`);
  assert.ok(g.visibleArea>150,`${label}: target not visible`);
  assert.ok(g.holeMatches,`${label}: spotlight not aligned to target`);
  assert.ok(g.targetNotDimmed,`${label}: shade covers target`);
  assert.ok(g.outsideDimmed,`${label}: area outside target not dimmed`);
  if(g.action)assert.ok(g.targetHit,`${label}: action target blocked`);
  assert.ok(!g.horizontalOverflow,`${label}: horizontal overflow`);
}
try{
  for(const [width,height] of sizes){
    const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
    const headers={Origin:'https://fuerte.test'};
    const account=await context.request.post(base+'/api/v1/signup',{headers,data:{email:`tour-${width}-${height}@example.test`,password:randomBytes(24).toString('base64url'),name:'Cuidador de prueba',consent:true}});
    assert.equal(account.status(),200,'Local fixture signup failed');
    const patient=await context.request.post(base+'/api/v1/patients',{headers,data:{name:'Mateo (DEMO)',birthDate:'2023-01-01',treatment:'DEMO: indicación ficticia para comprobar la interfaz.'}});
    assert.equal(patient.status(),201,'Local fixture patient failed');
    const patientData=await patient.json();
    const page=await context.newPage(),errors=[],mutations=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD'].includes(r.method()))mutations.push(new URL(r.url()).pathname);});
    await page.goto(base+'/app?tour=1');await page.getByRole('button',{name:'Empezar',exact:true}).waitFor();
    await page.getByRole('button',{name:'Empezar',exact:true}).click();
    for(let step=1;step<targets.length;step++){
      await page.locator('.guided-tour-count').filter({hasText:`PASO ${step+1} DE 10`}).waitFor();
      // Wait for real font layout and a settled scroll, including native focus scrolling.
      await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(250);
      const geometry=await page.evaluate(({target,action})=>{
        const el=document.querySelector(`[data-tour="${target}"]`),card=document.querySelector('.guided-tour-card'),hole=document.querySelector('.guided-tour-hole');
        const rect=node=>{const r=node.getBoundingClientRect();return {x:r.left,y:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
        const a=rect(el),b=rect(card),h=hole?rect(hole):null;
        const visible={x:Math.max(0,a.x),y:Math.max(0,a.y),right:Math.min(innerWidth,a.right),bottom:Math.min(innerHeight,a.bottom)};
        const vx=h?h.x+h.width/2:(visible.x+visible.right)/2,vy=h?h.y+h.height/2:(visible.y+visible.bottom)/2;
        const point=document.elementFromPoint(vx,vy);
        const covers=(node,x,y)=>{const r=node.getBoundingClientRect();const style=getComputedStyle(node);return r.left<=x&&r.right>x&&r.top<=y&&r.bottom>y&&style.display!=='none'&&Number(style.opacity)!==0&&style.backgroundColor!=='rgba(0, 0, 0, 0)';};
        const shades=[...document.querySelectorAll('.guided-tour-shade')];
        // Full-screen solid shade is not a spotlight even when one target is raised above it.
        const targetNotDimmed=!shades.some(shade=>covers(shade,vx,vy));
        const outsideX=target.startsWith('nav-')?Math.max(5,a.x+8):5;
        const outsideY=target.startsWith('nav-')?Math.max(5,a.y-16):5;
        const outsideDimmed=shades.some(shade=>covers(shade,outsideX,outsideY));
        return {target,action,width:innerWidth,height:innerHeight,targetRect:a,card:b,hole:h,intersection:h?Math.max(0,Math.min(h.right,b.right)-Math.max(h.x,b.x))*Math.max(0,Math.min(h.bottom,b.bottom)-Math.max(h.y,b.y)):Infinity,visibleArea:h?h.width*h.height:0,holeMatches:!!h&&Math.abs(h.x-Math.max(4,a.x-5))<14&&Math.abs(h.width-(a.width+10))<28&&(!action||Math.abs(h.height-(a.height+10))<28),targetNotDimmed,outsideDimmed,targetHit:point===el||el.contains(point),horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
      },{target:targets[step],action:[2,3,5,6,8].includes(step)});
      await page.screenshot({path:resolve(out,`${width}x${height}-step-${step+1}.png`)});
      results.push({viewport:[width,height],step:step+1,...geometry});
      checkGeometry(geometry,`${width}x${height} step ${step+1}`);
      if(geometry.action)await page.locator(`[data-tour="${targets[step]}"]`).click();
      else await page.getByRole('button',{name:step===9?'Finalizar':'Entendido',exact:true}).click();
    }
    await page.locator('.guided-tour-card').waitFor({state:'detached'});
    assert.deepEqual(mutations,[],'Tour sent a write request');
    assert.deepEqual(errors,[],'Browser error');
    assert.equal(app.store.db.prepare('SELECT COUNT(*) n FROM records').get().n,0);
    assert.equal(app.store.db.prepare('SELECT version FROM patients WHERE id=?').get(patientData.id).version,patientData.version);
    // Manual replay and dismissal remain usable after the full walkthrough.
    await page.getByRole('button',{name:'Ver tutorial',exact:true}).click();
    await page.getByRole('button',{name:'Empezar',exact:true}).waitFor();
    await page.keyboard.press('Escape');await page.locator('.guided-tour-card').waitFor({state:'detached'});
    console.log(`PASS ${width}x${height}: 10 steps, exact spotlight, no card overlap, zero writes, replay/Escape`);
    await context.close();
  }
  await writeFile(resolve(out,'browser-results.json'),JSON.stringify({status:'passed',results},null,2));
}catch(error){await writeFile(resolve(out,'browser-results.json'),JSON.stringify({status:'failed',error:error.message,results},null,2));throw error;}
finally{await browser.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app.store.db.close();}
