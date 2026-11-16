import assert from 'node:assert/strict';
import {createApp} from '../server/http.mjs';

const app=createApp({dbPath:':memory:',origin:'https://fuerte.test',staticRoot:'dist-product',askAI:async()=>''});
const db=app.store.db;
const insert=(sql,...values)=>db.prepare(sql).run(...values);
const timestamp='2026-01-01T00:00:00.000Z';
const users=['root','admin','nurse','family','other'];
async function get(actor){const cookie=actor?`fuerte_session=${app.store.session(actor)}`:'';const response=await fetch(`${base}/platform/overview`,{headers:{Cookie:cookie}});return {status:response.status,body:await response.json()};}
let base='';
try{
  for(const id of users)insert('INSERT INTO users VALUES(?,?,?,?,?)',id,`${id}@example.test`,id,'fixture-password',timestamp);
  insert('INSERT INTO platform_admins VALUES(?)','root');
  for(const id of ['a','b'])insert('INSERT INTO clinics(id,name,kind,city,created) VALUES(?,?,?,?,?)',id,`Centro ${id}`,'posta','Lima',timestamp);
  for(const [clinic,user,active] of [['a','admin',1],['a','nurse',1],['b','nurse',1],['b','admin',0]])insert('INSERT INTO staff_memberships(clinic_id,user_id,role,permissions,active) VALUES(?,?,?,?,?)',clinic,user,user==='admin'?'clinic_admin':'nurse','[]',active);
  for(const [patient,user] of [['p1','family'],['p2','family'],['p3','other'],['p4','family']])insert('INSERT INTO patients(id,user_id,name,birth_date,treatment) VALUES(?,?,?,?,?)',patient,user,`Private ${patient}`,'2024-01-01','Secret treatment');
  for(const [id,clinic,patient,status] of [['e1','a','p1','active'],['e2','a','p2','requested'],['e4','b','p4','closed']])insert('INSERT INTO enrollments(id,clinic_id,patient_id,status,created) VALUES(?,?,?,?,?)',id,clinic,patient,status,timestamp);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}/api/v1`;
  const empty=await get('root');assert.equal(empty.status,200);const {from,to}=empty.body.period;
  const outside=new Date(`${from}T00:00:00Z`);outside.setUTCDate(outside.getUTCDate()-1);
  for(const [patient,kind,occurred,key] of [['p1','dose',to,'r1'],['p1','dose',to,'r2'],['p1','difficulty',to,'r3'],['p2','dose',outside.toISOString().slice(0,10),'r4']])insert('INSERT INTO records(patient_id,kind,occurred,body,request_key,created) VALUES(?,?,?,?,?,?)',patient,kind,occurred,'Private clinical text',key,timestamp);
  insert('INSERT INTO clinical_events(enrollment_id,user_id,kind,body,occurred,created,request_key) VALUES(?,?,?,?,?,?,?)','e1','nurse','contact','Private event',to,timestamp,'c1');
  insert('INSERT INTO messages(patient_id,role,body,created) VALUES(?,?,?,?)','p1','assistant','Private message',timestamp);
  for(const [kind,key] of [['note','n1'],['appointment','a1']])insert('INSERT INTO records(patient_id,kind,occurred,body,request_key,created) VALUES(?,?,?,?,?,?)','p1',kind,to,'Private clinical text',key,timestamp);
  assert.equal((await get()).status,401);
  for(const id of ['family','nurse','admin'])assert.equal((await get(id)).status,403,`${id} cannot read global statistics`);
  const response=await get('root');assert.equal(response.status,200);const data=response.body;
  assert.deepEqual(data.enrollment,{active:1,pending:1,closed:1,unenrolled:1});
  assert.equal(data.totals.centers,2);assert.equal(data.totals.staff,2,'One user in two centers is counted once');
  assert.equal(data.totals.users,5);assert.equal(data.totals.caregivers,2);assert.equal(data.totals.patients,4);
  assert.equal(data.totals.doses,3);assert.equal(data.totals.difficulties,1);assert.equal(data.totals.clinicalEvents,1);assert.equal(data.totals.messages,1);
  assert.equal(data.totals.notes,1);assert.equal(data.totals.appointments,1);
  assert.equal(data.activity.length,30);assert.equal(data.activity[0].date,from);assert.equal(data.activity.at(-1).date,to);
  assert.equal(data.activity.at(-1).doses,2);assert.equal(data.activity.at(-1).difficulties,1);
  assert.equal(data.activity.reduce((sum,day)=>sum+day.doses,0),2,'Old records excluded from trend');
  assert.deepEqual(data.centers.map(c=>[c.id,c.staff,c.active,c.pending,c.closed]),[['a',2,1,1,0],['b',1,0,0,1]]);
  const json=JSON.stringify(data);for(const secret of ['Private','Secret treatment','@example.test'])assert.equal(json.includes(secret),false,'No patient or account content in global response');
  console.log('PASS: global role guard, distinct counts, enrollment states, center aggregates, Lima 30-day trend, privacy');
}finally{app.server.closeAllConnections();if(app.server.listening)await new Promise(resolve=>app.server.close(resolve));db.close();}
