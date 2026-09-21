import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync} from 'node:crypto';

// Explicit, fictional showcase dataset. Stable IDs prevent duplicate loads.
const PREFIX='fuerte-demo-v1';
const db=new DatabaseSync(process.env.DATABASE_PATH||'/data/fuerte.sqlite');
db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
const counts=()=>({centers:db.prepare('SELECT COUNT(*) AS n FROM clinics WHERE id LIKE ?').get(PREFIX+'%').n,staff:db.prepare('SELECT COUNT(*) AS n FROM staff_memberships WHERE clinic_id LIKE ?').get(PREFIX+'%').n,caregivers:db.prepare('SELECT COUNT(*) AS n FROM users WHERE id LIKE ?').get(PREFIX+'-family-%').n,children:db.prepare('SELECT COUNT(*) AS n FROM patients WHERE id LIKE ?').get(PREFIX+'%').n,records:db.prepare('SELECT COUNT(*) AS n FROM records WHERE patient_id LIKE ?').get(PREFIX+'%').n});
if(counts().centers){console.log(JSON.stringify({alreadySeeded:true,...counts()}));db.close();process.exit(0);}
const now=new Date(),stamp=now.toISOString(),base=new Date(now.toLocaleDateString('en-CA',{timeZone:'America/Lima'})+'T12:00:00Z');
const day=offset=>{const d=new Date(base);d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);};
const centers=[['Posta Semilla · DEMO','posta','Los Olivos, Lima'],['Clínica Horizonte · DEMO','clinica','San Miguel, Lima'],['Posta Crecer · DEMO','posta','Comas, Lima']];
const staffNames=[['Elena Vargas','Mariana Torres','Carolina Paredes'],['Ricardo Molina','Lucía Rojas','Paola Salazar'],['Gabriela Medina','Andrea Cárdenas','Rosa Valverde']];
const familyNames=[['Gloria Alvarado','Patricia Quispe','Daniela Flores','Miguel Salas'],['Ana Huamán','Luis Castro','Carmen Rivas','Sofía León'],['María Ramos','Jorge Vega','Valeria Soto','Diana Campos']];
const childNames=[['Thiago Alvarado','Luciana Quispe','Mateo Flores','Valentina Salas','Emilia Alvarado','Sebastián Quispe'],['Camila Huamán','Nicolás Castro','Antonella Rivas','Adrián León','Gabriel Huamán','Mía Castro'],['Benjamín Ramos','Isabella Vega','Santiago Soto','Alessia Campos','Lucas Ramos','Emma Vega']];
// Demo identities cannot be signed into with a shared/published default password.
const salt=randomBytes(16).toString('hex'),hash=`${salt}:${scryptSync(randomBytes(32).toString('hex'),salt,32).toString('hex')}`;
process.umask(0o077);
if(process.env.DATABASE_PATH!==':memory:')db.prepare('VACUUM INTO ?').run((process.env.DATABASE_PATH||'/data/fuerte.sqlite')+'.before-demo-'+Date.now()+'.bak');
db.exec('BEGIN IMMEDIATE');
try{
  const addUser=(id,name)=>db.prepare('INSERT INTO users(id,email,name,password,created) VALUES(?,?,?,?,?)').run(id,id+'@example.invalid',name+' (Demo)',hash,stamp);
  for(let ci=0;ci<centers.length;ci++){
    const clinicId=`${PREFIX}-center-${ci+1}`,[name,kind,city]=centers[ci];
    db.prepare('INSERT INTO clinics(id,name,kind,city,created) VALUES(?,?,?,?,?)').run(clinicId,name,kind,city,stamp);
    for(let si=0;si<3;si++){
      const uid=`${PREFIX}-staff-${ci+1}-${si+1}`;addUser(uid,staffNames[ci][si]);
      db.prepare('INSERT INTO staff_memberships(clinic_id,user_id,role,permissions) VALUES(?,?,?,?)').run(clinicId,uid,si===0?'clinic_admin':'nurse',JSON.stringify(si===0?['read_patients','write_followups','manage_assignments','manage_staff']:['read_patients','write_followups']));
    }
    for(let fi=0;fi<4;fi++)addUser(`${PREFIX}-family-${ci+1}-${fi+1}`,familyNames[ci][fi]);
    for(let pi=0;pi<6;pi++){
      const patientId=`${PREFIX}-child-${ci+1}-${pi+1}`,familyId=`${PREFIX}-family-${ci+1}-${pi%4+1}`,enrollmentId=`${PREFIX}-care-${ci+1}-${pi+1}`,nurseId=`${PREFIX}-staff-${ci+1}-${pi%2+2}`;
      const status=pi===5?'requested':'active',next=[-1,0,2,4,1,0][pi];
      db.prepare('INSERT INTO patients(id,user_id,name,birth_date,treatment) VALUES(?,?,?,?,?)').run(patientId,familyId,childNames[ci][pi]+' (Demo)',`${2023+pi%2}-${String(2+ci+pi).padStart(2,'0')}-${String(10+pi).padStart(2,'0')}`,'DEMOSTRACIÓN: seguimiento de una pauta de hierro indicada por un profesional ficticio. Sin dosis clínica real; no utilizar como indicación médica.');
      db.prepare('INSERT INTO enrollments(id,clinic_id,patient_id,nurse_user_id,status,priority,next_followup,created) VALUES(?,?,?,?,?,?,?,?)').run(enrollmentId,clinicId,patientId,status==='active'?nurseId:null,status,pi===1?'priority':pi===2?'followup':'routine',status==='active'?day(next):null,stamp);
      const record=(kind,offset,body)=>db.prepare('INSERT INTO records(patient_id,kind,occurred,body,request_key,created) VALUES(?,?,?,?,?,?)').run(patientId,kind,day(offset),'DEMO: '+body,`${PREFIX}-${kind}-${offset}`,stamp);
      if(status==='active'){
        for(let ago=13;ago>=0;ago--){if(pi===2&&ago<4)continue;if(pi===1&&ago===1)continue;if(pi===3&&ago%3===0)continue;record('dose',-ago,'El cuidador registró la toma conforme a la pauta simulada.');}
        if(pi===1||pi===3)record('difficulty',-1,pi===1?'La cuidadora reportó una dificultad con la toma y solicitó acompañamiento.':'La familia informó que olvidó completar un registro y necesita apoyo para organizar su rutina.');
        record('appointment',-7,'Se registró un control de seguimiento ficticio.');
        record('note',-2,'La familia preparó sus preguntas para el próximo contacto con enfermería.');
        for(const offset of [-7,-2])db.prepare('INSERT INTO clinical_events(enrollment_id,user_id,kind,body,occurred,created,request_key) VALUES(?,?,?,?,?,?,?)').run(enrollmentId,nurseId,offset===-7?'control':'contact',offset===-7?'DEMO: se revisaron los registros con el cuidador durante un control simulado.':'DEMO: se contactó a la familia y se acordó revisar sus dudas en el próximo seguimiento.',day(offset),stamp,`${PREFIX}-event-${offset}`);
      }
    }
  }
  db.prepare('INSERT INTO audit(user_id,event,target,created) VALUES(NULL,?,?,?)').run('demo.seeded_by_owner_request',PREFIX,stamp);
  const integrity=db.prepare('PRAGMA foreign_key_check').all();if(integrity.length)throw Error('Foreign key validation failed');
  db.exec('COMMIT');console.log(JSON.stringify({created:true,fictional:true,...counts()}));
}catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
