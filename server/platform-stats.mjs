const number=row=>row?.n||0;
const count=(db,sql)=>number(db.prepare(sql).get());

// Dates stored in records are calendar dates. Interpret the reporting window in Lima.
export function platformOverview(db,now=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Lima',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
  const to=`${parts.year}-${parts.month}-${parts.day}`;
  const end=new Date(`${to}T00:00:00Z`);
  const dates=Array.from({length:30},(_,i)=>new Date(end.getTime()-(29-i)*86400000).toISOString().slice(0,10));
  const from=dates[0];
  const totals={
    centers:count(db,'SELECT COUNT(*) AS n FROM clinics'),
    staff:count(db,'SELECT COUNT(DISTINCT m.user_id) AS n FROM staff_memberships m JOIN clinics c ON c.id=m.clinic_id WHERE m.active=1 AND c.active=1'),
    users:count(db,'SELECT COUNT(*) AS n FROM users'),
    caregivers:count(db,'SELECT COUNT(DISTINCT user_id) AS n FROM patients'),
    patients:count(db,'SELECT COUNT(*) AS n FROM patients'),
    active:0,pending:0,closed:0,unenrolled:0,
    doses:count(db,"SELECT COUNT(*) AS n FROM records WHERE kind='dose'"),
    difficulties:count(db,"SELECT COUNT(*) AS n FROM records WHERE kind='difficulty'"),
    notes:count(db,"SELECT COUNT(*) AS n FROM records WHERE kind='note'"),
    appointments:count(db,"SELECT COUNT(*) AS n FROM records WHERE kind='appointment'"),
    clinicalEvents:count(db,'SELECT COUNT(*) AS n FROM clinical_events'),
    messages:count(db,'SELECT COUNT(*) AS n FROM messages')
  };
  const enrollment={active:0,pending:0,closed:0,unenrolled:0};
  for(const row of db.prepare('SELECT status,COUNT(*) AS n FROM enrollments GROUP BY status').all()){
    const key=row.status==='requested'?'pending':row.status;
    if(Object.hasOwn(enrollment,key))enrollment[key]=row.n;
  }
  enrollment.unenrolled=Math.max(0,totals.patients-enrollment.active-enrollment.pending-enrollment.closed);
  Object.assign(totals,enrollment);
  const byDate=new Map(db.prepare("SELECT occurred,SUM(CASE WHEN kind='dose' THEN 1 ELSE 0 END) AS doses,SUM(CASE WHEN kind='difficulty' THEN 1 ELSE 0 END) AS difficulties FROM records WHERE occurred>=? AND occurred<=? AND kind IN ('dose','difficulty') GROUP BY occurred").all(from,to).map(row=>[row.occurred,row]));
  const activity=dates.map(date=>({date,doses:byDate.get(date)?.doses||0,difficulties:byDate.get(date)?.difficulties||0}));
  const centers=db.prepare(`SELECT c.id,c.name,c.kind,c.city,COALESCE(s.staff,0) AS staff,
    COALESCE(e.active,0) AS active,COALESCE(e.pending,0) AS pending,COALESCE(e.closed,0) AS closed
    FROM clinics c
    LEFT JOIN (SELECT clinic_id,COUNT(*) AS staff FROM staff_memberships WHERE active=1 GROUP BY clinic_id) s ON s.clinic_id=c.id
    LEFT JOIN (SELECT clinic_id,SUM(status='active') AS active,SUM(status='requested') AS pending,SUM(status='closed') AS closed FROM enrollments GROUP BY clinic_id) e ON e.clinic_id=c.id
    ORDER BY c.name,c.id LIMIT 100`).all();
  return {updatedAt:now.toISOString(),period:{from,to,days:30,timeZone:'America/Lima'},totals,enrollment,activity,centers};
}
