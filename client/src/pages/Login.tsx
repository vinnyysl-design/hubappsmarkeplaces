import { Button } from "@/components/ui/button";
import { Crosshair } from "lucide-react";
import { getLoginUrl } from "@/const";

export default function Login() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-lg space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Crosshair className="text-primary" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Central de Inteligência
            </h1>
            <p className="text-muted-foreground text-sm">
              Ferramentas estratégicas de dados para marketplaces
            </p>
          </div>

          {/* Login Button */}
          <div className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Faça login para acessar o hub de aplicativos
            </p>
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              className="w-full py-6 text-base font-semibold"
              size="lg"
            >
              Entrar com Manus
            </Button>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-border text-center text-xs text-muted-foreground space-y-2">
            <p>© {new Date().getFullYear()} Desenvolvido por Vinicius Lima</p>
            <p>Estratégia de Dados para E-commerce</p>
            <p>CNPJ: 47.192.694/0001-70 • Todos os direitos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}
