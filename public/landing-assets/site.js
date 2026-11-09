if(window.matchMedia('(display-mode: standalone)').matches||navigator.standalone)window.location.replace('/app');
const menu=document.querySelector('.menu-toggle');
const links=document.querySelector('.nav-links');
if(menu&&links){menu.addEventListener('click',()=>{const open=links.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});links.addEventListener('click',event=>{if(event.target.closest('a')){links.classList.remove('open');menu.setAttribute('aria-expanded','false');}});}
const form=document.querySelector('#contact-form');
if(form){form.addEventListener('submit',event=>{event.preventDefault();const status=document.querySelector('#form-status');status.textContent='Gracias. Esta es una demostración: tu correo no fue enviado ni guardado.';form.reset();});}
const help=document.querySelector('.preview-help');
const note=document.querySelector('#preview-note');
if(help&&note){help.addEventListener('click',()=>{note.hidden=!note.hidden;help.setAttribute('aria-expanded',String(!note.hidden));});}

if('serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('/fuerte-sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});},{once:true});
