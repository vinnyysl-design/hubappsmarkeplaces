// @vitest-environment node
import {afterEach,it,expect,vi} from "vitest";
import {createBoundedQaFetch} from "../lib/qa-bounded-fetch";
afterEach(()=>vi.useRealTimers());
it("fully drains JSON while preserving status and headers",async()=>{
 const result=await createBoundedQaFetch(vi.fn().mockResolvedValue(new Response('{"ok":true}',{status:201,headers:{"content-type":"application/json","x-proof":"yes"}})))("https://qa.invalid");
 expect(result.status).toBe(201);expect(result.headers.get("x-proof")).toBe("yes");expect(await result.json()).toEqual({ok:true});
});
it.each([204,205])("preserves empty logout response %s",async status=>{const result=await createBoundedQaFetch(vi.fn().mockResolvedValue(new Response(null,{status})))("https://qa.invalid");expect(result.status).toBe(status);expect(await result.text()).toBe("");});
it("deadline covers a body stuck after headers and cancels its reader",async()=>{
 vi.useFakeTimers();const cancel=vi.fn();const response=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode("{"));},cancel}));
 const send=vi.fn().mockResolvedValue(response);const pending=createBoundedQaFetch(send)("https://qa.invalid");const assertion=expect(pending).rejects.toMatchObject({name:"AbortError"});
 await vi.advanceTimersByTimeAsync(10001);await assertion;expect(cancel).toHaveBeenCalled();expect(send).toHaveBeenCalledTimes(1);expect((send.mock.calls as any)[0][1].signal.aborted).toBe(true);
});
it("deadline covers network without headers, without retry",async()=>{vi.useFakeTimers();const send=vi.fn(()=>new Promise<Response>(()=>{}));const p=createBoundedQaFetch(send)("https://qa.invalid");const done=expect(p).rejects.toMatchObject({name:"AbortError"});await vi.advanceTimersByTimeAsync(10001);await done;expect(send).toHaveBeenCalledTimes(1);});
it("cancels late headers instead of adopting timed-out response",async()=>{
 vi.useFakeTimers();let resolve!:(r:Response)=>void;const send=vi.fn(()=>new Promise<Response>(r=>{resolve=r;}));const p=createBoundedQaFetch(send)("https://qa.invalid");const done=expect(p).rejects.toMatchObject({name:"AbortError"});await vi.advanceTimersByTimeAsync(10001);await done;
 const cancel=vi.fn();resolve(new Response(new ReadableStream({cancel})));await Promise.resolve();expect(cancel).toHaveBeenCalled();
});
it("rejects external abort while consuming body",async()=>{const cancel=vi.fn(),signal=new AbortController();const send=vi.fn().mockResolvedValue(new Response(new ReadableStream({cancel})));const p=createBoundedQaFetch(send)("https://qa.invalid",{signal:signal.signal});const done=expect(p).rejects.toMatchObject({name:"AbortError"});await Promise.resolve();await Promise.resolve();signal.abort();await done;expect((send.mock.calls as any)[0][1].signal.aborted).toBe(true);expect(cancel).toHaveBeenCalled();});
it("honors Request.signal even when init has none",async()=>{const ac=new AbortController();const req=new Request("https://qa.invalid",{signal:ac.signal});const send=vi.fn(()=>new Promise<Response>(()=>{}));const p=createBoundedQaFetch(send)(req);const done=expect(p).rejects.toMatchObject({name:"AbortError"});ac.abort();await done;expect((send.mock.calls as any)[0][1].signal.aborted).toBe(true);});
it("pre-aborted input never dispatches and produces no unhandled rejection",async()=>{const ac=new AbortController();ac.abort();const send=vi.fn();await expect(createBoundedQaFetch(send)("https://qa.invalid",{signal:ac.signal})).rejects.toMatchObject({name:"AbortError"});expect(send).not.toHaveBeenCalled();});
it("oversized streaming body is cancelled",async()=>{const cancel=vi.fn();const send=vi.fn().mockResolvedValue(new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(65537));},cancel})));await expect(createBoundedQaFetch(send)("https://qa.invalid")).rejects.toThrow("QA_RESPONSE_UNAVAILABLE");expect(cancel).toHaveBeenCalled();});
it("oversized content length is rejected and body cancelled before reading",async()=>{const cancel=vi.fn();const send=vi.fn().mockResolvedValue(new Response(new ReadableStream({cancel}),{headers:{"content-length":"65537"}}));await expect(createBoundedQaFetch(send)("https://qa.invalid")).rejects.toThrow("QA_RESPONSE_UNAVAILABLE");expect(cancel).toHaveBeenCalled();});
it("preserves SDK error status and forces no cookies/no redirects",async()=>{const send=vi.fn().mockResolvedValue(new Response('{"error":"denied"}',{status:401,headers:{"content-type":"application/json"}}));const r=await createBoundedQaFetch(send)("https://qa.invalid",{credentials:"include",redirect:"follow"});expect(r.status).toBe(401);expect(await r.json()).toEqual({error:"denied"});expect((send.mock.calls as any)[0][1]).toMatchObject({credentials:"omit",redirect:"error"});});

import {createClient} from "@supabase/supabase-js";
it("installed SDK profile builder disables automatic GET retry",async()=>{const send=vi.fn().mockResolvedValue(Response.json({message:"offline failure"},{status:520}));const c=createClient("https://qa.example.invalid","sb_publishable_offline_test",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:createBoundedQaFetch(send)}});const result=await c.from("profiles").select("id").retry(false).eq("id","fake-offline-owner").maybeSingle();expect(result.error).not.toBeNull();expect(send).toHaveBeenCalledTimes(1);});
