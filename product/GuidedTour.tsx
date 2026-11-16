/* eslint-disable react/react-compiler -- The tour coordinates existing DOM targets and native click handlers after React commits. */
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {consumeTourRequest,hasSeenTour,hasUnsavedTourWork,markTourSeen} from './tour-state.mjs';
import './guided-tour.css';

type Step={title:string,copy:string,target?:string,action?:boolean,button?:string};
const steps:Step[]=[
  {title:'Un paso a la vez',copy:'Conoce Fuerte tocando sus controles. Este recorrido no guardará dosis, registros ni cambios de pauta.',button:'Empezar'},
  {title:'La dosis y la semana',copy:'Confirma una dosis solo después de administrarla según la pauta real. El resumen semanal muestra tus registros. Aquí solo estamos mirando; no tocaremos el botón de dosis.',target:'dose-card',button:'Entendido'},
  {title:'Tu historia',copy:'Toca Historial para ver los registros de este perfil.',target:'nav-historial',action:true},
  {title:'Abre un registro',copy:'Toca Agregar registro. Solo veremos el formulario; no guardaremos nada.',target:'add-record',action:true},
  {title:'Registra lo que ocurrió',copy:'Aquí puedes anotar una observación, dificultad o control. Elige la fecha y escribe el detalle cuando lo necesites.',target:'record-editor',button:'Entendido'},
  {title:'Vuelve al inicio',copy:'Toca Inicio para seguir con la vista diaria.',target:'nav-inicio',action:true},
  {title:'La pauta del profesional',copy:'Toca este botón para conocer dónde se actualizan las indicaciones.',target:'edit-treatment',action:true},
  {title:'Copia la indicación',copy:'Este espacio guarda la pauta que te dio el profesional. No calculamos ni cambiamos dosis. Dejaremos el formulario sin guardar.',target:'treatment-editor',button:'Entendido'},
  {title:'Acompañamiento',copy:'Toca Acompañamiento para conocer el chat.',target:'nav-chat',action:true},
  {title:'Tú decides',copy:'El chat pide una autorización separada antes de enviar información a OpenAI. El recorrido no marca la casilla ni envía mensajes.',target:'chat-consent',button:'Finalizar'},
];

function targetFor(step:Step){return step.target?document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`):null;}
function rectFor(element:HTMLElement|null){if(!element)return null;const r=element.getBoundingClientRect();return {top:r.top,left:r.left,width:r.width,height:r.height};}
type Box={top:number;left:number;width:number;height:number};
const gap=16;
function spotlight(rect:Box,viewport:{width:number;height:number}):Box|null{
  const left=Math.max(4,rect.left-5),top=Math.max(4,rect.top-5);
  const right=Math.min(viewport.width-4,rect.left+rect.width+5),bottom=Math.min(viewport.height-4,rect.top+rect.height+5);
  return right>left&&bottom>top?{left,top,width:right-left,height:bottom-top}:null;
}
function placeCard(box:Box|null,size:Box,viewport:{width:number;height:number}):{top:number;left:number}{
  const width=Math.min(size.width,viewport.width-24),height=Math.min(size.height,viewport.height-24);
  if(!box)return {left:Math.max(12,(viewport.width-width)/2),top:Math.max(12,(viewport.height-height)/2)};
  const clamp=(n:number,max:number)=>Math.max(12,Math.min(max-12,n));
  const positions=[
    {top:box.top+box.height+gap,left:clamp(box.left,viewport.width-width)},
    {top:box.top-height-gap,left:clamp(box.left,viewport.width-width)},
    {top:clamp(box.top,viewport.height-height),left:box.left+box.width+gap},
    {top:clamp(box.top,viewport.height-height),left:box.left-width-gap},
  ];
  const fits=positions.filter(p=>p.top>=12&&p.left>=12&&p.top+height<=viewport.height-12&&p.left+width<=viewport.width-12);
  if(fits.length)return fits[0];
  // A tall form cannot fit beside a card on a narrow screen. Keep the card
  // above or below the most useful visible part and let the page scroll.
  const topSpace=box.top-12,bottomSpace=viewport.height-(box.top+box.height)-12;
  if(topSpace>=bottomSpace)return {top:12,left:clamp(box.left,viewport.width-width)};
  return {top:viewport.height-height-12,left:clamp(box.left,viewport.width-width)};
}

export function GuidedTour({userId,ready,hasPatient,request,tab,onNavigate,onResetEditors,onFinish}:{userId:string;ready:boolean;hasPatient:boolean;request:number;tab:string;onNavigate:(tab:string)=>void;onResetEditors:()=>void;onFinish:()=>void}){
  const [index,setIndex]=useState<number|null>(null);
  const [rect,setRect]=useState<ReturnType<typeof rectFor>>(null);
  const [cardSize,setCardSize]=useState({width:320,height:260});
  const [viewport,setViewport]=useState({width:window.innerWidth,height:window.innerHeight});
  const [empty,setEmpty]=useState(false);
  const seenRequest=useRef(request);
  const shownEmpty=useRef(false);
  const dismissed=useRef<string|null>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  const card=useRef<HTMLDialogElement|null>(null);

  useEffect(()=>{if(!ready||index!==null)return;
    if(hasUnsavedTourWork(document))return;
    const forced=consumeTourRequest(window.location,window.history);
    const manual=request!==seenRequest.current;
    seenRequest.current=request;
    if(!forced&&!manual&&dismissed.current===userId)return;
    let seen=true;try{seen=hasSeenTour(window.localStorage,userId);}catch{seen=false;}
    if(!forced&&!manual&&seen)return;
    if(!hasPatient&&shownEmpty.current&&!forced&&!manual)return;
    returnFocus.current=document.activeElement instanceof HTMLElement&&document.activeElement!==document.body?document.activeElement:null;
    if(!hasPatient){shownEmpty.current=true;setEmpty(true);return;}
    if(tab!=='inicio')onNavigate('inicio');
    setIndex(0);
  },[ready,index,request,userId,hasPatient,tab,onNavigate]);

  useEffect(()=>{if(hasPatient)shownEmpty.current=false;},[hasPatient]);
  useEffect(()=>{if(index===null)return;const step=steps[index],target=targetFor(step);
    if(step.action&&target){const listener=()=>{window.setTimeout(()=>setIndex(value=>value===index?index+1:value),0);};target.addEventListener('click',listener);return()=>target.removeEventListener('click',listener);}
  },[index,tab]);

  useLayoutEffect(()=>{if(index===null)return;const step=steps[index];let frame=0;const update=()=>{const target=targetFor(step);
    if(step.action&&target&&!target.closest('.bottom-nav')){
      const nav=document.querySelector<HTMLElement>('.bottom-nav')?.getBoundingClientRect();
      const targetRect=target.getBoundingClientRect();
      if(nav&&nav.top>window.innerHeight/2&&nav.top<window.innerHeight&&targetRect.bottom>nav.top-8){
        window.scrollBy({top:targetRect.bottom-nav.top+8,behavior:'instant'});
      }
    }
    setRect(rectFor(target));setViewport({width:window.innerWidth,height:window.innerHeight});};
    const move=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
    const target=targetFor(step);
    const tallOnNarrowScreen=!!target&&window.innerWidth<960&&target.offsetHeight>window.innerHeight*.55;
    target?.scrollIntoView({block:tallOnNarrowScreen?'start':'center',behavior:'instant'});
    if(target&&window.innerWidth<960){
      const targetRect=target.getBoundingClientRect();
      const fitsAbove=targetRect.top-cardSize.height-gap>=12;
      const fitsBelow=targetRect.bottom+cardSize.height+gap<=window.innerHeight-12;
      if(!fitsAbove&&!fitsBelow){
        const shortfall=cardSize.height+gap+12-targetRect.top;
        if(shortfall>0)window.scrollBy({top:-shortfall,behavior:'instant'});
      }
    }
    update();window.addEventListener('resize',move);window.addEventListener('scroll',move,true);
    const observer=new ResizeObserver(move);if(target)observer.observe(target);observer.observe(document.body);
    return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',move);window.removeEventListener('scroll',move,true);observer.disconnect();};
  },[index,tab,cardSize.height]);
  useLayoutEffect(()=>{if(!card.current)return;const observer=new ResizeObserver(()=>setCardSize({width:card.current!.offsetWidth,height:card.current!.offsetHeight}));observer.observe(card.current);return()=>observer.disconnect();},[index,empty]);

  useEffect(()=>{if(index===null&&!empty)return;const keys=(event:KeyboardEvent)=>{
    if(event.key==='Escape'){event.preventDefault();end(true);return;}
    if(event.key!=='Tab')return;
    const target=index!==null&&steps[index].action?targetFor(steps[index]):null;
    const focusables=[...(target?[target]:[]),...(Array.from(card.current?.querySelectorAll<HTMLButtonElement>('button')||[]))];
    if(!focusables.length)return;
    const current=focusables.indexOf(document.activeElement as HTMLElement);
    const next=event.shiftKey?(current<=0?focusables.length-1:current-1):(current<0||current===focusables.length-1?0:current+1);
    event.preventDefault();focusables[next].focus();
  };document.addEventListener('keydown',keys,true);return()=>document.removeEventListener('keydown',keys,true);});
  useLayoutEffect(()=>{if(index===null&&!empty)return;const element=(index!==null&&steps[index].action?targetFor(steps[index]):null)||card.current;element?.focus({preventScroll:true});},[index,empty,tab]);

  function end(mark:boolean){if(mark){dismissed.current=userId;try{markTourSeen(window.localStorage,userId);}catch{/* Private storage can be unavailable. */}}setIndex(null);setEmpty(false);onFinish();window.setTimeout(()=>returnFocus.current?.isConnected?returnFocus.current.focus():document.querySelector<HTMLElement>('[data-tour="tour-replay"]')?.focus(),0);}
  function previous(){
    if(index===null||index===0)return;
    if(index===9||index===8){onNavigate('inicio');onResetEditors();setIndex(6);return;}
    if(index===6){setIndex(2);return;}
    if(index===4||index===7)onResetEditors();
    setIndex(index-1);
  }
  const step=index===null?null:steps[index];
  if(!step&&!empty)return null;
  const box=rect&&step?.target?spotlight(rect,viewport):null;
  const cardPosition=placeCard(box,{...cardSize,left:0,top:0},viewport);
  const cardBottom=cardPosition.top+Math.min(cardSize.height,viewport.height-24);
  const cardRight=cardPosition.left+Math.min(cardSize.width,viewport.width-24);
  const overlaps=!!box&&cardPosition.left<box.left+box.width&&cardRight>box.left&&cardPosition.top<box.top+box.height&&cardBottom>box.top;
  const visibleBox=box&&overlaps?{
    ...box,
    ...(cardPosition.top<=box.top?{top:Math.min(box.top+box.height,cardBottom+gap),height:Math.max(0,box.top+box.height-cardBottom-gap)}:{height:Math.max(0,cardPosition.top-box.top-gap)})
  }:box;
  return <div className="guided-tour" data-tour-active="true">
    {visibleBox&&visibleBox.height>0? <>
      <div className="guided-tour-shade" style={{top:0,left:0,right:0,height:visibleBox.top}} aria-hidden="true"/>
      <div className="guided-tour-shade" style={{top:visibleBox.top+visibleBox.height,left:0,right:0,bottom:0}} aria-hidden="true"/>
      <div className="guided-tour-shade" style={{top:visibleBox.top,left:0,width:visibleBox.left,height:visibleBox.height}} aria-hidden="true"/>
      <div className="guided-tour-shade" style={{top:visibleBox.top,left:visibleBox.left+visibleBox.width,right:0,height:visibleBox.height}} aria-hidden="true"/>
      <div className="guided-tour-hole" data-mode={step?.action?'action':'read'} style={visibleBox} aria-hidden="true"/>
    </>:<div className="guided-tour-shade" style={{inset:0}} aria-hidden="true"/>}
    <dialog ref={card} open tabIndex={-1} className="guided-tour-card" aria-label="Recorrido de Fuerte" style={cardPosition}>
      <div className="guided-tour-top"><span>GUÍA DE CUIDADO</span><button type="button" onClick={()=>end(true)} aria-label="Omitir tutorial">Omitir</button></div>
      {empty?<><p className="guided-tour-count">Primer paso</p><h2>Prepara su espacio</h2><p>Primero crea un perfil infantil con datos ficticios para esta demostración. Después, Fuerte continuará el recorrido automáticamente.</p><div className="guided-tour-actions"><button type="button" className="guided-tour-next" onClick={()=>end(false)}>Entendido</button></div></>:<><p className="guided-tour-count">PASO {index!+1} DE {steps.length}</p><h2>{step!.title}</h2><p>{step!.copy}</p><div className="guided-tour-actions">{index!>0&&<button type="button" onClick={previous}>Anterior</button>}{step!.action&&rect?<span className="guided-tour-hint">Toca el área iluminada ↗</span>:step!.action?<button type="button" className="guided-tour-next" onClick={()=>{onNavigate('inicio');setIndex(0);}}>Volver al inicio</button>:<button type="button" className="guided-tour-next" onClick={()=>index===steps.length-1?end(true):setIndex(index!+1)}>{step!.button||'Siguiente'}</button>}</div></>}
    </dialog>
  </div>;
}
