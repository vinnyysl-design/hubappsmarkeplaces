import { describe, expect, it } from "vitest";
import apps from "../client/src/data/apps.json";

describe("Hub - Funcionalidades de Aplicativos", () => {
  describe("Dados de Aplicativos", () => {
    it("deve carregar todos os 6 aplicativos", () => {
      expect(apps).toHaveLength(6);
    });

    it("cada aplicativo deve ter as propriedades obrigatórias", () => {
      apps.forEach((app) => {
        expect(app).toHaveProperty("nome");
        expect(app).toHaveProperty("descricao");
        expect(app).toHaveProperty("categoria");
        expect(app).toHaveProperty("status");
        expect(app).toHaveProperty("tag");
        expect(app).toHaveProperty("url");
        expect(app).toHaveProperty("icone");
      });
    });

    it("todos os aplicativos devem ter status 'Ativo'", () => {
      const todosAtivos = apps.every((app) => app.status === "Ativo");
      expect(todosAtivos).toBe(true);
    });

    it("deve haver exatamente 6 aplicativos ativos", () => {
      const ativos = apps.filter((a) => a.status === "Ativo");
      expect(ativos).toHaveLength(6);
    });
  });

  describe("Categorias", () => {
    it("deve ter 5 categorias únicas", () => {
      const categorias = new Set(apps.map((a) => a.categoria));
      expect(categorias.size).toBe(5);
    });

    it("deve ter as categorias esperadas", () => {
      const categorias = new Set(apps.map((a) => a.categoria));
      const categoriasEsperadas = ["Operação", "Marketing", "Simuladores", "Devoluções", "Relatórios"];
      categoriasEsperadas.forEach((cat) => {
        expect(categorias.has(cat)).toBe(true);
      });
    });
  });

  describe("Destaques", () => {
    it("deve haver aplicativos com tag 'Mais usado'", () => {
      const maisUsados = apps.filter((a) => a.tag === "Mais usado");
      expect(maisUsados.length).toBeGreaterThan(0);
    });

    it("deve haver aplicativos com tag 'Novo'", () => {
      const novos = apps.filter((a) => a.tag === "Novo");
      expect(novos.length).toBeGreaterThan(0);
    });

    it("deve ter exatamente 2 destaques (1 Mais usado + 1 Novo)", () => {
      const destaques = apps.filter((a) => a.tag === "Mais usado" || a.tag === "Novo");
      expect(destaques).toHaveLength(2);
    });
  });

  describe("URLs dos Aplicativos", () => {
    it("todos os aplicativos devem ter URLs válidas", () => {
      apps.forEach((app) => {
        expect(app.url).toMatch(/^https?:\/\//);
      });
    });

    it("todas as URLs devem ser únicas", () => {
      const urls = apps.map((a) => a.url);
      const urlsUnicas = new Set(urls);
      expect(urlsUnicas.size).toBe(urls.length);
    });
  });

  describe("Filtros e Busca", () => {
    it("deve filtrar aplicativos por categoria", () => {
      const operacao = apps.filter((a) => a.categoria === "Operação");
      expect(operacao.length).toBeGreaterThan(0);
      expect(operacao.every((a) => a.categoria === "Operação")).toBe(true);
    });

    it("deve buscar aplicativos por nome", () => {
      const termo = "Curva ABC".toLowerCase();
      const resultado = apps.filter((a) => a.nome.toLowerCase().includes(termo));
      expect(resultado).toHaveLength(1);
      expect(resultado[0].nome).toBe("Curva ABC, Diagnóstico e Ações");
    });

    it("deve buscar aplicativos por descrição", () => {
      const termo = "inteligência".toLowerCase();
      const resultado = apps.filter((a) => a.descricao.toLowerCase().includes(termo));
      expect(resultado.length).toBeGreaterThan(0);
    });

    it("deve buscar aplicativos por tag", () => {
      const termo = "Novo".toLowerCase();
      const resultado = apps.filter((a) => a.tag.toLowerCase().includes(termo));
      expect(resultado.length).toBeGreaterThan(0);
    });
  });

  describe("Ícones", () => {
    it("todos os aplicativos devem ter ícones", () => {
      apps.forEach((app) => {
        expect(app.icone).toBeTruthy();
        expect(app.icone.length).toBeGreaterThan(0);
      });
    });

    it("deve haver ícones únicos ou reutilizados corretamente", () => {
      const iconesValidos = ["🧮", "📦", "🚀", "💰", "↩️", "🏦"];
      apps.forEach((app) => {
        expect(iconesValidos).toContain(app.icone);
      });
    });
  });
});
