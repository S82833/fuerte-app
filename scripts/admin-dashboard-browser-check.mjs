import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createApp} from '../server/http.mjs';

const runtime=process.env.RUNTIME_NODE_MODULES||'C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-611-0_26.1112.611.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules';
const {chromium}=await import(pathToFileURL(resolve(runtime,'playwright/index.mjs')));
const app=createApp({dbPath:':memory:',origin:'https://fuerte.test',staticRoot:resolve('dist-product'),secureCookie:false,askAI:async()=>{throw Error('No chat in this test');},aiStatus:async()=>false});
await new Promise(done=>app.server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${app.server.address().port}`;
const db=app.store.db,insert=(sql,...args)=>db.prepare(sql).run(...args);
const out=resolve('work/admin-dashboard-20261116');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.TOUR_CHROMIUM||'C:/Users/simon/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'});
try{
  insert('INSERT INTO users VALUES(?,?,?,?,?)','root','admin@example.test','Administrador DEMO','test-only-no-login','2026-01-01T00:00:00Z');
  insert('INSERT INTO platform_admins VALUES(?)','root');
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addCookies([{name:'fuerte_session',value:app.store.session('root'),url:base,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/api/')&&!['GET','HEAD'].includes(r.method()))writes.push(r.method());});
  await page.goto(base+'/app');
  await page.getByText('Aún no hay registros en este período.').waitFor();
  await page.getByText('Todavía no hay centros registrados.').waitFor();
  for(const id of ['family','nurse'])insert('INSERT INTO users VALUES(?,?,?,?,?)',id,`${id}@example.test`,`${id} DEMO`,'test-only-no-login','2026-01-01T00:00:00Z');
  for(const [id,name] of [['a','Centro de salud San Miguel (DEMO)'],['b','Clínica Los Olivos (DEMO)']]){
    insert('INSERT INTO clinics(id,name,kind,city,created) VALUES(?,?,?,?,?)',id,name,'posta','Lima','2026-01-01T00:00:00Z');
    insert('INSERT INTO staff_memberships(clinic_id,user_id,role,permissions) VALUES(?,?,?,?)',id,'nurse','nurse','["read_patients"]');
  }
  for(let i=0;i<4;i++){
    insert('INSERT INTO patients(id,user_id,name,birth_date,treatment) VALUES(?,?,?,?,?)',`p${i}`,'family',`Paciente DEMO ${i}`,'2023-01-01','Pauta ficticia');
    if(i<3)insert('INSERT INTO enrollments(id,clinic_id,patient_id,status,created) VALUES(?,?,?,?,?)',`e${i}`,i===1?'b':'a',`p${i}`,['active','requested','closed'][i],'2026-01-01T00:00:00Z');
  }
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
  for(let i=0;i<30;i++){
    const day=new Date(new Date(today+'T12:00:00Z').getTime()-i*86400000).toISOString().slice(0,10);
    for(let n=0;n<(i%4)+1;n++)insert('INSERT INTO records(patient_id,kind,occurred,body,request_key,created) VALUES(?,?,?,?,?,?)',`p${n}`,i%5===0?'difficulty':'dose',day,'Registro ficticio',`r-${i}-${n}`,day+'T12:00:00Z');
  }
  // Reload populates the center picker from the same in-memory fixture.
  await page.reload();await page.locator('.admin-dashboard .admin-metric').first().waitFor();
  async function metric(label,value){assert.equal(await page.locator('.admin-metric').filter({hasText:label}).locator('strong').innerText(),String(value),label);}
  await metric('Centros registrados',2);await metric('Personal activo único',1);await metric('Perfiles de pacientes',4);
  await page.getByRole('button',{name:'Abrir centro',exact:true}).first().click();
  await page.getByRole('button',{name:'Resumen del centro',exact:true}).waitFor();
  await page.getByRole('button',{name:'Dashboard general',exact:true}).click();
  await page.getByText('Resumen de la plataforma',{exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:'Centro de salud',exact:true}).inputValue(),'');
  async function bounds(){const info=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right}))}));assert.ok(info.scroll<=info.width+1,'Dashboard exceeds viewport width: '+JSON.stringify(info));}
  for(const [width,height] of [[1440,1000],[390,844],[320,568]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
    await bounds();
    const labels=await page.locator('.admin-day small').evaluateAll(nodes=>nodes.filter(node=>node.textContent).map(node=>({left:node.getBoundingClientRect().left,right:node.getBoundingClientRect().right})));
    for(let i=1;i<labels.length;i++)assert.ok(labels[i].left>=labels[i-1].right,`Date labels overlap at ${width}px`);
    await page.screenshot({path:resolve(out,`dashboard-${width}x${height}.png`),fullPage:true});
  }
  await page.locator('.admin-dashboard').evaluate(node=>node.style.minWidth='1500px');
  await assert.rejects(bounds,/exceeds viewport/);await page.locator('.admin-dashboard').evaluate(node=>node.style.removeProperty('min-width'));await bounds();
  console.log('RED/GREEN: oversized dashboard mutation caught and restored');
  await page.locator('.admin-data-table summary').click();
  assert.equal(await page.locator('.admin-data-table tbody tr').count(),30);
  await page.route('**/api/v1/platform/overview',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{message:'Error de prueba'}})}));
  await page.getByRole('button',{name:'Actualizar',exact:true}).click();await page.getByRole('alert').filter({hasText:'No se pudo actualizar'}).waitFor();
  await page.unroute('**/api/v1/platform/overview');await page.getByRole('button',{name:'Reintentar',exact:true}).click();
  await page.getByRole('button',{name:'Actualizar',exact:true}).isEnabled();
  await page.waitForTimeout(150);assert.equal(await page.getByRole('alert').count(),0);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  console.log('PASS: empty/real aggregates, direct global navigation, desktop/mobile bounds, daily data table, retry, zero browser writes');
  await context.close();
}finally{await browser.close();app.server.closeAllConnections();await new Promise(done=>app.server.close(done));db.close();}
