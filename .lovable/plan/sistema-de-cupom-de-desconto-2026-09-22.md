# Sistema de Cupom de Desconto

Objetivo: divulgar um cupom em evento. Quem se cadastrar usando o cupom continua com os 10 dias grátis e ganha **10% de desconto no primeiro mês** de qualquer plano.

## Como o cliente vai usar

1. No cadastro aparece um campo opcional "Cupom de desconto". Ele digita o código (ex: `EVENTO10`).
2. O código é validado na hora: inválido, expirado ou esgotado mostra aviso e o cadastro segue sem desconto.
3. Cupom válido fica vinculado à conta dele.
4. Ao assinar qualquer plano, a tela de planos mostra o preço do primeiro mês já com 10% de desconto e um selo "Cupom EVENTO10 aplicado".
5. Depois do primeiro mês, a cobrança volta ao valor normal do plano.

## Como a cobrança com desconto funciona

Hoje a assinatura é recorrente no Mercado Pago com valor fixo, sem suporte a primeira parcela diferente. Então, quando existe cupom:

- Primeiro mês: cobrança única com 10% de desconto, paga no checkout.
- Assinatura recorrente: criada no mesmo fluxo, com início 30 dias depois e valor cheio do plano.
- Sem cupom: nada muda, segue o fluxo recorrente atual.

O acesso é liberado assim que o pagamento do primeiro mês é aprovado, igual ao fluxo atual.

## Painel do admin

Nova seção "Cupons" (no accordion), permitindo:

- Criar cupom: código, percentual de desconto, validade, limite de usos, ativo/inativo.
- Ver usos: quantas pessoas usaram, quem usou, quem já pagou.
- Ativar/desativar e excluir cupom.

Na lista de usuários e nos contatos, mostrar o cupom usado no cadastro — assim você mede o retorno do evento.

## Detalhes técnicos

Banco:
- `coupons`: code (único, maiúsculo), discount_percent, valid_from, valid_until, max_uses, uses_count, active, timestamps. Leitura pública apenas via função de validação; gestão só para admin.
- `coupon_redemptions`: coupon_id, user_id, applied_at, first_payment_done. Único por usuário.
- `profiles`: coluna `coupon_code` para leitura rápida no admin.
- RPC `validate_coupon(_code)` (security definer): retorna validade e percentual sem expor a tabela.
- RPC `redeem_coupon(_code, _user_id)` chamada no cadastro; incrementa `uses_count` com trava contra uso duplicado.
- GRANTs e RLS conforme padrão do projeto.

Frontend:
- `src/pages/Auth.tsx`: campo de cupom + validação via RPC, resgate após criar a conta.
- `src/components/PlansDialog.tsx`: busca o cupom do usuário, exibe preço do primeiro mês com desconto e envia `coupon_code` na criação da assinatura.
- Novo `src/components/CouponsPanel.tsx` e integração no `src/pages/Admin.tsx`.

Backend (funções):
- `create-mp-subscription`: revalida o cupom no servidor, cria a cobrança única com desconto e a assinatura recorrente com `start_date` em +30 dias e valor cheio.
- `mp-webhook`: ao aprovar o pagamento do primeiro mês com cupom, marca `first_payment_done` e libera o acesso.
