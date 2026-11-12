import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  requireAdmin?: boolean;
  requireActive?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false, requireActive = false }: Props) {
  const { isAuthenticated, isAdmin, status, loading, accessState, refreshProfile, needsPhoneVerification } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (accessState === "unavailable") {
    return <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p>Não foi possível confirmar seu acesso. Tente novamente.</p>
      <button onClick={() => void refreshProfile()}>Tentar novamente</button>
    </div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (requireActive && needsPhoneVerification) {
    return <Navigate to="/verify-phone" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireActive && status !== "ativo") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
