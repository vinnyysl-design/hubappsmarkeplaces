// Auth event payloads can be late. Re-read the SDK's current session outside
// its callback; logout barrier and event generation guard every completion.
export async function reconcileSessionEvent(ports: {
 current:()=>boolean; allowed:()=>boolean; read:()=>Promise<any>;
 apply:(session:any)=>void; unavailable:()=>void;
}) {
 if(!ports.current()||!ports.allowed())return;
 try {
  const result=await ports.read();
  if(!ports.current()||!ports.allowed())return;
  if(result.error){ports.unavailable();return;}
  ports.apply(result.data?.session??null);
 } catch {if(ports.current()&&ports.allowed())ports.unavailable();}
}
