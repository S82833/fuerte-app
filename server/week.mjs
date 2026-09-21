export function weekDays(today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'})){
  const start=new Date(today+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-(start.getUTCDay()+6)%7);
  return Array.from({length:7},(_,index)=>{const day=new Date(start);day.setUTCDate(start.getUTCDate()+index);return {date:day.toISOString().slice(0,10),label:['L','M','M','J','V','S','D'][index],today:day.toISOString().slice(0,10)===today};});
}
export function patientWeek(db,patientId){
  const days=weekDays(),rows=db.prepare("SELECT occurred,MAX(CASE WHEN kind='dose' THEN 1 ELSE 0 END) AS dose,MAX(CASE WHEN kind='difficulty' THEN 1 ELSE 0 END) AS difficulty FROM records WHERE patient_id=? AND occurred>=? AND occurred<=? GROUP BY occurred").all(patientId,days[0].date,days[6].date);
  return days.map(day=>{const row=rows.find(r=>r.occurred===day.date);return {...day,status:row?.dose?'given':row?.difficulty?'issue':'empty',difficulty:!!row?.difficulty};});
}
