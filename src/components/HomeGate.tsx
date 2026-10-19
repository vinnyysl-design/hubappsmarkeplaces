import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";

/** "/" mostra a apresentação pública para visitantes e o Hub para quem está logado. */
export default function HomeGate() {
  const { isAuthenticated, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  if (!isAuthenticated) return <Landing />;
  return (
    <ProtectedRoute>
      <Index />
    </ProtectedRoute>
  );
}
