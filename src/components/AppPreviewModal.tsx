import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Lock, Play } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { appIcon, type HubApp } from "@/components/AppCard";
import AppAccessLink from "@/components/AppAccessLink";

/** Metadados opcionais de prévia por app (campo "preview" em apps.json). */
export interface AppPreviewMeta {
  videoMp4?: string;
  videoWebm?: string;
  poster?: string;
  image?: string;
  benefits?: string[];
}

/** Até 3 benefícios: usa preview.benefits; senão extrai de "Relatórios disponíveis" do catálogo. */
export function getBenefits(app: HubApp & { preview?: AppPreviewMeta }): string[] {
  if (app.preview?.benefits?.length) return app.preview.benefits.slice(0, 3);
  const m = app.aiKnowledge?.match(/Relatórios disponíveis:\s*([^\n]+)/i);
  if (!m) return [];
  return m[1]
    .replace(/\.$/, "")
    .split(/,\s*|\s+e\s+(?=[a-zà-ú])/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

interface Props {
  app: (HubApp & { preview?: AppPreviewMeta }) | null;
  locked?: boolean;
  onClose: () => void;
  /** chamado quando o usuário marca/desmarca "Não mostrar novamente" */
  onDontShowChange?: (id: string, dontShow: boolean) => void;
}

export default function AppPreviewModal({ app, locked, onClose, onDontShowChange }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    setStarted(false);
    setDontShow(false);
    return () => videoRef.current?.pause();
  }, [app]);

  const close = () => {
    videoRef.current?.pause();
    onClose();
  };

  const p = app?.preview;
  const hasVideo = !!(p?.videoMp4 || p?.videoWebm);
  const benefits = app ? getBenefits(app) : [];
  const id = app ? app.slug || app.nome : "";

  const play = () => {
    setStarted(true);
    requestAnimationFrame(() => void videoRef.current?.play().catch(() => {}));
  };

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-3xl w-[calc(100vw-1.5rem)] p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col motion-reduce:animate-none motion-reduce:transition-none">
        {app && (
          <>
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 px-5 py-4 pr-12 border-b border-border">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
                {appIcon(app.icone)}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base leading-snug truncate">{app.nome}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {app.categoria} ·{" "}
                  <span className={app.status === "Beta" ? "text-[hsl(var(--badge-beta-text))]" : "text-[hsl(var(--badge-status-text))]"}>
                    {app.status}
                  </span>
                </p>
              </div>
            </div>

            <div className="overflow-y-auto">
              {/* Mídia 16:9 */}
              <div className="relative aspect-video bg-muted">
                {hasVideo ? (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-contain bg-background"
                      poster={p?.poster || p?.image}
                      controls={started}
                      preload="metadata"
                      playsInline
                    >
                      {p?.videoWebm && <source src={p.videoWebm} type="video/webm" />}
                      {p?.videoMp4 && <source src={p.videoMp4} type="video/mp4" />}
                    </video>
                    {!started && (
                      <button
                        type="button"
                        onClick={play}
                        aria-label={`Reproduzir vídeo de apresentação de ${app.nome}`}
                        className="absolute inset-0 flex items-center justify-center bg-background/30 group"
                      >
                        <span className="flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none">
                          <Play size={26} className="ml-1 fill-current" />
                        </span>
                      </button>
                    )}
                  </>
                ) : p?.image ? (
                  <img src={p.image} alt={`Apresentação de ${app.nome}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 text-center px-6">
                    <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/15 text-primary [&_svg]:w-10 [&_svg]:h-10">
                      {appIcon(app.icone)}
                    </div>
                    <p className="text-lg md:text-xl font-bold text-foreground leading-snug max-w-md">{app.nome}</p>
                    <p className="text-xs text-muted-foreground">Analytical X App Center</p>
                  </div>
                )}
              </div>

              {/* Informações */}
              <div className="px-5 py-4 space-y-4">
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">{app.descricao}</DialogDescription>
                {benefits.length > 0 && (
                  <ul className="space-y-2">
                    {benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                        <CheckCircle2 size={16} className="text-primary mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {app.canais && app.canais.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {app.canais.map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded-md border border-border text-[11px] font-medium text-muted-foreground">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 px-5 py-4 border-t border-border">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer sm:mr-auto">
                <Checkbox
                  checked={dontShow}
                  onCheckedChange={(v) => {
                    setDontShow(!!v);
                    onDontShowChange?.(id, !!v);
                  }}
                />
                Não mostrar esta prévia novamente
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-border text-sm font-medium text-foreground hover:border-primary/40 transition-colors duration-150"
                >
                  <ArrowLeft size={15} /> Voltar ao Hub
                </button>
                {locked ? (
                  <span className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-muted text-muted-foreground text-sm font-semibold cursor-not-allowed" aria-disabled="true">
                    <Lock size={14} /> Bloqueado
                  </span>
                ) : (
                  <AppAccessLink
                    app={app}
                    onClick={() => close()}
                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity duration-150"
                  >
                    Acessar aplicativo <ArrowUpRight size={15} />
                  </AppAccessLink>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
