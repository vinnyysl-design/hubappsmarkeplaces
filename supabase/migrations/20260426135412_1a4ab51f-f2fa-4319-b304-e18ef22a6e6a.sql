-- Tabela de page views
CREATE TABLE public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  path text NOT NULL,
  referrer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_user_id ON public.page_views (user_id);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own page views"
  ON public.page_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de cliques em ferramentas
CREATE TABLE public.tool_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tool_id text NOT NULL,
  tool_name text NOT NULL,
  tool_category text,
  tool_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_clicks_created_at ON public.tool_clicks (created_at DESC);
CREATE INDEX idx_tool_clicks_tool_id ON public.tool_clicks (tool_id);
CREATE INDEX idx_tool_clicks_user_id ON public.tool_clicks (user_id);

ALTER TABLE public.tool_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own tool clicks"
  ON public.tool_clicks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tool clicks"
  ON public.tool_clicks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));