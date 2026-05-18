CREATE TABLE public.vision_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug text,
  title text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vision_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read knowledge" ON public.vision_knowledge FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert knowledge" ON public.vision_knowledge FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update knowledge" ON public.vision_knowledge FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete knowledge" ON public.vision_knowledge FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER vision_knowledge_updated_at BEFORE UPDATE ON public.vision_knowledge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.vision_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vision_messages_user_idx ON public.vision_messages(user_id, created_at);
ALTER TABLE public.vision_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON public.vision_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.vision_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own messages" ON public.vision_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all messages" ON public.vision_messages FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.vision_knowledge (app_slug, title, content) VALUES
('curva-abc', 'Curva ABC, Diagnóstico e Ações', 'Categoria: Operação. Classifica produtos em classes A, B e C por faturamento/volume, faz diagnóstico de performance e sugere ações estratégicas por classe. Como usar: importar planilha de vendas, escolher critério (faturamento, margem ou quantidade). Relatórios: aba Diagnóstico exporta Excel/PDF da curva e plano de ação.'),
('fulfillment', 'Dashboard Fulfillment Estratégico', 'Categoria: Operação. Painel para acompanhar estoque em FBA/Full, giro, cobertura, rupturas. Como usar: subir relatório de estoque do marketplace. Relatórios: aba Exportar gera Excel por SKU/centro.'),
('adsengine', 'AdsEngine', 'Categoria: Marketing. Gerencia campanhas (Mercado Livre Ads, Amazon Ads) otimizando ACOS, TACOS e palavras-chave. Como usar: importar relatório de campanhas. Relatórios: aba Relatórios exporta performance por campanha, grupo e palavra-chave.'),
('precificacao', 'Precificação Estratégica', 'Categoria: Simuladores. Calcula preço considerando custo, taxas, frete, impostos e margem alvo. Como usar: preencher custo, taxas e margem. Relatórios: PDF/Excel baixáveis na tela de resultado.'),
('devolucoes', 'Gestão de Devolução Inteligente', 'Categoria: Devoluções. Monitora devoluções, identifica motivos e reduz perdas. Como usar: subir relatório de devoluções. Relatórios: aba Análise exporta ranking de motivos e SKUs.'),
('painel-financeiro', 'Painel Financeiro', 'Categoria: Relatórios. Análise de vendas, custos, taxas e rentabilidade. Como usar: importar vendas e custos. Relatórios: botão Exportar DRE gera Excel consolidado.'),
('inteligencia-mercado', 'Inteligência de Mercado', 'Categoria: Relatórios. Calcula tamanho de mercado, concorrência e oportunidades (GMV estimado, players, share). Como usar: informar categoria/nicho. Relatórios: resumo executivo em PDF na tela final.'),
('ponto-equilibrio', 'Ponto de Equilíbrio', 'Categoria: Simuladores. Calcula break-even da operação. Como usar: informar custos fixos, variáveis e ticket médio. Relatórios: PDF baixável na própria tela.'),
('conciliacao', 'Conciliação Financeira', 'Categoria: Relatórios. Automatiza conciliação de repasses dos marketplaces, identifica divergências de taxas, fretes e estornos. Como usar: subir relatórios de repasses + vendas. Relatórios: aba Divergências exporta Excel.'),
('vision-x', 'Vision X — Especialista em Análise de Anúncios', 'Categoria: Marketing. Agente de IA que avalia títulos, imagens, descrição de anúncios e sugere melhorias. Como usar: colar link do anúncio ou subir imagens. Relatórios: resumo no chat, copiável.');