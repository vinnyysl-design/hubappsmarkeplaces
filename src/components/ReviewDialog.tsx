import { useEffect, useState } from "react";
import { Star, Instagram, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

const INSTAGRAM_URL = "https://www.instagram.com/analytical.x.com.br";
const DISMISS_DAYS = 15;

export default function ReviewDialog() {
  const { user, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("open-review-dialog", handler);
    return () => window.removeEventListener("open-review-dialog", handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || checked) return;
    let cancelled = false;
    (async () => {
      const [{ data: review }, { data: dismissal }] = await Promise.all([
        supabase.from("user_reviews").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("review_dismissals").select("dismissed_at").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setChecked(true);
      if (review) return;
      const last = dismissal?.dismissed_at ? new Date(dismissal.dismissed_at).getTime() : 0;
      const diffDays = (Date.now() - last) / 86400000;
      if (!dismissal || diffDays >= DISMISS_DAYS) {
        setTimeout(() => setOpen(true), 1200);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user, checked]);

  const handleClose = async (o: boolean) => {
    if (o) return;
    setOpen(false);
    if (!user) return;
    // registra dispensa para reaparecer em 15 dias
    await supabase.from("review_dismissals").upsert({
      user_id: user.id,
      dismissed_at: new Date().toISOString(),
    });
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) {
      toast({ title: "Escolha uma nota", description: "Selecione de 1 a 5 estrelas.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_reviews").upsert({
      user_id: user.id,
      email: user.email ?? "",
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Obrigado pela avaliação!", description: "Sua opinião ajuda muito a evoluir a plataforma." });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Como está sua experiência?</DialogTitle>
          <DialogDescription>
            Deixe sua avaliação sobre o uso da ferramenta. Leva menos de 30 segundos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n;
            return (
              <button
                key={n}
                type="button"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              >
                <Star
                  size={36}
                  className={active ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}
                />
              </button>
            );
          })}
        </div>

        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Conte o que achou (opcional)..."
          maxLength={500}
          rows={3}
        />

        <button
          onClick={handleSubmit}
          disabled={saving || rating === 0}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          Enviar avaliação
        </button>

        <div className="mt-2 pt-4 border-t border-border text-center">
          <p className="text-sm text-muted-foreground mb-3">Siga a gente no Instagram</p>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-tr from-[#f09433] via-[#e6683c] to-[#bc1888] text-white text-sm font-semibold hover:opacity-90 transition"
          >
            <Instagram size={18} />
            @analytical.x.com.br
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
