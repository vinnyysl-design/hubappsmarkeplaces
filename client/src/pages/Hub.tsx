import { useState, useMemo } from "react";
import { Search, LogOut, User } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import HeroSection from "@/components/HeroSection";
import MetricCards from "@/components/MetricCards";
import AppCard from "@/components/AppCard";
import apps from "@/data/apps.json";

const Hub = () => {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: true });
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todos");

  const categorias = useMemo(
    () => ["Todos", ...Array.from(new Set(apps.map((a) => a.categoria))).sort()],
    []
  );

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    return apps.filter((app) => {
      const matchCat = categoria === "Todos" || app.categoria === categoria;
      const conteudo = `${app.nome} ${app.descricao} ${app.tag}`.toLowerCase();
      const matchTermo = conteudo.includes(termo);
      return matchCat && matchTermo;
    });
  }, [busca, categoria]);

  const ativos = apps.filter((a) => a.status === "Ativo").length;
  const beta = apps.filter((a) => a.status === "Beta").length;
  const numCategorias = new Set(apps.map((a) => a.categoria)).size;

  const destaques = apps.filter((a) => a.tag === "Mais usado" || a.tag === "Novo");

  const showDestaques = !busca && categoria === "Todos" && destaques.length > 0;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Search className="text-primary" size={20} />
            </div>
            <h1 className="text-lg font-bold text-foreground hidden sm:block">
              Central de Inteligência
            </h1>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                  <User size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{user.name || user.email}</span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <LogOut size={16} />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <HeroSection />
        <MetricCards total={apps.length} ativos={ativos} beta={beta} categorias={numCategorias} />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar aplicativo..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Highlights */}
        {showDestaques && (
          <>
            <h2 className="text-xl font-bold text-foreground mb-4">Destaques</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
              {destaques.map((app) => (
                <AppCard key={app.nome} app={app} />
              ))}
            </div>
          </>
        )}

        {/* All apps */}
        <h2 className="text-xl font-bold text-foreground mb-4">Aplicativos</h2>
        {filtrados.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Nenhum aplicativo encontrado com esse filtro.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtrados.map((app) => (
              <AppCard key={app.nome} app={app} />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-muted-foreground text-sm mt-12 pb-6 border-t border-border pt-6 space-y-1">
          <p className="font-semibold text-foreground">© {new Date().getFullYear()} Desenvolvido por Vinicius Lima</p>
          <p>Estratégia de Dados para E-commerce</p>
          <p>CNPJ: 47.192.694/0001-70 • Todos os direitos reservados</p>
        </footer>
      </div>
    </div>
  );
};

export default Hub;
