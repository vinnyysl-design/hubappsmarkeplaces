// Vision - chat com streaming SSE, knowledge dinâmico e memória por usuário
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_PROMPT = `Você é o Vision, agente oficial da Analytical X.
Ajude os usuários do Hub a entender e usar as ferramentas hospedadas.

## Regras de conteúdo
- Responda em português brasileiro, claro e acolhedor.
- Use APENAS a base de conhecimento abaixo como fonte de verdade.
- Se a pergunta estiver fora do escopo, redirecione gentilmente.
- Cite o nome exato da ferramenta e a categoria.
- Para "onde tirar relatório", dê passo a passo numerado.

## Regras de formatação (MUITO IMPORTANTE — use sempre Markdown limpo)
- Comece com 1 frase curta que responda direto à pergunta.
- Use **negrito** apenas em nomes de ferramentas, menus, botões e termos-chave. Nunca em frases inteiras.
- Use listas com "- " para enumerar itens. Use "1." quando a ordem importa (passo a passo).
- Quebre em parágrafos curtos (máx 2-3 linhas cada).
- Use títulos "### " somente quando a resposta tiver 2+ seções distintas.
- NÃO use tabelas, NÃO use blocos de código, NÃO use emojis em excesso (no máximo 1 por resposta).
- Termine com 1 linha final oferecendo ajuda só se fizer sentido.
- Mantenha respostas enxutas: vá direto ao ponto, sem rodeios nem repetições.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // cliente com o JWT do usuário (RLS aplicada)
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const message: string = body?.message;
    const apps: Array<{
      slug?: string;
      nome?: string;
      categoria?: string;
      status?: string;
      descricao?: string;
      url?: string;
      aiKnowledge?: string;
    }> = Array.isArray(body?.apps) ? body.apps : [];

    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Base dinâmica vinda do apps.json (fonte de verdade do catálogo)
    const appsBlock = apps
      .map((a) => {
        const head = `### ${a.nome ?? a.slug}${a.categoria ? ` — ${a.categoria}` : ""}${a.status ? ` [${a.status}]` : ""}`;
        const meta = [
          a.slug ? `slug: ${a.slug}` : null,
          a.url ? `url: ${a.url}` : null,
          a.descricao ? `descrição: ${a.descricao}` : null,
        ].filter(Boolean).join("\n");
        const deep = a.aiKnowledge?.trim() ? `\n${a.aiKnowledge.trim()}` : "";
        return `${head}\n${meta}${deep}`;
      })
      .join("\n\n");

    // 2) Conhecimento extra editável pelo admin (vision_knowledge)
    const { data: knowledge } = await supabase
      .from("vision_knowledge")
      .select("title, content, app_slug")
      .order("title");

    const knowledgeBlock = (knowledge ?? [])
      .map((k) => `### ${k.title}${k.app_slug ? ` (slug: ${k.app_slug})` : ""}\n${k.content}`)
      .join("\n\n");

    // 2) Carrega últimas 20 mensagens do usuário (memória)
    const { data: history } = await supabase
      .from("vision_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    const historyAsc = (history ?? []).reverse();

    // 3) Salva a mensagem nova do usuário
    await supabase.from("vision_messages").insert({
      user_id: userId, role: "user", content: message,
    });

    const systemPrompt = `${BASE_PROMPT}\n\n# CATÁLOGO DE FERRAMENTAS DO HUB (fonte primária)\n${appsBlock || "(vazio)"}\n\n# CONHECIMENTO COMPLEMENTAR (curado pelo admin)\n${knowledgeBlock || "(vazio)"}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...historyAsc,
          { role: "user", content: message },
        ],
      }),
    });

    if (aiResponse.status === 429) {
      return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um pouco." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResponse.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Avise o administrador." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResponse.ok || !aiResponse.body) {
      const t = await aiResponse.text();
      throw new Error(`AI gateway erro: ${aiResponse.status} ${t}`);
    }

    // 4) Faz proxy do SSE para o cliente e acumula o texto para salvar no banco
    let fullText = "";
    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const raw of lines) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (data === "[DONE]") continue;
              try {
                const j = JSON.parse(data);
                const delta = j.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                }
              } catch {
                // ignora linhas inválidas
              }
            }
          }
          // salva resposta completa
          if (fullText) {
            await supabase.from("vision_messages").insert({
              user_id: userId, role: "assistant", content: fullText,
            });
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("vision-chat error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
