import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, X, Loader2, Trash2 } from "lucide-react";
import visionLogo from "@/assets/vision-logo.gif";
import { useAuth } from "@/contexts/AuthContext";
import appsData from "@/data/apps.json";

type Msg = { role: "user" | "assistant"; content: string };

// Envia apenas os campos úteis para o Vision (base de conhecimento dinâmica)
const APPS_PAYLOAD = (appsData as Array<Record<string, unknown>>).map((a) => ({
  slug: a.slug,
  nome: a.nome,
  categoria: a.categoria,
  status: a.status,
  descricao: a.descricao,
  url: a.url,
  aiKnowledge: a.aiKnowledge ?? "",
}));

const SUGESTOES = [
  "Quais ferramentas o Hub tem?",
  "Onde tiro o relatório de DRE?",
  "Como funciona a Curva ABC?",
  "Qual ferramenta usar para precificar?",
];

const SAUDACAO =
  "Olá, eu sou o **Vision**, o agente da Analytical X — estou aqui para te ajudar! 👋\n\nPosso te explicar o que cada ferramenta do Hub faz, como usá-la e onde tirar os relatórios. O que você quer saber?";

export default function VisionAgent() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: SAUDACAO }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega histórico do usuário
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("vision_messages")
        .select("role, content")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (data && data.length > 0) {
        setMessages([
          { role: "assistant", content: SAUDACAO },
          ...data.map((d) => ({ role: d.role as "user" | "assistant", content: d.content })),
        ]);
      }
    })();
  }, [user]);

  // Abre automaticamente na primeira vez por sessão
  useEffect(() => {
    const KEY = "vision_greeted_session";
    if (!sessionStorage.getItem(KEY)) {
      const t = setTimeout(() => setOpen(true), 800);
      sessionStorage.setItem(KEY, "1");
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const limparHistorico = async () => {
    if (!user) return;
    if (!confirm("Apagar todo o histórico de conversa com o Vision?")) return;
    await supabase.from("vision_messages").delete().eq("user_id", user.id);
    setMessages([{ role: "assistant", content: SAUDACAO }]);
  };

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || loading) return;
      setMessages((prev) => [...prev, { role: "user", content }, { role: "assistant", content: "" }]);
      setInput("");
      setLoading(true);

      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) throw new Error("Sessão expirada");

        const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/vision-chat`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message: content, apps: APPS_PAYLOAD }),
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
          throw new Error(errBody.error ?? `Erro ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
              if (j.delta) {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") {
                    copy[copy.length - 1] = { ...last, content: last.content + j.delta };
                  }
                  return copy;
                });
              }
            } catch {
              /* ignora */
            }
          }
        }
      } catch (e) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && !last.content) {
            copy[copy.length - 1] = {
              role: "assistant",
              content: `Ops, tive um problema: ${(e as Error).message}`,
            };
          }
          return copy;
        });
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 size-16 rounded-full shadow-xl shadow-primary/30 bg-card border border-border hover:scale-105 transition-transform overflow-hidden"
          aria-label="Abrir Vision"
        >
          <img src={visionLogo} alt="Vision" className="w-full h-full object-cover" />
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-3rem)] bg-card border border-border rounded-2xl shadow-2xl shadow-primary/20 flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 p-3 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="size-10 rounded-full overflow-hidden bg-background shrink-0">
              <img src={visionLogo} alt="Vision" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-2">
                Vision
                <span className="size-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xs text-muted-foreground">Agente da Analytical X</div>
            </div>
            <button
              onClick={limparHistorico}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Limpar histórico"
              title="Limpar histórico"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content || (loading && i === messages.length - 1 ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : "")}
                </div>
              </div>
            ))}

            {messages.length === 1 && !loading && (
              <div className="pt-2 space-y-1.5">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-border p-2.5 flex gap-2 bg-background/50"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre o Hub..."
              disabled={loading}
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary/50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="size-9 shrink-0 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90"
              aria-label="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
