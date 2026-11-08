export default async () => Response.json({error:'qa_not_activated'},{status:503,headers:{'cache-control':'no-store','referrer-policy':'no-referrer'}});
export const config={path:'/api/*'};
