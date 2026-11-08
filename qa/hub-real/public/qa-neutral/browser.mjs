import {APPS,HUB,VERSION,start,receive,reply} from './protocol.mjs';
const out=document.getElementById('result');
const state=new Map();
const say=t=>out.textContent=t;
if(location.origin===HUB){
 for(const app of Object.keys(APPS)){
  const b=document.createElement('button');b.textContent='Verificar janela '+app;
  b.onclick=()=>{
   b.disabled=true;
   const w=window.open(APPS[app]+'/qa-neutral/index.html','_blank');
   if(!w){say(app+': popup bloqueado; nenhum teste executado');return;}
   const nonce=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
   const s=start(app,w,nonce,Date.now());state.set(app,s);
   say(app+': aguardando pagina privada (60 segundos)');
   setTimeout(()=>{const x=state.get(app);if(x&&x.phase!=='passed'){state.set(app,{...x,phase:'closed'});say(app+': expirado, nao repetir automaticamente');}},60000);
  };document.body.append(b);
 }
 window.addEventListener('message',e=>{
  for(const [app,s] of state){const r=receive(s,e,Date.now());state.set(app,r.s);if(r.send)s.source.postMessage(r.send,s.origin);if(s.phase!=='passed'&&r.s.phase==='passed')say(app+': comunicacao neutra confirmada. Nao valida SSO.');}
 });
 window.addEventListener('pagehide',()=>{for(const [app,s] of state)state.set(app,{...s,phase:'closed'});});
}else{
 const app=Object.keys(APPS).find(k=>APPS[k]===location.origin);let used=false;const expires=Date.now()+60000;
 if(!app||!window.opener){say('Origem nao autorizada ou vinculo com Hub ausente. Nenhum teste executado.');}
 else{
  say('Pagina privada carregada. Clique para teste neutro.');
  const b=document.createElement('button');b.textContent='Confirmar comunicacao neutra';
  b.onclick=()=>{b.disabled=true;if(Date.now()>=expires){say('Expirado');return;}window.opener.postMessage({v:VERSION,type:'ready',app},HUB);};document.body.append(b);
  window.addEventListener('message',e=>{if(Date.now()>=expires)return;const m=reply(app,window.opener,e,used);if(m){used=true;window.opener.postMessage(m,HUB);say('Confirmacao neutra enviada. Nenhuma credencial ou SSO usado.');}});
  window.addEventListener('pagehide',()=>{used=true;});
 }
}
