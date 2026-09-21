import {randomUUID} from 'node:crypto';
export const PERMISSIONS=['read_patients','write_followups','manage_assignments','manage_staff'];
export const NURSE_PERMISSIONS=['read_patients','write_followups'];
export const CLINIC_SCHEMA=`
CREATE TABLE IF NOT EXISTS platform_admins(user_id TEXT PRIMARY KEY REFERENCES users(id));
CREATE TABLE IF NOT EXISTS clinics(id TEXT PRIMARY KEY,name TEXT NOT NULL,kind TEXT NOT NULL,city TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS staff_memberships(clinic_id TEXT NOT NULL REFERENCES clinics(id),user_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL CHECK(role IN ('clinic_admin','nurse')),permissions TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(clinic_id,user_id));
CREATE TABLE IF NOT EXISTS enrollments(id TEXT PRIMARY KEY,clinic_id TEXT NOT NULL REFERENCES clinics(id),patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id),nurse_user_id TEXT,status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','active','closed')),priority TEXT NOT NULL DEFAULT 'routine' CHECK(priority IN ('routine','followup','priority')),next_followup TEXT,version INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL,FOREIGN KEY(clinic_id,nurse_user_id) REFERENCES staff_memberships(clinic_id,user_id));
CREATE INDEX IF NOT EXISTS enrollments_clinic ON enrollments(clinic_id,status,nurse_user_id);
CREATE TABLE IF NOT EXISTS clinical_events(id INTEGER PRIMARY KEY AUTOINCREMENT,enrollment_id TEXT NOT NULL REFERENCES enrollments(id),user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL CHECK(kind IN ('contact','control','followup')),body TEXT NOT NULL,occurred TEXT NOT NULL,created TEXT NOT NULL,request_key TEXT NOT NULL,UNIQUE(enrollment_id,request_key));
CREATE INDEX IF NOT EXISTS clinical_events_enrollment ON clinical_events(enrollment_id,id);
`;
export function clinicAccess(store,userId,clinicId){
  if(!store.db.prepare('SELECT id FROM clinics WHERE id=? AND active=1').get(clinicId))return null;
  if(store.db.prepare('SELECT user_id FROM platform_admins WHERE user_id=?').get(userId))return {role:'superadmin',permissions:PERMISSIONS};
  const row=store.db.prepare('SELECT role,permissions FROM staff_memberships WHERE clinic_id=? AND user_id=? AND active=1').get(clinicId,userId);
  return row?{role:row.role,permissions:row.role==='clinic_admin'?PERMISSIONS:JSON.parse(row.permissions)}:null;
}
export function workspace(store,userId){
  const superadmin=!!store.db.prepare('SELECT user_id FROM platform_admins WHERE user_id=?').get(userId);
  const memberships=store.db.prepare('SELECT c.id,c.name,c.kind,c.city,m.role,m.permissions FROM staff_memberships m JOIN clinics c ON c.id=m.clinic_id WHERE m.user_id=? AND m.active=1 AND c.active=1 ORDER BY c.name LIMIT 100').all(userId).map(row=>({...row,permissions:row.role==='clinic_admin'?PERMISSIONS:JSON.parse(row.permissions)}));
  return {superadmin,memberships,permissionNames:PERMISSIONS};
}
export async function clinicRoutes({req,url,user,store,send,readJson,check,text,date}){
  const db=store.db,path=url.pathname,method=req.method,root=workspace(store,user.id);
  const input=()=>readJson(req);
  if(path==='/api/v1/workspace'&&method==='GET'){send(200,root);return true;}
  if(path==='/api/v1/centers'&&method==='GET'){send(200,{items:db.prepare('SELECT id,name,kind,city FROM clinics WHERE active=1 ORDER BY name LIMIT 100').all()});return true;}
  if(path==='/api/v1/platform/users'&&method==='GET'){
    check(root.superadmin,'No tienes acceso a la administración global.',403);
    const cursor=Number(url.searchParams.get('after')||0),query=text(url.searchParams.get('q')||'',100,false);check(Number.isSafeInteger(cursor)&&cursor>=0,'Cursor inválido.');
    const rows=db.prepare(`SELECT u.rowid AS cursor,u.id,u.name,u.email,u.created,(SELECT COUNT(*) FROM patients p WHERE p.user_id=u.id) AS profiles,EXISTS(SELECT 1 FROM platform_admins a WHERE a.user_id=u.id) AS superadmin,(SELECT group_concat(c.name,', ') FROM staff_memberships m JOIN clinics c ON c.id=m.clinic_id WHERE m.user_id=u.id AND m.active=1) AS staff_centers,(SELECT group_concat(DISTINCT c.name) FROM patients p JOIN enrollments e ON e.patient_id=p.id JOIN clinics c ON c.id=e.clinic_id WHERE p.user_id=u.id) AS family_centers FROM users u WHERE u.rowid>? AND (u.name LIKE ? OR u.email LIKE ?) ORDER BY u.rowid LIMIT 31`).all(cursor,`%${query}%`,`%${query}%`);
    send(200,{items:rows.slice(0,30),nextCursor:rows.length>30?rows[29].cursor:null,total:db.prepare('SELECT COUNT(*) AS n FROM users').get().n});return true;
  }
  if(path==='/api/v1/platform/clinics'){
    check(root.superadmin,'No tienes acceso a la administración global.',403);
    if(method==='GET'){
      const rows=db.prepare(`SELECT c.*,(SELECT COUNT(*) FROM staff_memberships m WHERE m.clinic_id=c.id AND m.active=1) AS staff_count,(SELECT COUNT(*) FROM enrollments e WHERE e.clinic_id=c.id AND e.status='active') AS patient_count,(SELECT COUNT(*) FROM enrollments e WHERE e.clinic_id=c.id AND e.status='requested') AS pending_count FROM clinics c ORDER BY c.name LIMIT 100`).all();
      send(200,{items:rows});return true;
    }
    if(method==='POST'){
      const b=await input();check(['posta','clinica'].includes(b.kind),'Selecciona posta o clínica.');check(db.prepare('SELECT COUNT(*) AS n FROM clinics').get().n<100,'Límite de centros alcanzado.');
      const id=randomUUID();db.prepare('INSERT INTO clinics(id,name,kind,city,created) VALUES(?,?,?,?,?)').run(id,text(b.name,120),b.kind,text(b.city||'',100,false),new Date().toISOString());store.audit(user.id,'clinic.created',id);send(201,{id});return true;
    }
  }
  const care=path.match(/^\/api\/v1\/patients\/([^/]+)\/care$/);
  if(care){
    const patient=store.patient(user.id,care[1]);check(patient,'No encontrado.',404);
    if(method==='GET'){
      const enrollment=db.prepare('SELECT e.*,c.name AS clinic_name,u.name AS nurse_name FROM enrollments e JOIN clinics c ON c.id=e.clinic_id LEFT JOIN users u ON u.id=e.nurse_user_id WHERE e.patient_id=?').get(patient.id);
      const events=enrollment?db.prepare('SELECT ce.id,ce.kind,ce.body,ce.occurred,u.name AS author FROM clinical_events ce JOIN users u ON u.id=ce.user_id WHERE ce.enrollment_id=? ORDER BY ce.id DESC LIMIT 20').all(enrollment.id):[];
      send(200,{enrollment:enrollment||null,events});return true;
    }
    if(method==='POST'){
      const b=await input();check(b.consent===true,'Confirma que deseas compartir el perfil y sus registros con el centro.');
      check(db.prepare('SELECT id FROM clinics WHERE id=? AND active=1').get(text(b.clinicId,100)),'Centro no encontrado.',404);
      check(!db.prepare('SELECT id FROM enrollments WHERE patient_id=?').get(patient.id),'Este perfil ya tiene una vinculación. Contacta al centro para gestionarla.',409);
      const id=randomUUID();db.prepare('INSERT INTO enrollments(id,clinic_id,patient_id,created) VALUES(?,?,?,?)').run(id,b.clinicId,patient.id,new Date().toISOString());store.audit(user.id,'care.consent_requested',id);send(201,{id});return true;
    }
  }
  const match=path.match(/^\/api\/v1\/clinics\/([^/]+)\/(overview|staff|patients)(?:\/([^/]+))?(?:\/(events))?$/);
  if(!match)return false;
  const [,clinicId,section,id,subresource]=match,access=clinicAccess(store,user.id,clinicId);
  check(access,'Centro no encontrado.',404);
  const can=permission=>access.permissions.includes(permission);
  const requirePermission=permission=>check(can(permission),'Tu rol no tiene permiso para esta acción.',403);
  const manages=can('manage_assignments')||access.role==='superadmin'||access.role==='clinic_admin';
  const scope=manages?'':' AND e.nurse_user_id=?';
  const args=manages?[clinicId]:[clinicId,user.id];
  const summarySQL=`SELECT COUNT(*) AS patients,SUM(CASE WHEN e.status='requested' THEN 1 ELSE 0 END) AS pending,SUM(CASE WHEN e.status='active' AND e.next_followup<=date('now','-5 hours') THEN 1 ELSE 0 END) AS due,SUM(CASE WHEN e.status='active' AND NOT EXISTS(SELECT 1 FROM records r WHERE r.patient_id=e.patient_id AND r.kind='dose' AND r.occurred>=date('now','-5 hours','-2 days')) THEN 1 ELSE 0 END) AS no_recent,SUM(CASE WHEN e.status='active' AND EXISTS(SELECT 1 FROM records r WHERE r.patient_id=e.patient_id AND r.kind='difficulty' AND r.occurred>=date('now','-5 hours','-7 days')) THEN 1 ELSE 0 END) AS difficulties FROM enrollments e WHERE e.clinic_id=? AND e.status!='closed'${scope}`;
  if(section==='overview'&&method==='GET'){
    requirePermission('read_patients');send(200,{clinic:db.prepare('SELECT id,name,kind,city FROM clinics WHERE id=?').get(clinicId),access,summary:db.prepare(summarySQL).get(...args)});return true;
  }
  if(section==='staff'){
    if(method==='GET'){
      check(can('manage_staff')||can('manage_assignments'),'No tienes acceso al equipo.',403);
      send(200,{items:db.prepare('SELECT u.id,u.name,u.email,m.role,m.permissions,m.active,m.version,(SELECT COUNT(*) FROM enrollments e WHERE e.clinic_id=m.clinic_id AND e.nurse_user_id=u.id AND e.status=\'active\') AS patients FROM staff_memberships m JOIN users u ON u.id=m.user_id WHERE m.clinic_id=? ORDER BY u.name LIMIT 100').all(clinicId).map(row=>({...row,permissions:JSON.parse(row.permissions)}))});return true;
    }
    requirePermission('manage_staff');const b=await input();
    check(['clinic_admin','nurse'].includes(b.role),'Rol inválido.');
    check(b.role!=='clinic_admin'||root.superadmin,'Solo el superadministrador puede designar administradores de centro.',403);
    check(Array.isArray(b.permissions)&&b.permissions.every(p=>PERMISSIONS.includes(p))&&new Set(b.permissions).size===b.permissions.length,'Permisos inválidos.');
    check(b.permissions.includes('read_patients'),'El rol requiere acceso a los pacientes asignados.');
    if(!root.superadmin&&access.role!=='clinic_admin')check(b.permissions.every(p=>can(p))&&!b.permissions.includes('manage_staff'),'No puedes delegar permisos de administración.',403);
    const member=method==='POST'?db.prepare('SELECT id FROM users WHERE email=?').get(text(b.email,254).toLowerCase()):db.prepare('SELECT id FROM users WHERE id=?').get(id);
    check(member,'La persona debe crear primero su cuenta en Fuerte.',404);
    const current=db.prepare('SELECT role,version FROM staff_memberships WHERE clinic_id=? AND user_id=?').get(clinicId,member.id);
    check(!current||current.role!=='clinic_admin'||root.superadmin,'Solo el superadministrador puede modificar administradores.',403);
    check(member.id!==user.id,'No puedes modificar tu propio rol desde esta pantalla.',403);
    if(method==='POST'){
      check(!current,'Esta persona ya pertenece al centro.',409);
      db.prepare('INSERT INTO staff_memberships(clinic_id,user_id,role,permissions) VALUES(?,?,?,?)').run(clinicId,member.id,b.role,JSON.stringify(b.permissions));
    }else if(method==='PATCH'){
      check(current&&current.version===b.version,'El equipo cambió. Recarga e intenta nuevamente.',409);check(typeof b.active==='boolean','Estado inválido.');
      db.prepare('UPDATE staff_memberships SET role=?,permissions=?,active=?,version=version+1 WHERE clinic_id=? AND user_id=?').run(b.role,JSON.stringify(b.permissions),b.active?1:0,clinicId,member.id);
    }else return false;
    store.audit(user.id,'staff.permissions_changed',`${clinicId}:${member.id}`);send(200,{ok:true});return true;
  }
  requirePermission('read_patients');
  const patientSelect=`SELECT e.*,p.name,p.birth_date,p.treatment,u.name AS caregiver_name,u.email AS caregiver_email,n.name AS nurse_name,(SELECT MAX(r.occurred) FROM records r WHERE r.patient_id=p.id AND r.kind='dose') AS last_dose,(SELECT MAX(r.occurred) FROM records r WHERE r.patient_id=p.id AND r.kind='difficulty') AS last_difficulty FROM enrollments e JOIN patients p ON p.id=e.patient_id JOIN users u ON u.id=p.user_id LEFT JOIN users n ON n.id=e.nurse_user_id WHERE e.clinic_id=?${scope}`;
  if(!id&&method==='GET'){
    const cursor=Number(url.searchParams.get('after')||0);check(Number.isSafeInteger(cursor)&&cursor>=0,'Cursor inválido.');
    const query=text(url.searchParams.get('q')||'',100,false),filter=url.searchParams.get('filter')||'all';
    const filters={all:" AND e.status!='closed'",pending:" AND e.status='requested'",due:" AND e.status='active' AND e.next_followup<=date('now','-5 hours')",no_recent:" AND e.status='active' AND NOT EXISTS(SELECT 1 FROM records r WHERE r.patient_id=e.patient_id AND r.kind='dose' AND r.occurred>=date('now','-5 hours','-2 days'))",difficulties:" AND e.status='active' AND EXISTS(SELECT 1 FROM records r WHERE r.patient_id=e.patient_id AND r.kind='difficulty' AND r.occurred>=date('now','-5 hours','-7 days'))"};
    check(Object.hasOwn(filters,filter),'Filtro inválido.');
    const rows=db.prepare(patientSelect+filters[filter]+' AND e.rowid>? AND (p.name LIKE ? OR u.name LIKE ?) ORDER BY e.rowid LIMIT 31').all(...args,cursor,`%${query}%`,`%${query}%`);
    const items=rows.slice(0,30),last=items.at(-1);send(200,{items,nextCursor:rows.length>30?db.prepare('SELECT rowid AS cursor FROM enrollments WHERE id=?').get(last.id).cursor:null});return true;
  }
  const enrollment=db.prepare(patientSelect+' AND e.id=?').get(...args,id);check(enrollment,'Paciente no encontrado.',404);
  if(!subresource&&method==='GET'){
    const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);check(Number.isSafeInteger(before)&&before>0,'Cursor inválido.');
    const rows=db.prepare('SELECT id,kind,occurred,body FROM records WHERE patient_id=? AND id<? ORDER BY id DESC LIMIT 31').all(enrollment.patient_id,before);
    const events=db.prepare('SELECT ce.id,ce.kind,ce.body,ce.occurred,u.name AS author FROM clinical_events ce JOIN users u ON u.id=ce.user_id WHERE ce.enrollment_id=? ORDER BY ce.id DESC LIMIT 30').all(id);
    store.audit(user.id,'clinical_record.viewed',id);send(200,{patient:enrollment,records:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null,events});return true;
  }
  if(!subresource&&method==='PATCH'){
    requirePermission('manage_assignments');const b=await input();check(b.version===enrollment.version,'El seguimiento cambió. Recarga antes de guardar.',409);
    check(['active','closed'].includes(b.status),'Estado inválido.');check(['routine','followup','priority'].includes(b.priority),'Prioridad inválida.');
    if(b.nurseId)check(db.prepare('SELECT user_id FROM staff_memberships WHERE clinic_id=? AND user_id=? AND active=1').get(clinicId,text(b.nurseId,100)),'Selecciona una persona activa del mismo centro.');
    const next=b.nextFollowup?date(b.nextFollowup):null;
    db.prepare('UPDATE enrollments SET nurse_user_id=?,status=?,priority=?,next_followup=?,version=version+1 WHERE id=? AND clinic_id=?').run(b.nurseId||null,b.status,b.priority,next,id,clinicId);store.audit(user.id,'care.assignment_changed',id);send(200,{ok:true});return true;
  }
  if(subresource==='events'&&method==='POST'){
    requirePermission('write_followups');check(enrollment.status==='active','El perfil debe estar activo para registrar seguimiento.',409);
    const b=await input(),key=text(req.headers['idempotency-key'],100);check(['contact','control','followup'].includes(b.kind),'Tipo de seguimiento inválido.');const body=text(b.body,2000),occurred=date(b.occurred);check(occurred<=new Date().toISOString().slice(0,10),'No puedes registrar un contacto futuro.');
    const existing=db.prepare('SELECT * FROM clinical_events WHERE enrollment_id=? AND request_key=?').get(id,key);
    if(existing){check(existing.body===body&&existing.kind===b.kind&&existing.occurred===occurred,'Clave de reintento ya utilizada.',409);send(200,{ok:true});return true;}
    const next=b.nextFollowup?date(b.nextFollowup):null;
    if(next)check(b.version===enrollment.version,'El seguimiento cambió. Recarga antes de programar el próximo contacto.',409);
    db.exec('BEGIN');try{
      db.prepare('INSERT INTO clinical_events(enrollment_id,user_id,kind,body,occurred,created,request_key) VALUES(?,?,?,?,?,?,?)').run(id,user.id,b.kind,body,occurred,new Date().toISOString(),key);
      if(next)db.prepare('UPDATE enrollments SET next_followup=?,version=version+1 WHERE id=? AND clinic_id=?').run(next,id,clinicId);
      store.audit(user.id,'clinical_event.created',id);db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    send(201,{ok:true});return true;
  }
  return false;
}
