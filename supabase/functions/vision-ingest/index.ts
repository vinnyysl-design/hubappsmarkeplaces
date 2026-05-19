// Vision - ingestão de arquivos (PDF, DOCX, DOC, TXT, MD) → vision_knowledge
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import mammoth from "https://esm.sh/mammoth@1.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function extractFromBuffer(name: string, mime: string, buf: ArrayBuffer): Promise<string> {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || mime.startsWith("text/")) {
    return new TextDecoder().decode(buf);
  }
  if (lower.endsWith(".docx") || lower.endsWith(".doc") || mime.includes("word")) {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value ?? "";
  }
  if (lower.endsWith(".pdf") || mime.includes("pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : (text ?? "");
  }
  throw new Error("Formato não suportado. Use PDF, TXT, MD, DOC ou DOCX.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Arquivo obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > 15 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Arquivo maior que 15MB" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = await file.arrayBuffer();
    const raw = await extractFromBuffer(file.name, file.type, buf);
    const content = raw.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    if (!content) {
      return new Response(JSON.stringify({
        error: "Sem texto extraível. O PDF pode ser uma imagem escaneada (precisaria OCR).",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const title = file.name.replace(/\.[^.]+$/, "").slice(0, 120);
    const { error } = await supabase.from("vision_knowledge").insert({
      title,
      app_slug: null,
      content: content.slice(0, 50000),
    });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, title, chars: content.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vision-ingest error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
