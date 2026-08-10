# Checklist Cloudflare

## Antes de publicar

- Criar projeto no Cloudflare Workers.
- Criar D1 `lohmann-do-brasil`.
- Substituir `SUBSTITUA_PELO_DATABASE_ID_D1` em `wrangler.jsonc`.
- Ajustar `SITE_URL` em `wrangler.jsonc` para o domínio oficial.
- Aplicar `migrations/0001_initial.sql`.
- Configurar Cloudflare Access para `/admin` e `/api/admin/*`.
- Definir `ADMIN_TOKEN` apenas se quiser acesso técnico por token.

## Se publicar em Cloudflare Pages

Se o endereço provisório for parecido com `projeto.pages.dev`, você está usando Pages.

Configuração:

- Build command: vazio ou `npm install`
- Build output directory: `public`
- Functions directory: `functions`
- D1 binding: `DB`
- Secret: `ADMIN_TOKEN`

O arquivo `functions/[[path]].js` envia todas as páginas para o Worker em `src/index.js`. O arquivo `public/_routes.json` mantém `/assets/*` como arquivo estático.

## Comandos

```bash
npm install
npx wrangler d1 create lohmann-do-brasil
npx wrangler d1 migrations apply lohmann-do-brasil --remote
npx wrangler secret put ADMIN_TOKEN
npm run deploy
```

## DNS

No painel da Cloudflare, aponte o domínio para o Worker publicado. Depois, revise:

- Home
- A Lohmann
- Linhagens
- Representantes
- Radar Técnico
- Formulário de contato
- `/admin` protegido
- `/api/admin/summary` protegido
- `/sitemap.xml`
- `/robots.txt`

## Banco

O D1 usa SQLite. Por isso, a migration não usa sintaxe MySQL como `ENUM`, `AUTO_INCREMENT`, `ON UPDATE CURRENT_TIMESTAMP` ou `BIGINT UNSIGNED`.

## Admin

O painel administrativo fica em `/admin`.

Funcionalidades migradas:

- visão geral
- editor de textos, imagens por URL e botões
- SEO e GEO
- linhagens
- representantes
- equipe
- documentos
- contatos

Uploads de arquivos devem ser implementados com Cloudflare R2 em uma segunda camada, porque Workers não possui filesystem persistente.
