export default async () => new Response(JSON.stringify({error:'sso_not_activated'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
export const config={path:['/api/tool-sso/*','/api/adsengine/*']};
