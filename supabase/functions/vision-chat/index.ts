// Vision - Agente especialista do Hub Analytical X
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APPS_KNOWLEDGE = `
APLICATIVOS DISPONÍVEIS NO HUB ANALYTICAL X:

1. Curva ABC, Diagnóstico e Ações (Categoria: Operação)
   - O que faz: Classifica produtos por importância (classes A, B e C) com base no faturamento/volume, faz diagnóstico de performance e sugere ações estratégicas por classe.
   - Como usar: Importe a planilha de vendas, escolha o critério (faturamento, margem ou quantidade) e a ferramenta gera automaticamente a classificação + recomendações.
   - Onde tirar relatórios: Dentro da própria ferramenta, na aba "Diagnóstico" há exportação em Excel/PDF da curva e do plano de ação.

2. Dashboard Fulfillment Estratégico (Categoria: Operação)
   - O que faz: Painel estratégico para acompanhar e gerir operações de fulfillment (estoque em FBA/Full, giro, cobertura, rupturas).
   - Como usar: Conecte ou suba o relatório de estoque do marketplace; o painel mostra KPIs de cobertura, dias de estoque e alertas.
   - Onde tirar relatórios: Aba "Exportar" do dashboard — gera Excel consolidado por SKU/centro de distribuição.

3. AdsEngine (Categoria: Marketing)
   - O que faz: Gerencia e otimiza campanhas de anúncios (Mercado Livre Ads, Amazon Ads etc.) com inteligência aplicada a ACOS, TACOS e palavras-chave.
   - Como usar: Importe o relatório de campanhas, a ferramenta sugere lances, palavras negativas e oportunidades.
   - Onde tirar relatórios: Aba "Relatórios" → exporta performance por campanha, grupo e palavra-chave.

4. Precificação Estratégica (Categoria: Simuladores)
   - O que faz: Calculadora inteligente para definir preços considerando custo, taxas do marketplace, frete, impostos e margem alvo.
   - Como usar: Preencha custo do produto, taxas do canal e a margem desejada; a ferramenta devolve o preço sugerido e o lucro líquido.
   - Onde tirar relatórios: A simulação pode ser baixada em PDF/Excel diretamente da tela de resultado.

5. Gestão de Devolução Inteligente (Categoria: Devoluções)
   - O que faz: Monitora devoluções, identifica os principais motivos e ajuda a reduzir perdas com base em dados.
   - Como usar: Suba o relatório de devoluções do canal; a ferramenta categoriza por motivo, SKU e cliente.
   - Onde tirar relatórios: Aba "Análise" → exporta ranking de motivos e SKUs com mais devolução.

6. Painel Financeiro (Categoria: Relatórios)
   - O que faz: Análise detalhada de vendas, custos, taxas e rentabilidade da operação.
   - Como usar: Importe vendas e custos; o painel mostra DRE simplificada, margem por SKU e evolução mensal.
   - Onde tirar relatórios: Botão "Exportar DRE" na tela principal — gera Excel consolidado.

7. Inteligência de Mercado (Categoria: Relatórios)
   - O que faz: Analisa tamanho de mercado, concorrência e oportunidades para apoiar decisão estratégica.
   - Como usar: Informe categoria/nicho; a ferramenta calcula GMV estimado, principais players e share.
   - Onde tirar relatórios: Tela final tem opção de exportar resumo executivo em PDF.

8. Ponto de Equilíbrio (Categoria: Simuladores)
   - O que faz: Calcula o ponto de equilíbrio (break-even) da operação — quanto precisa vender para cobrir custos.
   - Como usar: Informe custos fixos, custo variável e ticket médio; mostra unidades e faturamento mínimo.
   - Onde tirar relatórios: Resultado pode ser baixado em PDF na própria tela.

9. Conciliação Financeira (Categoria: Relatórios)
   - O que faz: Automatiza conciliação de repasses dos marketplaces, identifica divergências de taxas, fretes e estornos.
   - Como usar: Suba o relatório de repasses + relatório de vendas; a ferramenta cruza linha a linha.
   - Onde tirar relatórios: Aba "Divergências" exporta Excel com tudo que não bateu.

10. Vision X — Especialista em Análise de Anúncios (Categoria: Marketing)
    - O que faz: Agente de IA especialista em análise de anúncios — avalia títulos, imagens, descrição e sugere melhorias.
    - Como usar: Cole o link do anúncio ou faça upload das imagens; o agente devolve diagnóstico e plano de ação.
    - Onde tirar relatórios: O próprio chat gera um resumo que pode ser copiado/baixado.
`;

const SYSTEM_PROMPT = `Você é a Vision, assistente oficial do Hub Analytical X.
Seu papel é ajudar usuários a entender e usar as ferramentas hospedadas no Hub.

Regras:
- Responda sempre em português brasileiro, de forma clara, direta e amigável.
- Use as informações abaixo como única fonte de verdade sobre as ferramentas.
- Se perguntarem algo fora do escopo do Hub, redirecione gentilmente para o tema.
- Quando indicar uma ferramenta, diga o nome exato e em que categoria ela está.
- Se o usuário perguntar onde tirar um relatório, explique passo a passo.
- Seja objetiva: respostas curtas quando possível, listas quando ajudar.

BASE DE CONHECIMENTO:
${APPS_KNOWLEDGE}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Contate o administrador." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway erro: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "Não consegui responder agora.";
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("vision-chat error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
