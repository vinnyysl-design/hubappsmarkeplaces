import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, Brain, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

type Knowledge = {
  id: string;
  app_slug: string | null;
  title: string;
  content: string;
  updated_at: string;
};

export default function VisionKnowledgePanel() {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Knowledge | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", app_slug: "", content: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("vision_knowledge")
      .select("*")
      .order("title");
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (k: Knowledge) => {
    setEditing(k);
    setCreating(false);
    setForm({ title: k.title, app_slug: k.app_slug ?? "", content: k.content });
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ title: "", app_slug: "", content: "" });
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({ title: "Preencha título e conteúdo", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      app_slug: form.app_slug.trim() || null,
      content: form.content.trim(),
    };
    const { error } = editing
      ? await supabase.from("vision_knowledge").update(payload).eq("id", editing.id)
      : await supabase.from("vision_knowledge").insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Atualizado" : "Criado", description: "O Vision já aprendeu." });
    cancel();
    load();
  };

  const remove = async (k: Knowledge) => {
    if (!confirm(`Excluir "${k.title}"?`)) return;
    const { error } = await supabase.from("vision_knowledge").delete().eq("id", k.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="text-primary" size={20} />
          <h2 className="text-lg font-semibold">Conhecimento do Vision</h2>
        </div>
        <Button size="sm" onClick={startCreate} disabled={creating || !!editing}>
          <Plus size={14} className="mr-1" /> Novo
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Tudo que estiver aqui o Vision usa para responder. Edite, adicione ou remova entradas a
        qualquer momento — o aprendizado é instantâneo, sem precisar mexer no código.
      </p>

      {(creating || editing) && (
        <div className="mb-5 p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Curva ABC, Diagnóstico e Ações"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Slug da ferramenta (opcional)
              </label>
              <Input
                value={form.app_slug}
                onChange={(e) => setForm({ ...form, app_slug: e.target.value })}
                placeholder="curva-abc"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Conteúdo *</label>
            <Textarea
              rows={6}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="O que a ferramenta faz, como usar, onde tirar os relatórios, dicas, perguntas frequentes..."
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={cancel}>
              <X size={14} className="mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Nenhuma entrada ainda. Clique em "Novo" para ensinar algo ao Vision.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((k) => (
            <div
              key={k.id}
              className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{k.title}</span>
                  {k.app_slug && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      {k.app_slug}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{k.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => startEdit(k)}>
                  <Pencil size={14} />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(k)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
