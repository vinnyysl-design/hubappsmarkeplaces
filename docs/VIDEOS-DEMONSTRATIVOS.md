# Vídeos demonstrativos dos aplicativos

Todos os vídeos ficam em um único lugar: `src/data/appPreviews.ts`.
Cada app é identificado pelo seu `slug` (o mesmo de `src/data/apps.json`).

## Como associar um MP4 a um app
1. Envie o arquivo MP4 (até 20 MB) e, se quiser, uma imagem de capa (JPG/PNG 16:9) pelo chat do Lovable, dizendo qual app é.
   - Os arquivos são hospedados no Lovable Assets (CDN do projeto) — sem credenciais e sem mudar banco.
   - Também vale um link direto e público para um `.mp4` hospedado fora (não links de página do YouTube/Drive).
2. Preencha a entrada do app:

```ts
{
  appId: "curva-abc",
  videoUrl: "/__l5e/assets-v1/<id>/curva-abc.mp4",
  previewImageUrl: "/__l5e/assets-v1/<id>/curva-abc-capa.jpg",
  videoDuration: "1:30",
  benefits: ["Benefício 1", "Benefício 2", "Benefício 3"], // opcional
}
```

## Regras
- Todos os campos são opcionais; sem `videoUrl`, a prévia mostra capa/descrição/benefícios.
- O vídeo só baixa quando o usuário clica em play (`preload="none"`), e pausa ao fechar.
- Nunca usar vídeo genérico como se fosse demonstração real.

Slugs: curva-abc, fulfillment, adsengine, precificacao, devolucoes, painel-financeiro,
inteligencia-mercado, ponto-equilibrio, conciliacao, vision-x, gerador-imagens.
