import { useEffect, useMemo, useState } from "react";
import { Sparkles, Plus, RefreshCw, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import apps from "@/data/apps.json";
import { useAuth } from "@/contexts/AuthContext";

type App = (typeof apps)[number] & { version?: string; whatsNew?: string };

type ChangeKind = "novo" | "atualizado" | "link";

interface ChangeItem {
  app: App;
  kind: ChangeKind;
  detail?: string;
}

const STORAGE_PREFIX = "hub:lastSeenApps:";

// Resolved metadata per app: version + whatsNew (remote overrides static).
type AppMeta = { v: string; u: string; whatsNew?: string };

async function fetchRemoteMeta(app: App): Promise<Partial<AppMeta>> {
  // Apps "external" são abertos em nova guia (não são iframáveis); evitamos
  // CORS desnecessário, usamos só os metadados locais.
  if ((app as any).external) return {};
  try {
    const base = app.url.replace(/\/+$/, "");
    const res = await fetch(`${base}/version.json`, {
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Partial<AppMeta> = {};
    if (typeof data?.version === "string") out.v = data.version;
    if (typeof data?.whatsNew === "string") out.whatsNew = data.whatsNew;
    return out;
  } catch {
    return {};
  }
}

async function buildSignatureMap(): Promise<Record<string, AppMeta>> {
  const entries = await Promise.all(
    (apps as App[]).map(async (a) => {
      const remote = await fetchRemoteMeta(a);
      const meta: AppMeta = {
        v: remote.v ?? a.version ?? "1.0.0",
        u: a.url,
        whatsNew: remote.whatsNew ?? a.whatsNew,
      };
      return [a.slug, meta] as const;
    })
  );
  return Object.fromEntries(entries);
}

export default function WhatsNewDialog() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [currentMap, setCurrentMap] = useState<Record<string, AppMeta> | null>(null);

  const storageKey = useMemo(
    () => (user ? `${STORAGE_PREFIX}${user.id}` : null),
    [user]
  );

  useEffect(() => {
    if (loading || !storageKey) return;
    let cancelled = false;

    (async () => {
      const current = await buildSignatureMap();
      if (cancelled) return;
      setCurrentMap(current);
      runDiff(current);
    })();

    return () => {
      cancelled = true;
    };

    function runDiff(current: Record<string, AppMeta>) {
    const raw = localStorage.getItem(storageKey);

    // First login ever: save baseline silently, no popup
    if (!raw) {
      localStorage.setItem(storageKey, JSON.stringify(current));
      return;
    }

    let previous: Record<string, { v: string; u: string }> = {};
    try {
      previous = JSON.parse(raw);
    } catch {
      localStorage.setItem(storageKey, JSON.stringify(current));
      return;
    }

    const diffs: ChangeItem[] = [];
    (apps as App[]).forEach((app) => {
      const prev = previous[app.slug];
      const curr = current[app.slug];
      if (!prev) {
        diffs.push({ app, kind: "novo" });
      } else if (prev.v !== curr.v) {
        diffs.push({
          app,
          kind: "atualizado",
          detail: `v${prev.v} → v${curr.v}`,
        });
      } else if (prev.u !== curr.u) {
        diffs.push({ app, kind: "link", detail: "Novo endereço" });
      }
    });

    if (diffs.length > 0) {
      setChanges(diffs);
      setOpen(true);
    } else {
      // Keep storage fresh (in case slugs were removed)
      localStorage.setItem(storageKey, JSON.stringify(current));
    }
  }, [loading, storageKey]);

  const handleClose = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(buildSignatureMap()));
    }
    setOpen(false);
  };

  if (changes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : setOpen(o))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Sparkles className="text-primary" size={18} />
            </div>
            <div>
              <DialogTitle>O que há de novo</DialogTitle>
              <DialogDescription>
                Atualizações desde sua última visita
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <ul className="space-y-3">
            {changes.map(({ app, kind, detail }) => (
              <li
                key={app.slug}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50"
              >
                <div className="text-2xl leading-none mt-0.5">{app.icone}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-foreground truncate">
                      {app.nome}
                    </p>
                    {kind === "novo" && (
                      <Badge variant="secondary" className="gap-1">
                        <Plus size={10} /> Novo
                      </Badge>
                    )}
                    {kind === "atualizado" && (
                      <Badge variant="secondary" className="gap-1">
                        <RefreshCw size={10} /> Atualizado
                      </Badge>
                    )}
                    {kind === "link" && (
                      <Badge variant="secondary" className="gap-1">
                        <Link2 size={10} /> Link
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                    {kind !== "novo" && app.whatsNew ? app.whatsNew : app.descricao}
                  </p>
                  {detail && (
                    <p className="text-[11px] text-primary/80 mt-1 font-mono">
                      {detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
