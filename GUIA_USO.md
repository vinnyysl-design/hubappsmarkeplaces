# My App Hub - Guia de Uso

## 📋 Visão Geral

O **My App Hub** é uma central de inteligência para marketplaces com autenticação obrigatória. A aplicação fornece acesso a ferramentas estratégicas de dados para precificação, ads, fulfillment, devoluções e rentabilidade.

## 🔐 Autenticação

### Fluxo de Login

1. **Acesso à Página de Login**: Ao acessar a aplicação, você será redirecionado para a página de login se não estiver autenticado.
2. **Botão "Entrar com Manus"**: Clique no botão para iniciar o fluxo de autenticação OAuth com Manus.
3. **Redirecionamento Automático**: Após autenticar com sucesso, você será redirecionado automaticamente para o hub de aplicativos.

### Logout

- Clique no botão **"Sair"** no canto superior direito do header.
- Sua sessão será encerrada e você será redirecionado para a página de login.

## 🎯 Funcionalidades do Hub

### 1. **Visualização de Aplicativos**

O hub exibe todos os aplicativos disponíveis em um layout responsivo com:
- **Ícones representativos** para cada aplicativo
- **Badges** indicando categoria, status e tags especiais
- **Descrição breve** das funcionalidades
- **Botão "Abrir"** para acessar o aplicativo em nova aba

### 2. **Métricas do Hub**

Na seção superior, você verá:
- **Total de apps**: Número total de aplicativos disponíveis
- **Ativos**: Quantidade de aplicativos em produção
- **Em beta**: Quantidade de aplicativos em fase de testes
- **Categorias**: Número de categorias diferentes

### 3. **Filtros e Busca**

#### Busca por Termo
- Use o campo **"Buscar aplicativo..."** para procurar por:
  - Nome do aplicativo
  - Descrição da funcionalidade
  - Tags especiais

#### Filtro por Categoria
- Use o seletor **"Todos"** para filtrar aplicativos por categoria:
  - Operação
  - Marketing
  - Simuladores
  - Devoluções
  - Relatórios

### 4. **Seção de Destaques**

Quando nenhum filtro está ativo, a aplicação exibe uma seção especial com:
- **Mais usado**: Aplicativos mais populares
- **Novo**: Aplicativos recém-adicionados

## 📱 Design Responsivo

A aplicação foi desenvolvida com **mobile-first** e se adapta perfeitamente a:
- **Dispositivos móveis** (smartphones)
- **Tablets**
- **Desktops**

## 🛠️ Aplicativos Disponíveis

### 1. Curva ABC, Diagnóstico e Ações
- **Categoria**: Operação
- **Status**: Ativo
- **Tag**: Mais usado
- **Descrição**: Classifique produtos por importância, diagnostique performance e defina ações estratégicas.

### 2. Dashboard Fulfillment Estratégico
- **Categoria**: Operação
- **Status**: Ativo
- **Descrição**: Painel estratégico para acompanhamento e gestão de fulfillment.

### 3. AdsEngine
- **Categoria**: Marketing
- **Status**: Ativo
- **Tag**: Novo
- **Descrição**: Gerencie e otimize suas campanhas de anúncios com inteligência.

### 4. Precificação Estratégica
- **Categoria**: Simuladores
- **Status**: Ativo
- **Descrição**: Calculadora inteligente para definir preços com margem e competitividade.

### 5. Gestão de Devolução Inteligente
- **Categoria**: Devoluções
- **Status**: Ativo
- **Descrição**: Monitore devoluções, identifique motivos e reduza perdas com dados.

### 6. Painel Financeiro
- **Categoria**: Relatórios
- **Status**: Ativo
- **Descrição**: Análise detalhada de vendas, custos e rentabilidade da operação.

## 🚀 Executando Localmente

### Pré-requisitos
- Node.js 22.13.0 ou superior
- pnpm 10.4.1 ou superior

### Instalação

```bash
# Clonar o repositório
git clone <url-do-repositorio>
cd my-app-hub-auth

# Instalar dependências
pnpm install
```

### Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
pnpm dev

# A aplicação estará disponível em http://localhost:3000
```

### Testes

```bash
# Executar testes unitários
pnpm test

# Executar testes com observação de mudanças
pnpm test -- --watch
```

### Build para Produção

```bash
# Compilar para produção
pnpm build

# Iniciar servidor em produção
pnpm start
```

## 📊 Testes

A aplicação inclui **18 testes automatizados** que validam:
- ✅ Carregamento correto de dados de aplicativos
- ✅ Validação de propriedades obrigatórias
- ✅ Filtros por categoria
- ✅ Busca por termo
- ✅ Destaques (Mais usado e Novo)
- ✅ URLs válidas
- ✅ Ícones únicos
- ✅ Logout com limpeza de sessão

## 🔧 Estrutura do Projeto

```
my-app-hub-auth/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── HeroSection.tsx      # Seção hero do hub
│   │   │   ├── MetricCards.tsx      # Cards de métricas
│   │   │   └── AppCard.tsx          # Card individual de app
│   │   ├── pages/
│   │   │   ├── Login.tsx            # Página de login
│   │   │   └── Hub.tsx              # Página principal do hub
│   │   ├── data/
│   │   │   └── apps.json            # Dados dos aplicativos
│   │   └── App.tsx                  # Roteamento principal
│   └── index.html
├── server/
│   ├── routers.ts                   # Procedimentos tRPC
│   ├── db.ts                        # Helpers de banco de dados
│   └── hub.test.ts                  # Testes do hub
├── drizzle/
│   └── schema.ts                    # Schema do banco de dados
└── todo.md                          # Lista de tarefas do projeto
```

## 🔐 Segurança

- **Autenticação OAuth**: Integrada com Manus OAuth para segurança robusta
- **Proteção de Rotas**: Acesso ao hub apenas para usuários autenticados
- **Sessões Seguras**: Cookies HTTP-only com proteção CSRF
- **Logout Seguro**: Limpeza completa de sessão ao desconectar

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação do template ou entre em contato com o desenvolvedor.

## 📄 Licença

© 2026 Desenvolvido por Vinicius Lima
Estratégia de Dados para E-commerce
CNPJ: 47.192.694/0001-70 • Todos os direitos reservados
