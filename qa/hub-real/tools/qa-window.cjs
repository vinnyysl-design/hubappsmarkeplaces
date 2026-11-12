const OWNER='3f65242c-b030-4505-aa01-344676f50991';
const FRAMES=Object.freeze(['https://deploy-preview-1--adsenginee.netlify.app','https://deploy-preview-1--visionxagent.netlify.app']);
function validateQaWindow(c,now=Date.now()){
 if(!c||Object.keys(c).sort().join(',')!=='enabled,ownerId,windowEnd,windowStart'||c.ownerId!==OWNER||typeof c.enabled!=='boolean')throw Error('INVALID_QA_WINDOW');
 if(c.enabled===false){if(c.windowStart!==0||c.windowEnd!==0)throw Error('CLOSED_WINDOW_MUST_BE_ZERO');return{...c,frames:[]};}
 if(!Number.isSafeInteger(c.windowStart)||!Number.isSafeInteger(c.windowEnd)||c.windowStart<=0||c.windowEnd<=c.windowStart||c.windowEnd-c.windowStart>7200000||now>=c.windowEnd-65000)throw Error('INVALID_QA_WINDOW');
 return{...c,frames:[...FRAMES]};
}
module.exports={validateQaWindow,FRAMES};
