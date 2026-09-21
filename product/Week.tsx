import {useEffect,useState} from 'react';
import {Check,Leaf,ArrowRight} from 'lucide-react';
import {api} from './api';
type Day={date:string,label:string,today:boolean,status:'given'|'issue'|'empty',difficulty:boolean};
export function Week({patientId,revision,onHistory}:{patientId:string,revision:unknown,onHistory:()=>void}){
  const [days,setDays]=useState<Day[]>([]),[error,setError]=useState('');
  useEffect(()=>{let active=true;api<{days:Day[]}>(`/patients/${patientId}/week`).then(result=>{if(active){setDays(result.days);setError('');}}).catch(()=>{if(active)setError('No pudimos cargar esta semana.');});return()=>{active=false;};},[patientId,revision]);
  return <section className="week-card card" aria-label="Registro semanal de dosis"><div className="section-title"><h3>Paso a pasito esta semana</h3><span>Cada día cuenta</span></div>{error?<p role="alert">{error}</p>:<div className="week-strip">{days.map(day=>{const label=`${new Date(day.date+'T12:00:00').toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})}: ${day.status==='given'?'dosis registrada':day.status==='issue'?'dificultad registrada':'sin registro'}${day.difficulty&&day.status==='given'?'; también hay una dificultad registrada':''}`;return <div key={day.date}><span>{day.label}</span><div className={`day ${day.status==='given'?'done':day.status==='issue'?'issue':''} ${day.today?'today':''}`} title={label} aria-label={label}>{day.status==='given'?<Check size={18}/>:day.status==='issue'?<Leaf size={17}/>:day.today?'Hoy':<i/>}</div></div>;})}</div>}<button className="text-button week-link" onClick={onHistory}>Ver historial <ArrowRight size={14}/></button><p className="small-copy">Los checks corresponden a las dosis que registraste.</p></section>;
}
