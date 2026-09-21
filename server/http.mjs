import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { openStore, passwordHash, passwordMatches, digest } from './store.mjs';
import {clinicRoutes} from './clinics.mjs';
import {patientWeek} from './week.mjs';

class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const check=(condition,message,status=422)=>{if(!condition)throw new HttpError(status,message);};
const text=(value,max,required=true)=>{check(typeof value==='string' && value.trim().length<=max && (!required||value.trim().length>0),'Revisa los campos del formulario.');return value.trim();};
const date=value=>{check(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value && value<='2100-01-01','La fecha no es válida.');return value;};
export async function readJson(req,max=16384){let raw='';for await(const chunk of req){raw+=chunk;check(Buffer.byteLength(raw)<=max,'Solicitud demasiado grande.',413);}try{return JSON.parse(raw);}catch{throw new HttpError(400,'JSON inválido.');}}
export function createApp({dbPath,origin,staticRoot,askAI,aiStatus=async()=>false,secureCookie=true,registration=true}){
  const store=openStore(dbPath),db=store.db,limits=new Map();let authBusy=false;
  const limit=(key,max,period=60000)=>{const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);const v=limits.get(key)||{count:0,until:now+period};check(++v.count<=max,'Espera un momento antes de volver a intentar.',429);limits.set(key,v);};
  const cookie=(token,age=604800)=>`fuerte_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie?'; Secure':''}`;
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost'),path=url.pathname,method=req.method;
      if(path==='/healthz'&&method==='GET')return send(200,{ok:true});
      if(!path.startsWith('/api/')){
        check(method==='GET'||method==='HEAD','Método no permitido.',405);
        const root=resolve(staticRoot),file=resolve(root,'.'+decodeURIComponent(path==='/'?'/product.html':path));
        check(file.startsWith(root+sep),'No encontrado.',404);
        let bytes;try{bytes=await readFile(file);}catch{throw new HttpError(404,'No encontrado.');}
        const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2'};
        res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});return res.end(method==='HEAD'?undefined:bytes);
      }
      limit(req.socket.remoteAddress,180);
      if(!['GET','HEAD'].includes(method)){
        check(req.headers.origin===origin,'Origen no autorizado.',403);
        check(req.headers['content-type']?.split(';')[0]==='application/json','Se requiere JSON.',415);
      }
      if(['/api/v1/signup','/api/v1/login'].includes(path)&&method==='POST'){
        limit('auth:'+req.socket.remoteAddress,15,15*60000);
        check(!authBusy,'Vuelve a intentar en unos segundos.',429);authBusy=true;
        try{
          const body=await readJson(req),email=text(body.email,254).toLowerCase(),password=text(body.password,128);
          check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Correo inválido.');
          let user;
          if(path.endsWith('signup')){
            check(registration,'Registro cerrado.',403);check(password.length>=12,'Usa una contraseña de al menos 12 caracteres.');
            check(body.consent===true,'Confirma que eres responsable del registro y aceptas su almacenamiento.');
            const name=text(body.name,80),id=store.newId();
            try{db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,email,name,passwordHash(password),new Date().toISOString());}catch{throw new HttpError(409,'No se pudo crear la cuenta. Si ya tienes una, inicia sesión.');}
            user={id,email,name};store.audit(id,'account.created');
          }else{
            user=db.prepare('SELECT * FROM users WHERE email=?').get(email);
            const hash=user?.password||passwordHash('not-a-real-account');
            check(passwordMatches(password,hash)&&user,'Correo o contraseña incorrectos.',401);
          }
          res.setHeader('Set-Cookie',cookie(store.session(user.id)));return send(200,{user:{id:user.id,name:user.name,email:user.email}});
        }finally{authBusy=false;}
      }
      const token=req.headers.cookie?.match(/(?:^|;\s*)fuerte_session=([^;]+)/)?.[1]||'';
      const user=store.userFor(token);check(user,'Inicia sesión para continuar.',401);
      if(path==='/api/v1/me'&&method==='GET')return send(200,{user});
      if(path==='/api/v1/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(token));res.setHeader('Set-Cookie',cookie('',0));return send(200,{ok:true});}
      if(await clinicRoutes({req,url,user,store,send,readJson,check,text,date}))return;
      if(path==='/api/v1/patients'&&method==='GET')return send(200,{items:db.prepare('SELECT id,name,birth_date,treatment,version FROM patients WHERE user_id=? ORDER BY rowid LIMIT 10').all(user.id)});
      if(path==='/api/v1/patients'&&method==='POST'){
        check(db.prepare('SELECT COUNT(*) AS n FROM patients WHERE user_id=?').get(user.id).n<10,'Límite de diez perfiles por cuenta.');
        const b=await readJson(req),id=store.newId(),birth=date(b.birthDate);check(birth<=new Date().toISOString().slice(0,10),'El nacimiento no puede estar en el futuro.');
        db.prepare('INSERT INTO patients(id,user_id,name,birth_date,treatment) VALUES(?,?,?,?,?)').run(id,user.id,text(b.name,80),birth,text(b.treatment||'',2000,false));store.audit(user.id,'patient.created',id);return send(201,store.patient(user.id,id));
      }
      const match=path.match(/^\/api\/v1\/patients\/([^/]+)(?:\/(records|chat|week))?$/);check(match,'No encontrado.',404);
      const [,id,resource]=match,patient=store.patient(user.id,id);check(patient,'No encontrado.',404);
      if(resource==='week'&&method==='GET')return send(200,{days:patientWeek(db,id)});
      if(!resource&&method==='PATCH'){
        const b=await readJson(req);check(b.version===patient.version,'El perfil cambió. Recarga e intenta nuevamente.',409);
        db.prepare('UPDATE patients SET treatment=?,version=version+1 WHERE id=? AND user_id=?').run(text(b.treatment,2000,false),id,user.id);store.audit(user.id,'treatment.recorded',id);return send(200,store.patient(user.id,id));
      }
      if(resource==='records'&&method==='GET'){
        const cursor=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER);check(Number.isSafeInteger(cursor)&&cursor>0,'Cursor inválido.');
        const rows=db.prepare('SELECT id,kind,occurred,body,created FROM records WHERE patient_id=? AND id<? ORDER BY id DESC LIMIT 31').all(id,cursor);
        return send(200,{items:rows.slice(0,30),nextCursor:rows.length>30?rows[29].id:null});
      }
      if(resource==='records'&&method==='POST'){
        const b=await readJson(req),key=text(req.headers['idempotency-key'],100);check(['dose','difficulty','note','appointment'].includes(b.kind),'Tipo de registro inválido.');
        const occurred=date(b.occurred),body=text(b.body||'',2000,false),existing=db.prepare('SELECT * FROM records WHERE patient_id=? AND request_key=?').get(id,key);
        if(existing){check(existing.kind===b.kind&&existing.occurred===occurred&&existing.body===body,'Clave reutilizada con otros datos.',409);return send(200,existing);}
        if(b.kind==='dose')check(occurred<=new Date().toISOString().slice(0,10),'No puedes confirmar una dosis futura.');
        const result=db.prepare('INSERT INTO records(patient_id,kind,occurred,body,request_key,created) VALUES(?,?,?,?,?,?)').run(id,b.kind,occurred,body,key,new Date().toISOString());store.audit(user.id,'record.created',String(result.lastInsertRowid));return send(201,{id:Number(result.lastInsertRowid)});
      }
      if(resource==='chat'&&method==='GET')return send(200,{available:await aiStatus(),items:db.prepare('SELECT id,role,body,created FROM messages WHERE patient_id=? ORDER BY id DESC LIMIT 30').all(id).reverse()});
      if(resource==='chat'&&method==='POST'){
        limit('chat:'+user.id,10,3600000);const b=await readJson(req);check(b.consent===true,'Autoriza el envío de contexto a OpenAI antes de usar el chat.');const message=text(b.message,1500);
        const answer=await askAI({context:store.context(user.id,id),message});check(typeof answer==='string'&&answer.length>0&&answer.length<=12000,'El asistente no respondió. Intenta nuevamente.',503);
        db.exec('BEGIN');try{const insert=db.prepare('INSERT INTO messages(patient_id,role,body,created) VALUES(?,?,?,?)'),now=new Date().toISOString();insert.run(id,'user',message,now);insert.run(id,'assistant',answer,now);store.audit(user.id,'chat.completed',id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send(200,{answer});
      }
      throw new HttpError(405,'Método no permitido.');
    }catch(error){const status=error.status||503;if(status===429)res.setHeader('Retry-After','60');send(status,{error:{message:error.status?error.message:'Servicio temporalmente no disponible. Tus registros se conservan.'}});}
  });
  server.requestTimeout=20000;server.headersTimeout=10000;
  return {server,store};
}
