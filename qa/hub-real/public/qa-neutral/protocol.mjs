export const HUB='https://deploy-preview-1--analyticalxhub.netlify.app';
export const APPS=Object.freeze({adsengine:'https://deploy-preview-1--adsenginee.netlify.app','vision-x':'https://deploy-preview-1--visionxagent.netlify.app'});
export const VERSION='neutral-popup-v1';
const exact=(x,keys)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|');
export function start(app,source,nonce,now){
 if(!Object.hasOwn(APPS,app)||!source||!/^[a-f0-9]{32}$/.test(nonce)||!Number.isSafeInteger(now))throw Error('invalid_start');
 return {app,source,nonce,origin:APPS[app],expires:now+60000,phase:'waiting'};
}
export function receive(s,e,now){
 if(s.phase==='passed'||s.phase==='closed')return {s,send:null};
 if(!Number.isSafeInteger(now)||now>=s.expires)return {s:{...s,phase:'closed'},send:null};
 if(e.source!==s.source||e.origin!==s.origin)return {s,send:null};
 const m=e.data;
 if(s.phase==='waiting'&&exact(m,['v','type','app'])&&m.v===VERSION&&m.type==='ready'&&m.app===s.app)
  return {s:{...s,phase:'sent'},send:{v:VERSION,type:'ping',app:s.app,nonce:s.nonce}};
 if(s.phase==='sent'&&exact(m,['v','type','app','nonce'])&&m.v===VERSION&&m.type==='ack'&&m.app===s.app&&m.nonce===s.nonce)
  return {s:{...s,phase:'passed'},send:null};
 return {s,send:null};
}
export function reply(app,opener,e,used){
 const m=e.data;
 if(used||!opener||e.source!==opener||e.origin!==HUB||!Object.hasOwn(APPS,app)||!exact(m,['v','type','app','nonce'])||m.v!==VERSION||m.type!=='ping'||m.app!==app||!/^[a-f0-9]{32}$/.test(m.nonce))return null;
 return {v:VERSION,type:'ack',app,nonce:m.nonce};
}
