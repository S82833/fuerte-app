import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createApp} from '../server/http.mjs';

// Every account and record exists only in this process's SQLite memory database.
const runtime=process.env.RUNTIME_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const {chromium}=await import(pathToFileURL(resolve(runtime,'playwright/index.mjs')));
const app=createApp({dbPath:':memory:',origin:'https://fuerte.test',staticRoot:resolve('dist-product'),secureCookie:false,askAI:async()=>{throw new Error('Refresh check must not send chat');},aiStatus:async()=>false});
await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${app.server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.TOUR_CHROMIUM||'C:/Users/simon/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
const headers={Origin:'https://fuerte.test'};
const legal=['Inicio','Centro de ayuda','Comunidad','Libro de reclamaciones','Términos y condiciones','Privacidad de datos'];
const screenshots=resolve('work/caregiver-refresh-20261116');
await mkdir(screenshots,{recursive:true});
let context;
async function post(path,data){const response=await context.request.post(base+'/api/v1'+path,{headers,data});assert.ok(response.ok(),`${path}: ${response.status()}`);return response.json();}
async function swipe(page,start,end){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:start.x,y:start.y}]});
  for(let n=1;n<=8;n++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*n/8,y:start.y+(end.y-start.y)*n/8}]});await page.waitForTimeout(15);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
async function checkFooter(page,width,height){
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
  await page.waitForTimeout(120);
  const links=await page.locator('footer[aria-label="Información de Fuerte"] a').evaluateAll(nodes=>nodes.map(node=>{
    const r=node.getBoundingClientRect(),x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));
    const hit=document.elementFromPoint(x,y);
    return {text:node.textContent.trim(),rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},hit:hit===node||node.contains(hit),visible:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth};
  }));
  assert.deepEqual(links.map(link=>link.text),legal,`${width}x${height}: footer links`);
  for(const link of links)assert.ok(link.visible&&link.hit,`${width}x${height}: footer ${link.text} obstructed: ${JSON.stringify(link)}`);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${width}x${height}: horizontal overflow`);
}
try{
  context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
  const caregiver=await post('/signup',{email:`refresh-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url'),name:'Cuidadora de prueba',consent:true});
  const patient=await post('/patients',{name:'Mateo (DEMO)',birthDate:'2023-01-01',treatment:'Pauta ficticia (DEMO)'});
  // Seed a center and staff account through the real API, then use the real care/assignment routes.
  const staffContext=await browser.newContext();
  const staff=await staffContext.request.post(base+'/api/v1/signup',{headers,data:{email:`staff-${randomUUID()}@example.test`,password:randomBytes(24).toString('base64url'),name:'Profesional de prueba',consent:true}});
  assert.equal(staff.status(),200);const staffData=await staff.json();
  app.store.db.prepare('INSERT INTO platform_admins(user_id) VALUES(?)').run(staffData.user.id);
  const center=await staffContext.request.post(base+'/api/v1/platform/clinics',{headers,data:{name:'Posta DEMO',kind:'posta',city:'Lima'}});
  assert.equal(center.status(),201);const {id:clinicId}=await center.json();
  const enrollment=await post(`/patients/${patient.id}/care`,{clinicId,consent:true});
  const page=await context.newPage(),writes=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/')&&['POST','PATCH','PUT','DELETE'].includes(r.method()))writes.push(`${r.method()} ${new URL(r.url()).pathname}`);});
  let patientGets=0,careGets=0;
  page.on('request',r=>{if(r.method()==='GET'&&new URL(r.url()).pathname==='/api/v1/patients')patientGets++;if(r.method()==='GET'&&new URL(r.url()).pathname===`/api/v1/patients/${patient.id}/care`)careGets++;});
  await page.addInitScript(id=>localStorage.setItem(`fuerte-caregiver-tour:v1:${id}`,'done'),caregiver.user.id);
  await page.goto(base+'/app');
  await page.getByRole('heading',{name:'Tu equipo de salud'}).waitFor();
  await page.getByText(/Solicitud enviada/).waitFor();
  const assignment=await staffContext.request.patch(base+`/api/v1/clinics/${clinicId}/patients/${enrollment.id}`,{headers,data:{version:1,status:'active',priority:'routine',nurseId:null,nextFollowup:''}});
  assert.equal(assignment.status(),200,'Staff activation via actual API');
  assert.equal(await page.getByText(/Solicitud enviada/).count(),1,'No unsolicited immediate update');
  const button=page.getByRole('button',{name:'Actualizar información'});
  await button.click();
  await page.getByText('Solicitud aceptada').waitFor({timeout:10000});
  await page.getByText('El centro aún no asignó un profesional responsable.').waitFor();
  await page.getByRole('status').filter({hasText:'Información actualizada.'}).waitFor();
  await page.screenshot({path:resolve(screenshots,'accepted-care-390x844.png')});
  assert.ok(patientGets>=1&&careGets>=2,'Manual refresh did not fetch patients and care');
  const beforeFocus=careGets;
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForTimeout(450);
  assert.ok(careGets>beforeFocus,'Focus did not reload care');
  await checkFooter(page,390,844);
  await page.screenshot({path:resolve(screenshots,'footer-390x844.png')});
  for(const [width,height] of [[320,568],[844,390],[1366,768]]){
    await page.setViewportSize({width,height});await checkFooter(page,width,height);
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  const count=()=>patientGets;
  let before=count();await swipe(page,{x:190,y:90},{x:190,y:152});await page.waitForTimeout(350);assert.equal(count(),before,'Below-threshold swipe refreshed');
  before=count();await swipe(page,{x:190,y:90},{x:190,y:260});await page.waitForTimeout(500);assert.equal(count(),before+1,'Top pull should trigger exactly one refresh');
  await page.evaluate(()=>scrollTo(0,Math.min(250,document.documentElement.scrollHeight-innerHeight)));await page.waitForTimeout(100);
  before=count();await swipe(page,{x:190,y:260},{x:190,y:420});await page.waitForTimeout(350);assert.equal(count(),before,'Mid-page swipe refreshed');
  await page.getByRole('button',{name:'Historial',exact:true}).click();
  await page.getByRole('button',{name:'Agregar registro'}).click();
  const draft=page.locator('.record-editor textarea[name="body"]');await draft.fill('Borrador sin guardar');
  await draft.scrollIntoViewIfNeeded();const box=await draft.boundingBox();assert.ok(box,'Draft textarea missing');
  before=count();await swipe(page,{x:box.x+box.width/2,y:box.y+Math.min(25,box.height/2)},{x:box.x+box.width/2,y:box.y+Math.min(25,box.height/2)+130});await page.waitForTimeout(350);
  assert.equal(count(),before,'Textarea swipe refreshed');assert.equal(await draft.inputValue(),'Borrador sin guardar','Draft changed after textarea swipe');
  await page.evaluate(()=>scrollTo(0,0));await button.click();await page.getByRole('status').filter({hasText:'Información actualizada.'}).waitFor();assert.equal(await draft.inputValue(),'Borrador sin guardar','Manual refresh cleared draft');
  await page.getByRole('button',{name:'Inicio',exact:true}).last().click();
  await page.getByRole('heading',{name:'Tu equipo de salud'}).waitFor();
  const careUrl=`**/api/v1/patients/${patient.id}/care`;
  await page.route(careUrl,route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Fallo de prueba'}})}));
  await button.click();
  await page.locator('.refresh-status').filter({hasText:'No se pudo actualizar.'}).waitFor();
  assert.equal(await page.locator('.refresh-status').getByText('Información actualizada.').count(),0,'Failure displayed success');
  await page.unroute(careUrl);
  await button.click();await page.locator('.refresh-status').filter({hasText:'Información actualizada.'}).waitFor();
  assert.deepEqual(writes,[],'Refresh or tour sent a write');
  assert.deepEqual(errors,[],'Browser errors');
  console.log('PASS caregiver refresh: accepted care, focus, footer 4 viewports, touch guards, draft preserved, zero browser writes');
  await staffContext.close();
}finally{await context?.close();await browser.close();app.server.closeAllConnections();await new Promise(done=>app.server.close(done));app.store.db.close();}
