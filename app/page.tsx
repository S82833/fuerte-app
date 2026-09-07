'use client';
/* oxlint-disable next/no-img-element -- Local source assets are shipped with the app and cached offline; no image optimization service is required. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Baby, BookOpen, BriefcaseMedical, Check, ChevronDown, ChevronRight, CircleCheck, CircleHelp, ClipboardList, Clock3, CloudOff, Droplet, Heart, Home, Leaf, Lightbulb, MessageCircle, PackageCheck, RotateCcw, Search, ShieldCheck, Sprout, Stethoscope, UserRound, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { addVisit, dateKey, daysAroundToday, initialState, parseState, patients, recordDose, STORAGE_KEY, type DemoState } from '@/lib/demo-state';

type Route = 'inicio'|'problema'|'retomar'|'dudas'|'salud';
type Modal = {type:'profile'|'anemia'|'support'|'visit'|'history';patient?:string}|null;
const routes:Route[]=['inicio','problema','retomar','dudas','salud'];
const issues=[
 {id:'spit',label:'Lo escupió',icon:Baby,advice:'Podemos anotar lo que pasó para conversarlo en la posta. No fuerces la toma ni repitas la cantidad sin consultar la pauta indicada.'},
 {id:'vomit',label:'Vomitó',icon:Heart,advice:'La orientación depende del momento del vómito y del suplemento. Consulta a tu personal de salud antes de repetir la toma. Si hay vómitos persistentes o mucho decaimiento, busca atención.'},
 {id:'refused',label:'No quiso abrir la boca',icon:Leaf,advice:'Hacer una pausa también es cuidar. Evita forzarlo y pide orientación sobre cómo administrar su suplemento.'},
 {id:'forgot',label:'Me olvidé',icon:Clock3,advice:'Una rutina puede complicarse. Sigue las instrucciones para una dosis olvidada; no dupliques la siguiente toma para compensar.'},
 {id:'empty',label:'Se me acabó el frasco',icon:PackageCheck,advice:'Anotemos que necesitas un nuevo frasco. Coordina el abastecimiento con tu establecimiento de salud.'},
 {id:'belief',label:'Me dijeron que hace daño',icon:MessageCircle,advice:'Tus preguntas importan. Revisa la sección de dudas y conversa con el personal de salud antes de cambiar el tratamiento.'}
];
const restartReasons=['Estuvo enfermito','Viajamos o cambiamos de rutina','Tuve mucho trabajo y se me pasó','Me preocupó un cambio en sus heces o dientes','Otro motivo'];
const faqs=[
 {q:'¿El hierro mancha los dientes?',icon:Baby,a:'Algunas presentaciones líquidas pueden teñirlos temporalmente. Consulta cómo administrarlo y cuidar la higiene bucal según su edad.'},
 {q:'¿Las gotitas pueden causar estreñimiento?',icon:Sprout,a:'El hierro puede causar estreñimiento o molestias digestivas. Si persisten, consulta al personal de salud. No cambies la dosis por tu cuenta.'},
 {q:'¿Y si le molesta la pancita?',icon:Heart,a:'Puede ocurrir malestar con algunos suplementos. La forma de tomarlo depende del producto y de su pauta: pide orientación antes de modificarla.'},
 {q:'¿La caquita oscura significa que le cae mal?',icon:Leaf,a:'El hierro puede oscurecer las heces. Eso no demuestra cuánto hierro absorbe. Si ves sangre, heces alquitranadas o el niño está muy decaído, busca atención.'}
];
const medicalSource='https://www.medicinesforchildren.org.uk/medicines/ferrous-sulfate-for-iron-deficiency-anaemia/';
function readableTime(at:string){return new Date(at).toLocaleString('es-PE',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function Notice({children,kind='gentle'}:{children:ReactNode;kind?:string}){return <div className={`notice ${kind}`}><Leaf size={19}/><div>{children}</div></div>;}

export default function Fuerte(){
 const [route,setRoute]=useState<Route>('inicio');
 const [data,setData]=useState<DemoState|null>(null);
 const dataRef=useRef<DemoState|null>(null);
 const [error,setError]=useState('');
 const [online,setOnline]=useState(true);
 const [offlineReady,setOfflineReady]=useState(false);
 const [today,setToday]=useState('');
 const [toast,setToast]=useState('');
 const [modal,setModal]=useState<Modal>(null);
 const [reason,setReason]=useState('');
 const [restartReason,setRestartReason]=useState('');
 const [filter,setFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [note,setNote]=useState('');
 const [dialogError,setDialogError]=useState('');
 const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [confirmReset,setConfirmReset]=useState(false);
 const [installEvent,setInstallEvent]=useState<(Event & {prompt:()=>Promise<void>})|null>(null);
 const flash=(text:string)=>{setToast(text);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500);};
 function navigate(next:Route){if(!routes.includes(next))return;window.location.hash=next;setRoute(next);window.scrollTo({top:0});setReason('');setDialogError('');}
 function save(next:DemoState){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next));dataRef.current=next;setData(next);setError('');return true;}catch{setError('No pudimos guardar el cambio en este navegador. Revisa el espacio o los permisos e inténtalo de nuevo.');return false;}}
 function dose(status:'given'|'issue',selectedReason?:string){const current=dataRef.current;if(!current)return false;const next=recordDose(current,status,selectedReason);if(next===current)return true;const ok=save(next);if(ok){setToday(dateKey());flash(status==='given'?'Gotitas registradas. Un pasito más, juntas.':'Guardado. Gracias por contarnos lo que pasó.');}return ok;}
 function visit(patient:string,kind:'visit'|'refill'|'support'|'restart',text:string){const current=dataRef.current;if(!current)return false;return save(addVisit(current,{patient,kind,note:text.trim()}));}
 function openModal(next:NonNullable<Modal>){setModal(next);setNote('');setDialogError('');setConfirmReset(false);}
 useEffect(()=>{
  const load=()=>{try{const s=parseState(localStorage.getItem(STORAGE_KEY));dataRef.current=s;setData(s);}catch{setError('Los datos guardados no se pueden abrir. Puedes reiniciar la demo desde el perfil.');}};
  const hash=()=>{const h=window.location.hash.slice(1) as Route;setRoute(routes.includes(h)?h:'inicio');};
  const connectivity=()=>setOnline(navigator.onLine);
  const rollover=()=>setToday(dateKey());
  load();hash();connectivity();rollover();
  window.addEventListener('hashchange',hash);window.addEventListener('online',connectivity);window.addEventListener('offline',connectivity);window.addEventListener('storage',load);document.addEventListener('visibilitychange',rollover);
  const timer=setInterval(rollover,30000);
  const install=(e:Event)=>{e.preventDefault();setInstallEvent(e as Event & {prompt:()=>Promise<void>});};window.addEventListener('beforeinstallprompt',install);
  if(process.env.NODE_ENV==='production'&&'serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(reg=>{reg.active?.postMessage('CACHE_STATUS');}).catch(()=>setOfflineReady(false));}
  const swMessage=(e:MessageEvent)=>{if(e.data?.type==='OFFLINE_READY')setOfflineReady(true);};navigator.serviceWorker?.addEventListener('message',swMessage);
  return()=>{window.removeEventListener('hashchange',hash);window.removeEventListener('online',connectivity);window.removeEventListener('offline',connectivity);window.removeEventListener('storage',load);document.removeEventListener('visibilitychange',rollover);window.removeEventListener('beforeinstallprompt',install);navigator.serviceWorker?.removeEventListener('message',swMessage);clearInterval(timer);if(toastTimer.current)clearTimeout(toastTimer.current);};
 },[]);
 // A small page-scoped API uses the same actions and storage as the visible demo.
 useEffect(()=>{
  type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
  const context=(document as Document & {modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const tools:Tool[]=[
   {name:'fuerte_read_demo',description:'Read the local demonstration records. No real patient data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({today:dateKey(),data:dataRef.current})},
   {name:'fuerte_navigate',description:'Open a Fuerte demo screen, without changing records.',inputSchema:{type:'object',properties:{screen:{type:'string',enum:routes}},required:['screen'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{const r=(input as {screen?:Route})?.screen;if(!r||!routes.includes(r))throw new Error('Pantalla no válida');navigate(r);return {screen:r};}},
   {name:'fuerte_record_demo_dose',description:'Record today’s demonstration dose or issue in this browser only. Does not administer medication or contact anyone.',inputSchema:{type:'object',properties:{status:{type:'string',enum:['given','issue']},reason:{type:'string'}},required:['status'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{const x=input as {status?:string;reason?:string};if(!x||!['given','issue'].includes(x.status||''))throw new Error('Estado no válido');if(x.status==='issue'&&(typeof x.reason!=='string'||!issues.some(i=>i.label===x.reason)))throw new Error('Motivo no válido');if(!dose(x.status as 'given'|'issue',x.reason))throw new Error('No se pudo guardar');return {date:dateKey(),record:dataRef.current?.doses[dateKey()]};}}
  ];
  for(const tool of tools){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Unsupported browser API: standard UI remains available. */}}
  return()=>lifecycle.abort();
 },[]);
 const todayRecord=data?.doses[today];
 const given=todayRecord?.status==='given';
 const selectedIssue=issues.find(i=>i.id===reason);
 const currentPatient=patients.find(p=>p.id===modal?.patient)||patients[0];
 const supportPending=data?.visits.some(v=>v.patient==='thiago'&&v.kind==='support'&&!v.reviewed);
 const childStatus=(id:string)=>id==='thiago'?(given?'Al día':todayRecord?.status==='issue'?'Con dificultad':'En pausa'):id==='gael'&&data?.refills.includes(id)?'Frasco entregado':patients.find(p=>p.id===id)?.status||'';
 const difficult=(id:string)=>!['Al día','Frasco entregado'].includes(childStatus(id));
 const visiblePatients=patients.filter(p=>(filter==='all'||filter==='issues'&&difficult(p.id)||filter==='ok'&&!difficult(p.id))&&`${p.name} ${p.caregiver}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()));
 const pending=data?.visits.filter(v=>!v.reviewed).length||0;
 const subpage=route==='problema'||route==='retomar';
 const routeLabels={inicio:'Inicio',problema:'Registrar lo que pasó',retomar:'Retomar con calma',dudas:'Dudas y mitos',salud:'Personal de salud'};
 return <div className="phone-shell">
 <header className="app-header">{subpage?<div className="back-header"><button className="icon-button" aria-label="Volver al inicio" onClick={()=>navigate('inicio')}><ArrowLeft/></button><div><strong>{routeLabels[route]}</strong><small>Un paso a la vez</small></div></div>:<div className="brand"><img src="/assets/logo.png" alt=""/><div><strong>Fuerte</strong><span><i className={!online?'offline-dot':''}/>{!online?'Sin conexión · en este dispositivo':offlineReady?'Disponible sin conexión':'Tu compañía, cada día'}</span></div></div>}<button className="avatar" aria-label="Abrir perfil y opciones de la demo" onClick={()=>openModal({type:'profile'})}><UserRound size={20}/></button></header>
 <main id="main" className="app-main" key={route}>
 <div className="demo-label"><span/>DEMOSTRACIÓN · DATOS DE EJEMPLO</div>
 {error&&<div className="error-box" role="alert">{error}</div>}
 {route==='inicio'&&<>
 <section className="greeting"><div><p>{new Date().getHours()<12?'Buenos días,':new Date().getHours()<19?'Buenas tardes,':'Buenas noches,'}</p><h1>mamá de Thiago</h1></div><img src="/assets/family.jpg" alt="Mamá y su pequeño"/></section>
 <section className="dose-card card"><div className="dose-heading"><div><span className="today-label">{today?new Date().toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'short'}):'HOY'}</span><h2>{given?<>Un pasito más<br/>por Thiago</>:<>Gotitas de hierro<br/>de hoy</>}</h2></div><div className="drop-circle">{given?<CircleCheck size={29}/>:<Droplet size={30}/>}</div></div><p>{given?'Gracias por cuidar su energía, un día a la vez.':'Para cuidar la energía y las sonrisas de Thiago.'}</p>
 <button className="action primary" onClick={()=>dose('given')} disabled={!data||given}><CircleCheck/>{given?'Listo por hoy':'Ya se lo di'}</button>
 {!given&&<button className="action secondary" onClick={()=>navigate('problema')} disabled={!data}><Leaf size={21}/>{todayRecord?'Ver / cambiar el problema':'Tuve un problema'}</button>}
 {todayRecord?.status==='issue'&&<p className="saved-reason"><Check size={15}/>Anotado: {todayRecord.reason}</p>}
 {given&&<p className="saved-reason"><Check size={15}/>Guardado en este dispositivo · {new Date(todayRecord.at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</p>}
 </section>
 <section className="week-card card"><div className="section-title"><h3>Paso a pasito esta semana</h3><span>Cada día cuenta</span></div><div className="week-strip">{daysAroundToday().map(day=>{const status=data?.doses[day.key]?.status;return <div key={day.key}><span>{day.label}</span><div title={`${day.long}: ${status==='given'?'toma registrada':status==='issue'?'dificultad registrada':'sin registro'}`} aria-label={`${day.long}: ${status==='given'?'toma registrada':status==='issue'?'dificultad registrada':'sin registro'}`} className={`day ${status==='given'?'done':status==='issue'?'issue':''} ${today===day.key?'today':''}`}>{status==='given'?<Check size={18}/>:status==='issue'?<Leaf size={17}/>:today===day.key?'Hoy':<i/>}</div></div>;})}</div><button className="text-button week-link" onClick={()=>openModal({type:'history',patient:'thiago'})}>Ver historial<ArrowRight size={14}/></button></section>
 <aside className="tip-card"><img src="/assets/mandarins.jpg" alt="Mandarinas frescas"/><div><h4><Lightbulb size={16}/>CONSEJO CARIÑOSO</h4><p>Sigue la cantidad y el horario que indicó tu personal de salud. Cada pequeño tiene su propia pauta.</p></div></aside>
 {!given&&<button className="restart-link" onClick={()=>navigate('retomar')}><Sprout size={22}/><span>¿Dejaste las gotitas unos días?<strong>Podemos retomar con calma</strong></span><ChevronRight size={19}/></button>}
 <button className="education-card" onClick={()=>openModal({type:'anemia'})}><span className="heart-circle"><Heart size={23}/></span><span><strong>¿Qué es la anemia?</strong><small>Entendamos juntas el cuidado de Thiago</small></span><ChevronRight size={23}/></button>
 </>}
 {route==='problema'&&<>
 <div className="page-intro"><span className="intro-icon"><Heart size={27}/></span><h1>Tranquila, mamá.<br/>Estamos juntas en esto.</h1><p>Cuéntanos qué pasó hoy para acompañarte mejor.</p></div>
 <Notice>Criar es un camino de muchos pasitos. Anotar una dificultad también es cuidar.</Notice>
 <fieldset className="issue-list"><legend>¿Qué pasó con las gotitas?</legend>{issues.map(item=><div className={`issue-option ${reason===item.id?'selected':''}`} key={item.id}><button aria-expanded={reason===item.id} aria-controls={`advice-${item.id}`} onClick={()=>setReason(item.id)}><item.icon size={22}/><span>{item.label}</span>{reason===item.id?<CircleCheck size={22}/>:<ChevronDown size={20}/>}</button>{reason===item.id&&<div className="advice" id={`advice-${item.id}`}><Lightbulb size={17}/><p>{item.advice}</p></div>}</div>)}</fieldset>
 <p className="form-hint"><ShieldCheck size={17}/>El motivo queda en el historial de este dispositivo.</p><button className="action primary" disabled={!selectedIssue||!data||given} onClick={()=>{if(selectedIssue&&dose('issue',selectedIssue.label))navigate('inicio');}}><Check/>Guardar y volver</button>{given&&<Notice>La toma de hoy ya está registrada. Puedes anotar otra inquietud desde “Pedir orientación”.</Notice>}<button className="text-button centered" onClick={()=>openModal({type:'support'})}>Pedir orientación<ArrowRight size={16}/></button>
 </>}
 {route==='retomar'&&<>
 <div className="restart-art"><img src="/assets/family.jpg" alt="Una madre abraza a su pequeño"/><span><Sprout size={24}/>Cada día es un nuevo comienzo</span></div><div className="page-intro"><h1>Un paso a la vez</h1><p>La rutina se complica y a veces dejamos las gotitas unos días. Aquí puedes contar lo que pasó, sin presiones.</p></div><Notice><strong>Siempre podemos pedir ayuda.</strong><br/>Revisa la pauta con tu personal de salud para retomar. No compenses las tomas anteriores con una dosis extra.</Notice>
 <fieldset className="restart-options"><legend>¿Qué se interpuso estos días?</legend>{restartReasons.map(r=><label key={r}><input type="radio" name="restart" checked={restartReason===r} onChange={()=>setRestartReason(r)}/><span>{r}</span><span className="radio-mark">{restartReason===r&&<Check size={14}/>}</span></label>)}</fieldset>
 <button className="action primary" disabled={!restartReason||!data} onClick={()=>{if(visit('thiago','restart',restartReason)){navigate('inicio');flash('Motivo guardado. Revisa tu pauta antes de retomar.');}}}><Sprout size={21}/>Guardar y volver a mi rutina</button><button className="action secondary" onClick={()=>openModal({type:'support'})}><Stethoscope size={21}/>Quiero orientación</button>
 </>}
 {route==='dudas'&&<>
 <div className="page-intro"><span className="eyebrow"><BookOpen size={16}/>APRENDEMOS JUNTAS</span><h1>Lo que se dice<br/>sobre el hierro</h1><p>Respuestas claras para cuidar con más tranquilidad.</p></div><div className="quote"><Heart size={20}/><p>Una pregunta puede ser el primer paso para sentirte acompañada.</p></div>
 <div className="faq-list">{faqs.map((faq,i)=><details key={faq.q}><summary><span className="faq-icon"><faq.icon size={22}/></span><span><small>DUDA {i+1}</small><strong>{faq.q}</strong></span><ChevronDown size={19}/></summary><div className="faq-answer"><span><CircleCheck size={16}/>La respuesta con calma</span><p>{faq.a}</p></div></details>)}</div>
 <div className="source-note"><ShieldCheck size={20}/><p>Información general, no una pauta individual.<br/><a href={medicalSource} target="_blank" rel="noreferrer">Fuente: Medicines for Children ↗</a></p></div><button className="action secondary" onClick={()=>openModal({type:'support'})}><MessageCircle size={21}/>Tengo otra duda</button>
 </>}
 {route==='salud'&&<>
 <div className="page-intro staff-intro"><span className="eyebrow"><BriefcaseMedical size={17}/>SECTOR 2 · DEMO</span><h1>Cuidar, de cerca</h1><p>P.S. San José · Seguimiento de suplementación</p></div>
 <div className="search-box"><Search size={20}/><input aria-label="Buscar niño o cuidadora" placeholder="Buscar niño o cuidadora" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Limpiar búsqueda" onClick={()=>setQuery('')}><X size={17}/></button>}</div>
 <div className="filter-tabs" aria-label="Filtrar pacientes">{[['all',`Todos (${patients.length})`],['issues',`Con dificultades (${patients.filter(p=>difficult(p.id)).length})`],['ok',`Al día (${patients.filter(p=>!difficult(p.id)).length})`]].map(([id,label])=><button key={id} onClick={()=>setFilter(id)} aria-pressed={filter===id}>{label}</button>)}</div>
 <p className="staff-meta"><Clock3 size={14}/>Lectura rápida para acompañar mejor<span>{visiblePatients.length} niños</span></p>
 <div className="patients">{visiblePatients.map(p=><article className="patient-card" key={p.id}><div className="patient-header"><span className={`initials ${difficult(p.id)?'':'mint'}`}>{p.initials}</span><div><h2>{p.name}</h2><p>{p.age} · Cuidadora: {p.caregiver}</p></div></div><span className={`patient-status ${difficult(p.id)?'attention':'good'}`}><i/>{childStatus(p.id)}</span><p className="patient-reason">{p.id==='thiago'&&given?'Toma de hoy registrada por su cuidadora.':p.id==='thiago'&&todayRecord?.reason?todayRecord.reason:p.reason}</p><div className="patient-tip"><Lightbulb size={17}/><p>{p.action}</p></div>{p.id==='thiago'&&supportPending&&<p className="support-badge"><MessageCircle size={15}/>Gloria dejó una consulta en esta demo</p>}<div className="patient-actions"><button onClick={()=>openModal({type:'visit',patient:p.id})}><ClipboardList size={16}/>Anotar visita</button><button onClick={()=>openModal({type:'history',patient:p.id})} aria-label={`Ver historial de ${p.short}`}><Clock3 size={16}/>Historial</button></div>{p.id==='gael'&&<button className="refill-button" disabled={!data||data.refills.includes(p.id)} onClick={()=>{if(visit(p.id,'refill','Entrega de frasco registrada en la demo.'))flash('Entrega de ejemplo registrada.');}}><PackageCheck size={17}/>{data?.refills.includes(p.id)?'Entrega registrada':'Registrar entrega de frasco'}</button>}</article>)}</div>
 {visiblePatients.length===0&&<div className="empty"><Search size={30}/><h3>No encontramos coincidencias</h3><p>Prueba con otro nombre o cambia el filtro.</p><button className="text-button centered" onClick={()=>{setQuery('');setFilter('all');}}>Ver todos</button></div>}
 <section className="field-card"><div><CloudOff size={26}/><h3>Seguimiento en este dispositivo</h3></div><p>{pending?`${pending} registros nuevos por revisar.`:'Todos los registros nuevos están revisados.'} Esta demo no envía información a una posta.</p><button className="action secondary" disabled={!data||!pending} onClick={()=>{if(data&&save({...data,visits:data.visits.map(v=>({...v,reviewed:true}))}))flash('Registros marcados como revisados, solo aquí.');}}><Check size={19}/>Marcar registros como revisados</button></section>
 </>}
 <p className="page-foot"><Sprout size={14}/>Fuerte · Acompañar también es cuidar</p>
 </main>
 <nav className="bottom-nav" aria-label="Navegación principal">{[{id:'inicio' as Route,label:'Inicio',icon:Home},{id:'dudas' as Route,label:'Dudas y mitos',icon:CircleHelp},{id:'salud' as Route,label:'Personal de salud',icon:BriefcaseMedical}].map(item=><button key={item.id} aria-current={route===item.id||item.id==='inicio'&&subpage?'page':undefined} onClick={()=>navigate(item.id)}><item.icon/><span>{item.label}</span></button>)}</nav>
 {toast&&<output className="toast" aria-live="polite"><CircleCheck size={19}/>{toast}<button aria-label="Cerrar aviso" onClick={()=>setToast('')}><X size={17}/></button></output>}
 <Dialog open={!!modal} onOpenChange={open=>{if(!open)setModal(null);}}><DialogContent className="fuerte-dialog" showCloseButton={false}><button className="dialog-close icon-button" aria-label="Cerrar" onClick={()=>setModal(null)}><X size={21}/></button>
 <DialogTitle>{modal?.type==='profile'?'Tu espacio Fuerte':modal?.type==='anemia'?'Entendamos la anemia':modal?.type==='support'?'Tus dudas importan':modal?.type==='visit'?`Visita a ${currentPatient.short}`:`Historial de ${currentPatient.short}`}</DialogTitle>
 <DialogDescription>{modal?.type==='profile'?'Demostración funcional con datos de ejemplo.':modal?.type==='anemia'?'Información para acompañarte.':modal?.type==='support'?'Escribe lo que te gustaría conversar en la posta.':modal?.type==='visit'?'Anota cómo acompañaste a esta familia.':'Registros disponibles en este navegador.'}</DialogDescription>
 {modal?.type==='profile'&&<><div className="profile-person"><img src="/assets/family.jpg" alt=""/><div><strong>Gloria · mamá de Thiago</strong><small>Familia de ejemplo</small></div></div><Notice>Los registros se guardan en este dispositivo. No hay cuentas reales ni envío de datos al personal de salud.</Notice><p className="small-copy">{offlineReady?'La app está preparada para abrirse sin conexión.':'Para volver a abrir la app, mantén la conexión. Los registros ya guardados se conservan en este navegador.'}</p>{installEvent?<button className="action primary" onClick={async()=>{await installEvent.prompt();setInstallEvent(null);}}>Instalar Fuerte</button>:<p className="small-copy">Puedes añadir Fuerte a tu inicio desde el menú del navegador cuando esté disponible.</p>}{confirmReset?<Notice><p>Esto borra solo los registros de esta demo en este navegador.</p><button className="text-button" onClick={()=>{if(save(initialState())){setModal(null);navigate('inicio');flash('Demo reiniciada con sus datos de ejemplo.');}}}>Sí, reiniciar la demo</button></Notice>:<button className="text-button" onClick={()=>setConfirmReset(true)}><RotateCcw size={16}/>Reiniciar datos de ejemplo</button>}</>}
 {modal?.type==='anemia'&&<><span className="large-heart"><Heart size={32}/></span><p>La anemia ocurre cuando la sangre tiene menos hemoglobina de la necesaria. La falta de hierro es una de sus causas.</p><p>El personal de salud determina la causa y el tratamiento. Si indicó un suplemento, sigue su pauta y acude a los controles.</p><Notice>Esta app acompaña el registro diario. No calcula dosis ni reemplaza la atención médica.</Notice><button className="action primary" onClick={()=>{setModal(null);navigate('dudas');}}>Ver dudas frecuentes<ArrowRight size={18}/></button></>}
 {(modal?.type==='support'||modal?.type==='visit')&&<form onSubmit={e=>{e.preventDefault();if(!note.trim()){setDialogError('Escribe una nota antes de guardarla.');return;}if(visit(modal.type==='support'?'thiago':currentPatient.id,modal.type==='support'?'support':'visit',note)){setModal(null);flash(modal.type==='support'?'Consulta guardada en la demo. No se ha enviado a nadie.':'Visita guardada en este dispositivo.');}}}><label className="note-label" htmlFor="visit-note">{modal.type==='support'?'Mi consulta':'Nota de visita'}</label><textarea id="visit-note" rows={5} maxLength={600} required value={note} onChange={e=>setNote(e.target.value)} placeholder={modal.type==='support'?'Por ejemplo: me cuesta mantener el horario…':'Qué conversaron y qué acompañamiento queda pendiente…'}/><div className="character-count">{note.length}/600</div>{dialogError&&<p role="alert" className="error-box">{dialogError}</p>}<p className="small-copy">Solo datos de ejemplo. El contenido se guarda aquí y no se envía a otras personas.</p><button className="action primary" type="submit" disabled={!note.trim()||!data}><Check size={20}/>Guardar {modal.type==='support'?'consulta':'visita'}</button></form>}
 {modal?.type==='history'&&<div className="history-list">{data&&[...Object.entries(currentPatient.id==='thiago'?data.doses:{}).map(([key,d])=>({id:key,at:d.at,title:d.status==='given'?'Gotitas registradas':'Dificultad registrada',note:d.reason||'Toma anotada por la cuidadora.'})),...data.visits.filter(v=>v.patient===currentPatient.id).map(v=>({id:v.id,at:v.at,title:{visit:'Visita de acompañamiento',refill:'Entrega de frasco',support:'Consulta guardada',restart:'Retomar la rutina'}[v.kind],note:v.note}))].sort((a,b)=>b.at.localeCompare(a.at)).map(v=><article key={v.id}><span className="history-dot"/><div><small>{readableTime(v.at)}</small><h3>{v.title}</h3><p>{v.note}</p></div></article>)}{data&&currentPatient.id!=='thiago'&&!data.visits.some(v=>v.patient===currentPatient.id)&&<div className="empty"><ClipboardList size={28}/><p>Todavía no hay registros de visitas para {currentPatient.short}.</p></div>}</div>}
 </DialogContent></Dialog>
 </div>;
}


