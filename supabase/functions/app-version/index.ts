// Proxy server-side para buscar version.json de apps externos sem cair em CORS.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { urls } = await req.json();
    if (!Array.isArray(urls)) {
      return new Response(JSON.stringify({ error: "urls deve ser array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await Promise.all(
      urls.map(async (raw: string) => {
        try {
          const base = String(raw).replace(/\/+$/, "");
          const target = `${base}/version.json`;
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(target, { signal: ctrl.signal, redirect: "follow" });
          clearTimeout(t);
          if (!res.ok) return { url: raw, ok: false, status: res.status };
          const data = await res.json().catch(() => null);
          return { url: raw, ok: true, data };
        } catch (e) {
          return { url: raw, ok: false, error: String((e as Error).message ?? e) };
        }
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
