// Offline-reviewed transport for the dedicated QA SDK client only.
// No response body or credentials are logged. SDK receives only fully buffered data.
export function createBoundedQaFetch(send: typeof fetch = fetch, timeoutMs = 10000, maxBytes = 65536): typeof fetch {
 return async (input,init) => {
  const controller=new AbortController();
  const signals=[init?.signal,typeof Request!=="undefined"&&input instanceof Request?input.signal:null].filter(Boolean) as AbortSignal[];
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  let failed=false;let received:Response|undefined;
  const abort=()=>controller.abort();
  const cancelled=new Promise<never>((_,reject)=>{
   controller.signal.addEventListener("abort",()=>reject(new DOMException("QA request unavailable","AbortError")),{once:true});
  });
  void cancelled.catch(()=>{});
  const timer=setTimeout(abort,timeoutMs);
  for(const signal of signals){signal.addEventListener("abort",abort,{once:true});if(signal.aborted)abort();}
  const guard=()=>{if(controller.signal.aborted)throw new DOMException("QA request unavailable","AbortError");};
  try {
   guard();
   // Late network completion after timeout is cancelled without adopting its body.
   const pending=send(input,{...init,credentials:"omit",redirect:"error",signal:controller.signal});
   void pending.then(response=>{if(controller.signal.aborted)void response.body?.cancel().catch(()=>{});},()=>{});
   const response=await Promise.race([pending,cancelled]);received=response;guard();
   if(response.type==="opaque"||response.type==="opaqueredirect"||response.status===0)throw Error("QA_RESPONSE_UNAVAILABLE");
   const declared=response.headers.get("content-length");
   if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))throw Error("QA_RESPONSE_UNAVAILABLE");
   const chunks:Uint8Array[]=[];let size=0;
   if(response.body){
    reader=response.body.getReader();
    for(;;){
     guard();const chunk=await Promise.race([reader.read(),cancelled]);guard();
     if(chunk.done)break;
     size+=chunk.value.byteLength;if(size>maxBytes)throw Error("QA_RESPONSE_UNAVAILABLE");
     chunks.push(chunk.value);
    }
   }
   guard();
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   // Preserve status/headers, including SDK JSON content type/error status. Empty
   // status codes must use null rather than an empty byte buffer.
   return new Response([101,204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
  } catch(error) {failed=true;abort();throw error;}
  finally {
   clearTimeout(timer);for(const signal of signals)signal.removeEventListener("abort",abort);
   if(!reader&&failed&&received)void received.body?.cancel().catch(()=>{});
   if(reader){if(failed||controller.signal.aborted)void reader.cancel().catch(()=>{});try{reader.releaseLock();}catch{}}
  }
 };
}
