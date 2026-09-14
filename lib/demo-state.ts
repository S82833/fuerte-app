export type Dose = { status: 'given' | 'issue'; reason?: string; at: string };
export type Visit = { id: string; patient: string; kind: 'visit' | 'refill' | 'support' | 'restart'; note: string; at: string; reviewed?: boolean };
export type DemoState = { version: 1; doses: Record<string, Dose>; visits: Visit[]; refills: string[] };
export const STORAGE_KEY = 'fuerte-demo-v1';
export function dateKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function daysAroundToday(now = new Date()) { const start=new Date(now);start.setHours(12,0,0,0);start.setDate(start.getDate()-(start.getDay()+6)%7);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {key:dateKey(d),label:['L','M','M','J','V','S','D'][i],long:d.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})};}); }
export function initialState(now = new Date()): DemoState { const doses:Record<string,Dose>={}; for(const offset of [3,4,6]){const d=new Date(now);d.setDate(d.getDate()-offset);d.setHours(9,0,0,0);doses[dateKey(d)]={status:'given',at:d.toISOString()};}return {version:1,doses,visits:[],refills:[]}; }
export function parseState(raw: string | null, now = new Date()): DemoState {
  if(!raw)return initialState(now);
  const x:unknown=JSON.parse(raw);
  if(!x||typeof x!=='object')throw new Error('Registro no válido');
  const s=x as DemoState;
  if(s.version!==1||!s.doses||typeof s.doses!=='object'||Array.isArray(s.doses)||!Array.isArray(s.visits)||!Array.isArray(s.refills))throw new Error('Registro no válido');
  for(const [key,d] of Object.entries(s.doses))if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!d||!['given','issue'].includes(d.status)||typeof d.at!=='string'||!Number.isFinite(Date.parse(d.at))||(d.reason!==undefined&&typeof d.reason!=='string'))throw new Error('Toma no válida');
  for(const v of s.visits)if(!v||typeof v.id!=='string'||typeof v.patient!=='string'||typeof v.note!=='string'||typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at))||!['visit','refill','support','restart'].includes(v.kind)||(v.reviewed!==undefined&&typeof v.reviewed!=='boolean'))throw new Error('Visita no válida');
  if(s.refills.some(r=>typeof r!=='string'))throw new Error('Entrega no válida');
  return s;
}
export function recordDose(s:DemoState,status:Dose['status'],reason?:string,now=new Date()):DemoState{
  const key=dateKey(now);if(s.doses[key]?.status==='given')return s;
  if(status==='issue'&&!reason?.trim())throw new Error('Elige un motivo');
  return {...s,doses:{...s.doses,[key]:{status,...(status==='issue'?{reason}:{}),at:now.toISOString()}}};
}
export function addVisit(s:DemoState,visit:Omit<Visit,'id'|'at'>,now=new Date()):DemoState{if(!visit.note.trim())throw new Error('Escribe una nota');return {...s,visits:[{...visit,id:crypto.randomUUID(),at:now.toISOString()},...s.visits],refills:visit.kind==='refill'?[...new Set([...s.refills,visit.patient])]:s.refills};}
export const patients=[
 {id:'thiago',name:'Thiago Flores',short:'Thiago',initials:'TF',age:'2 años',caregiver:'Gloria',status:'En pausa',reason:'Se le complicó la rutina de las gotitas.',action:'Escuchar a Gloria y revisar con ella la pauta indicada.'},
 {id:'yamilet',name:'Yamilet Huamán',short:'Yamilet',initials:'YH',age:'2 años y 6 meses',caregiver:'Rosa',status:'Duda familiar',reason:'La familia teme que el hierro manche los dientes de forma permanente.',action:'Conversar sobre esta duda y revisar la higiene bucal.'},
 {id:'gael',name:'Gael Mendoza',short:'Gael',initials:'GM',age:'8 meses',caregiver:'Carmen',status:'Frasco terminado',reason:'Se acabó el suplemento y Carmen no pudo ir a la posta.',action:'Coordinar el abastecimiento con el establecimiento de salud.'},
 {id:'mia',name:'Mia Quispe',short:'Mia',initials:'MQ',age:'1 año y 4 meses',caregiver:'Nely',status:'Al día',reason:'Nely mantiene el seguimiento de su pauta.',action:'Reconocer el esfuerzo y resolver las dudas de la familia.'}
];
