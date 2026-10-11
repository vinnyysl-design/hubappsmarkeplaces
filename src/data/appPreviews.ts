/**
 * Configuração central das prévias (vídeos demonstrativos) dos aplicativos.
 *
 * - A chave é o identificador estável do app em apps.json (`slug`).
 * - Todos os campos são opcionais. Sem vídeo, o modal mostra a apresentação
 *   visual com descrição e benefícios do catálogo.
 * - Nunca coloque vídeos genéricos/fictícios como se fossem demonstrações reais.
 *
 * Como associar um MP4: veja docs/VIDEOS-DEMONSTRATIVOS.md
 */
export interface AppPreviewConfig {
  appId: string;
  /** URL do vídeo MP4 (Lovable Assets, link externo direto ou arquivo em /public). */
  videoUrl?: string;
  /** Imagem de capa exibida antes do play (e como apresentação quando não há vídeo). */
  previewImageUrl?: string;
  /** Título opcional; padrão = nome do app. */
  previewTitle?: string;
  /** Descrição opcional; padrão = descrição do catálogo. */
  previewDescription?: string;
  /** Até 3 benefícios; padrão = extraídos do catálogo. */
  benefits?: string[];
  /** Duração exibida, ex.: "1:30". */
  videoDuration?: string;
}

const entries: AppPreviewConfig[] = [
  { appId: "curva-abc" },
  { appId: "fulfillment" },
  { appId: "adsengine" },
  { appId: "precificacao" },
  { appId: "devolucoes" },
  { appId: "conciliacao" },
  { appId: "ponto-equilibrio" },
  { appId: "inteligencia-mercado" },
  { appId: "rentabilidade" },
  { appId: "vision" },
  { appId: "gerador-imagens" },
];

export const APP_PREVIEWS: Record<string, AppPreviewConfig> = Object.fromEntries(
  entries.map((e) => [e.appId, e])
);

export const getAppPreview = (appId: string): AppPreviewConfig | undefined => APP_PREVIEWS[appId];
