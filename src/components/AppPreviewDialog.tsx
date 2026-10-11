import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appIcon, type HubApp } from "@/components/AppCard";

/** Prévia do app com os dados reais cadastrados. Ponto de integração para a futura janela de prévia (vídeo/demonstração). */
export default function AppPreviewDialog({ app, onClose }: { app: HubApp | null; onClose: () => void }) {
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        {app && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary shrink-0">
                  {appIcon(app.icone)}
                </div>
                <div className="min-w-0 text-left">
                  <DialogTitle className="leading-snug">{app.nome}</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {app.categoria} · {app.status}
                    {app.version ? ` · v${app.version}` : ""}
                  </p>
                </div>
              </div>
              <DialogDescription className="text-left pt-2">{app.descricao}</DialogDescription>
            </DialogHeader>
            {app.canais && app.canais.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Marketplaces:</span> {app.canais.join(" · ")}
              </p>
            )}
            {app.aiKnowledge && (
              <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed border-t border-border pt-3">
                {app.aiKnowledge}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
