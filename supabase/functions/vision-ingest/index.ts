// Vision - ingestão de arquivos (PDF, DOCX, DOC, TXT, MD) → vision_knowledge
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getResolvedPDFJS } from "https://esm.sh/unpdf@1.6.2";
import mammoth from "https://esm.sh/mammoth@1.8.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeText = (value: string) =>
  value
    .replace(/\u0000/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function extractPdfText(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);

  try {
    const { text } = await extractText(bytes, { mergePages: true });
    const normalized = normalizeText(typeof text === "string" ? text : text.join("\n\n"));
    if (normalized) return normalized;
  } catch (error) {
    console.error("vision-ingest pdf extractText failed", error);
  }

  try {
    const { getDocument } = await getResolvedPDFJS();
    const pdf = await getDocument(bytes).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      const normalized = normalizeText(pageText);
      if (normalized) pages.push(normalized);
    }

    return pages.join("\n\n");
  } catch (error) {
    console.error("vision-ingest pdf pdfjs fallback failed", error);
    return "";
  }
}

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
    return extractPdfText(buf);
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
    const content = normalizeText(raw);

    if (!content) {
      return new Response(JSON.stringify({
        error: "Não consegui extrair texto deste arquivo. Se for um PDF escaneado, protegido ou só com imagens, ele precisa de OCR antes do envio.",
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
