import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/http.mjs';
import {weekDays} from '../server/week.mjs';
const temp=mkdtempSync(join(tmpdir(),'fuerte-clinic-')),origin='https://fuerte.test';
const app=createApp({dbPath:join(temp,'test.sqlite'),origin,staticRoot:'dist-product',askAI:async()=>''});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}/api/v1`,db=app.store.db;
async function request(path,actor,body,method='POST',key=randomUUID()){
 const response=await fetch(base+path,{method:body===undefined?'GET':method,headers:{Origin:origin,...(actor?{Cookie:actor.cookie}:{}),...(body?{'Content-Type':'application/json','Idempotency-Key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function user(name){const r=await request('/signup',null,{email:name+'@example.test',name,password:randomBytes(24).toString('hex'),consent:true});assert.equal(r.status,200);return {id:r.data.user.id,cookie:r.cookie,email:name+'@example.test'};}
const perms=['read_patients','write_followups'];
try{
 const root=await user('root'),adminA=await user('adminA'),nurseA=await user('nurseA'),nurseB=await user('nurseB'),family=await user('family'),other=await user('other');
 assert.equal((await request('/platform/clinics',root)).status,403,'Signup must not grant global role');
 db.prepare('INSERT INTO platform_admins VALUES(?)').run(root.id);
 assert.equal((await request('/workspace',root)).data.superadmin,true);
 const a=await request('/platform/clinics',root,{name:'Posta A',kind:'posta',city:'Lima'}),b=await request('/platform/clinics',root,{name:'Clinica B',kind:'clinica',city:'Lima'});assert.equal(a.status,201);assert.equal(b.status,201);const aid=a.data.id,bid=b.data.id;
 assert.equal((await request(`/clinics/${aid}/staff`,root,{email:adminA.email,role:'clinic_admin',permissions:perms})).status,200);
 assert.equal((await request(`/clinics/${aid}/staff`,adminA,{email:nurseA.email,role:'nurse',permissions:perms})).status,200);
 assert.equal((await request(`/clinics/${bid}/staff`,root,{email:nurseB.email,role:'nurse',permissions:perms})).status,200);
 assert.equal((await request(`/clinics/${aid}/staff`,adminA,{email:other.email,role:'clinic_admin',permissions:perms})).status,403,'Clinic admin cannot create other admins');
 assert.equal((await request(`/clinics/${bid}/patients`,adminA)).status,404,'Clinic boundary');
 assert.equal((await request(`/clinics/${aid}/staff`,nurseA)).status,403,'Nurse cannot inspect team');
 const child=await request('/patients',family,{name:'Child A',birthDate:'2024-01-01',treatment:'Pauta A'});assert.equal(child.status,201);const pid=child.data.id;
 assert.equal((await request(`/patients/${pid}/care`,other,{clinicId:aid,consent:true})).status,404,'Only owner may share profile');
 assert.equal((await request(`/patients/${pid}/care`,family,{clinicId:aid,consent:false})).status,422);
 const enrollment=await request(`/patients/${pid}/care`,family,{clinicId:aid,consent:true});assert.equal(enrollment.status,201);const eid=enrollment.data.id;
 assert.equal((await request(`/clinics/${aid}/patients`,nurseA)).data.items.length,0,'Unassigned nurse sees no patient');
 assert.equal((await request(`/clinics/${aid}/patients/${eid}`,nurseA)).status,404);
 assert.equal((await request(`/clinics/${aid}/patients/${eid}`,adminA,{version:1,status:'active',priority:'routine',nurseId:nurseB.id,nextFollowup:''},'PATCH')).status,422,'Cannot assign staff from another center');
 assert.equal((await request(`/clinics/${aid}/patients/${eid}`,adminA,{version:1,status:'active',priority:'routine',nurseId:nurseA.id,nextFollowup:'2026-09-21'},'PATCH')).status,200);
 assert.equal((await request(`/clinics/${aid}/patients`,nurseA)).data.items.length,1);
 assert.equal((await request(`/clinics/${bid}/patients/${eid}`,nurseB)).status,404,'Enrollment ID alone never crosses center');
 assert.equal((await request(`/clinics/${aid}/patients/${eid}`,nurseA)).data.patient.name,'Child A');
 const event={kind:'contact',body:'Contacto ficticio con familia',occurred:'2026-09-20'};
 assert.equal((await request(`/clinics/${aid}/patients/${eid}/events`,nurseA,event,'POST','visit-1')).status,201);
 assert.equal((await request(`/clinics/${aid}/patients/${eid}/events`,nurseA,event,'POST','visit-1')).status,200);
 const care=await request(`/patients/${pid}/care`,family);assert.equal(care.data.events.length,1);assert.equal(care.data.events[0].author,'nurseA');
 assert.equal((await request(`/clinics/${aid}/staff/${nurseA.id}`,adminA,{role:'nurse',permissions:perms,active:false,version:1},'PATCH')).status,200);
 assert.equal((await request(`/clinics/${aid}/patients/${eid}`,nurseA)).status,404,'Revocation takes effect immediately');
 const week=weekDays(),day=week.find(x=>x.today).date;
 const dose=await request(`/patients/${pid}/records`,family,{kind:'dose',occurred:day,body:'Prueba semanal'});assert.equal(dose.status,201);
 for(let i=0;i<40;i++)db.prepare('INSERT INTO records(patient_id,kind,occurred,body,request_key,created) VALUES(?,?,?,?,?,?)').run(pid,'note',day,'Registro posterior',randomUUID(),new Date().toISOString());
 const weekly=await request(`/patients/${pid}/week`,family);assert.equal(weekly.data.days.length,7);assert.equal(weekly.data.days.find(x=>x.today).status,'given','Weekly checks must use complete history, not first page');
 assert.equal((await request(`/patients/${pid}/week`,other)).status,404);
 assert.deepEqual(weekDays('2026-09-21').map(d=>d.date),['2026-09-21','2026-09-22','2026-09-23','2026-09-24','2026-09-25','2026-09-26','2026-09-27']);
 console.log('PASS: platform roles, center isolation, nurse assignment, consent, cross-center denial, shared followup, revocation, weekly history beyond pagination');
}finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));db.close();rmSync(temp,{recursive:true,force:true});}
