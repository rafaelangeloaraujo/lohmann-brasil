# Lohmann do Brasil na Cloudflare

Versão preparada para Cloudflare Workers + D1.

## Estrutura

- `src/index.js`: Worker principal, rotas públicas, APIs e painel administrativo.
- `functions/[[path]].js`: compatibilidade com Cloudflare Pages, chamando o mesmo Worker.
- `public/assets`: CSS, JavaScript e imagens servidos como assets estáticos.
- `public/_routes.json`: direciona páginas para Functions e mantém assets estáticos.
- `migrations/0001_initial.sql`: schema D1 em SQLite com produtos, representantes, equipe, contatos, SEO e área restrita.
- `wrangler.jsonc`: configuração do Worker, assets e binding D1.

## Publicação

### Opção A: Cloudflare Pages

Use esta opção se o domínio provisório terminar com `.pages.dev`.

1. Suba o repositório com esta pasta.
2. No Pages, configure:
   - Build command: vazio ou `npm install`
   - Build output directory: `public`
3. Configure o binding D1 `DB`.
4. Configure a secret `ADMIN_TOKEN`.
5. Importe `migrations/0001_initial.sql` no D1.

As páginas serão respondidas por `functions/[[path]].js`.

### Opção B: Cloudflare Workers

1. Instale as dependências:

```bash
npm install
```

2. Crie o banco D1:

```bash
npx wrangler d1 create lohmann-do-brasil
```

3. Copie o `database_id` retornado pela Cloudflare para `wrangler.jsonc`.

4. Aplique a migration no D1:

```bash
npx wrangler d1 migrations apply lohmann-do-brasil --remote
```

5. Configure o domínio real:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Também é recomendado proteger `/admin` com Cloudflare Access.

6. Publique:

```bash
npm run deploy
```

## Observações

A versão PHP/MySQL original não é executada em Workers. Esta pasta é a nova base Cloudflare: páginas renderizadas pelo Worker, assets estáticos e dados no D1.

## Painel administrativo

O painel `/admin` foi migrado para Workers. Ele permite:

- Visualizar métricas e contatos.
- Editar textos, imagens por URL e botões por página.
- Editar SEO e GEO.
- Administrar linhagens, representantes, equipe e documentos.
- Atualizar status de contatos.

Para produção, proteja `/admin` com Cloudflare Access. Como fallback técnico, defina `ADMIN_TOKEN` e acesse `/admin?token=SEU_TOKEN`.

Uploads diretos de imagem não foram mantidos porque Workers não grava arquivos em disco. Para upload real, a próxima camada correta é Cloudflare R2.
