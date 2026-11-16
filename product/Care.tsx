import {useEffect,useRef,useState,type SubmitEvent} from 'react';
import {api} from './api';

type Enrollment={clinic_name:string,nurse_name:string|null,status:'requested'|'active'|'closed',next_followup:string|null};
type CareInfo={enrollment:Enrollment|null,events:{id:number,author:string,body:string,occurred:string}[]};
type Center={id:string,name:string,city:string};
type CareView={patientId:string,care:CareInfo|null,loading:boolean,error:string};

export function Care({patientId}:{patientId:string}){
  const [view,setView]=useState<CareView>({patientId,care:null,loading:true,error:''});
  const [centers,setCenters]=useState<Center[]>([]);
  const [busy,setBusy]=useState(false);
  const refreshRef=useRef<(force?:boolean)=>Promise<void>>(async()=>{});
  const patientRef=useRef(patientId);

  useEffect(()=>{
    patientRef.current=patientId;
    let active=true,request=0,inFlight:Promise<void>|null=null;
    function refresh(force=false):Promise<void>{
      if(inFlight&&!force)return inFlight;
      const current=++request;
      const operation=(async()=>{try{
        const care=await api<CareInfo>(`/patients/${patientId}/care`);
        if(!active||current!==request)return;
        setView({patientId,care,loading:false,error:''});
        if(!care.enrollment){
          const list=await api<{items:Center[]}>('/centers');
          if(active&&current===request)setCenters(list.items);
        }
      }catch(error){
        if(!active||current!==request)return;
        setView(previous=>({patientId,care:previous.patientId===patientId?previous.care:null,loading:false,error:(error as Error).message}));
        throw error;
      }})();
      inFlight=operation;
      void operation.then(()=>{if(inFlight===operation)inFlight=null;},()=>{if(inFlight===operation)inFlight=null;});
      return operation;
    }
    refreshRef.current=refresh;
    void refresh().catch(()=>{});
    const onFocus=()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});};
    const onVisible=()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});};
    const onRefresh=(event:Event)=>{
      const promise=refresh(true);
      const waitUntil=(event as CustomEvent<{waitUntil?:(promise:Promise<void>)=>void}>).detail?.waitUntil;
      if(waitUntil)waitUntil(promise);
      else void promise.catch(()=>{});
    };
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    window.addEventListener('fuerte:refresh',onRefresh);
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void refresh().catch(()=>{});},30_000);
    return()=>{
      active=false;
      request++;
      window.clearInterval(timer);
      window.removeEventListener('focus',onFocus);
      document.removeEventListener('visibilitychange',onVisible);
      window.removeEventListener('fuerte:refresh',onRefresh);
    };
  },[patientId]);

  async function join(event:SubmitEvent<HTMLFormElement>){
    event.preventDefault();
    const data=new FormData(event.currentTarget);
    setBusy(true);
    setView(previous=>({...previous,error:''}));
    try{
      await api(`/patients/${patientId}/care`,{clinicId:data.get('center'),consent:data.get('consent')==='on'});
      if(patientRef.current===patientId)await refreshRef.current(true);
    }catch(error){
      if(patientRef.current===patientId)setView(previous=>({...previous,error:(error as Error).message}));
    }finally{
      if(patientRef.current===patientId)setBusy(false);
    }
  }

  const current=view.patientId===patientId?view:{patientId,care:null,loading:true,error:''};
  const enrollment=current.care?.enrollment;
  return <section className="card week-card" aria-label="Tu equipo de salud">
    <h3>Tu equipo de salud</h3>
    {current.loading&&<output className="small-copy">Cargando seguimiento…</output>}
    {current.error&&<><p className="error-box" role="alert">No pudimos actualizar el seguimiento: {current.error}</p><button type="button" className="action secondary" onClick={()=>void refreshRef.current(true).catch(()=>{})}>Reintentar</button></>}
    {enrollment?<>
      <p className="preserve"><strong>{enrollment.clinic_name}</strong></p>
      <output className="small-copy">{enrollment.status==='requested'?'Solicitud enviada. El centro aún debe aceptarla.':enrollment.status==='active'?'Solicitud aceptada. Seguimiento activo.':'Seguimiento cerrado.'}</output>
      {enrollment.status==='active'&&<p className="small-copy">{enrollment.nurse_name?`Profesional asignado: ${enrollment.nurse_name}`:'El centro aún no asignó un profesional responsable.'}</p>}
      {enrollment.next_followup&&<p>Próximo seguimiento: {enrollment.next_followup}</p>}
      {current.care?.events.map(event=><article className="care-event" key={event.id}><small>{event.occurred} · {event.author}</small><p>{event.body}</p></article>)}
    </>:current.care&&centers.length?<form className="product-form" onSubmit={join}>
      <label>Selecciona tu posta o clínica<select name="center" required disabled={busy}><option value="">Seleccionar centro</option>{centers.map(center=><option value={center.id} key={center.id}>{center.name}{center.city?` · ${center.city}`:''}</option>)}</select></label>
      <label className="check-label"><input type="checkbox" name="consent" required disabled={busy}/>Autorizo a este centro y a su equipo asignado a consultar este perfil y sus registros para acompañar el seguimiento.</label>
      <button className="action secondary" disabled={busy}>{busy?'Enviando…':'Solicitar seguimiento'}</button>
    </form>:current.care&&!current.error&&<p className="small-copy">Aquí podrás vincular el perfil con tu centro cuando esté disponible en Fuerte.</p>}
  </section>;
}
