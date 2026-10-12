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
import curvaVideo from "@/assets/previews/curva-abc-preview.mp4.asset.json";
import curvaCover from "@/assets/previews/curva-abc-cover.jpg.asset.json";
import precificacaoVideo from "@/assets/previews/precificacao-preview.mp4.asset.json";
import precificacaoCover from "@/assets/previews/precificacao-cover.jpg.asset.json";

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
  {
    appId: "curva-abc",
    videoUrl: curvaVideo.url,
    previewImageUrl: curvaCover.url,
    videoDuration: "0:30",
  },
  { appId: "fulfillment" },
  { appId: "adsengine" },
  {
    appId: "precificacao",
    videoUrl: precificacaoVideo.url,
    previewImageUrl: precificacaoCover.url,
    videoDuration: "0:30",
  },
  { appId: "devolucoes" },
  { appId: "painel-financeiro" },
  { appId: "inteligencia-mercado" },
  { appId: "ponto-equilibrio" },
  { appId: "conciliacao" },
  { appId: "vision-x" },
  { appId: "gerador-imagens" },
];

export const APP_PREVIEWS: Record<string, AppPreviewConfig> = Object.fromEntries(
  entries.map((e) => [e.appId, e])
);

export const getAppPreview = (appId: string): AppPreviewConfig | undefined => APP_PREVIEWS[appId];
