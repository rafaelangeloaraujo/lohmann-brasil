const LANGS = new Set(['pt', 'en', 'es']);

const ROUTES = {
  '/': 'home',
  '/a-lohmann': 'sobre',
  '/linhagens': 'linhagens',
  '/representantes': 'representantes',
  '/suporte-tecnico': 'suporte',
  '/biblioteca': 'biblioteca',
  '/artigos': 'artigos',
  '/radar-tecnico': 'radar',
};

const LEGACY_REDIRECTS = {
  '/index.php': '/',
  '/sobre.php': '/a-lohmann',
  '/linhagens.php': '/linhagens',
  '/representantes.php': '/representantes',
  '/suporte-tecnico.php': '/suporte-tecnico',
  '/biblioteca.php': '/biblioteca',
  '/noticias.php': '/artigos',
  '/radar-tecnico.php': '/radar-tecnico',
};

const pageFallback = {
  home: {
    title: 'Lohmann do Brasil | Genética avícola e suporte técnico',
    description: 'Linhagens de postura, suporte técnico e informações para produtores, granjas e distribuidores no Brasil.',
  },
  sobre: {
    title: 'A Lohmann | Lohmann do Brasil',
    description: 'Atuação institucional da Lohmann do Brasil em genética de postura, suporte técnico e presença no setor avícola.',
  },
  linhagens: {
    title: 'Linhagens Lohmann | Lohmann do Brasil',
    description: 'Linhagens LOHMANN LSL-LITE e LOHMANN BROWN-LITE para diferentes sistemas produtivos e mercados.',
  },
  representantes: {
    title: 'Representantes | Lohmann do Brasil',
    description: 'Encontre representantes da Lohmann do Brasil por estado para atendimento técnico e comercial.',
  },
  radar: {
    title: 'Radar Técnico | Lohmann do Brasil',
    description: 'Indicadores de mercado para apoio à leitura técnica do setor avícola.',
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);

    if (path.startsWith('/assets/')) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Asset not found', { status: 404 });
    }

    if (LEGACY_REDIRECTS[path]) {
      url.pathname = LEGACY_REDIRECTS[path];
      return Response.redirect(url.toString(), 301);
    }

    if (path === '/product.php') {
      const slug = url.searchParams.get('slug') || 'lohmann-lsl-lite';
      url.pathname = `/linhagens/${slug}`;
      url.search = '';
      return Response.redirect(url.toString(), 301);
    }

    if (path === '/api/products') return json(await products(env, lang(url)));
    if (path === '/api/representatives') return json(await representatives(env));
    if (path === '/api/team') return json(await team(env));
    if (path === '/api/contact' && request.method === 'POST') return saveContact(request, env);
    if (path.startsWith('/api/admin/')) return adminApi(request, env, path);
    if (path === '/admin') return adminApp(request, env);

    if (path === '/sitemap.xml') return sitemap(request, env);
    if (path === '/robots.txt') return text(`User-agent: *\nAllow: /\nSitemap: ${origin(env, request)}/sitemap.xml\n`, 'text/plain');

    if (path.startsWith('/linhagens/')) {
      const slug = path.split('/').filter(Boolean).pop();
      return html(await renderProductPage(slug, request, env));
    }

    const pageKey = ROUTES[path];
    if (pageKey) {
      return html(await renderPage(pageKey, request, env));
    }

    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

function lang(url) {
  const value = url.searchParams.get('lang') || 'pt';
  return LANGS.has(value) ? value : 'pt';
}

function h(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...securityHeaders(),
      ...(init.headers || {}),
    },
  });
}

function html(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
      ...securityHeaders(),
      ...(init.headers || {}),
    },
  });
}

function text(body, type) {
  return new Response(body, {
    headers: {
      'content-type': `${type}; charset=utf-8`,
      ...securityHeaders(),
    },
  });
}

function securityHeaders() {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  };
}

async function products(env, selectedLang = 'pt') {
  if (!hasDb(env)) return [];
  const column = selectedLang === 'en' ? 'summary_en' : selectedLang === 'es' ? 'summary_es' : 'summary_pt';
  const { results } = await env.DB.prepare(
    `SELECT slug, name, category, egg_color, ${column} AS summary, image
     FROM products
     WHERE status = 'published'
     ORDER BY CASE WHEN slug = 'lohmann-lsl-lite' THEN 0 WHEN slug = 'lohmann-brown-lite' THEN 1 ELSE 2 END, sort_order, name`
  ).all();
  return results;
}

async function representatives(env) {
  if (!hasDb(env)) return {};
  const { results } = await env.DB.prepare(
    `SELECT name, role, uf, region, city, phone, email, photo
     FROM representatives
     WHERE is_active = 1
     ORDER BY uf, sort_order, name`
  ).all();

  return results.reduce((grouped, item) => {
    const uf = item.uf || 'BR';
    grouped[uf] ||= [];
    grouped[uf].push({
      ...item,
      initials: initials(item.name),
      whatsapp: whatsapp(item.phone, item.name),
    });
    return grouped;
  }, {});
}

async function team(env) {
  if (!hasDb(env)) return [];
  const { results } = await env.DB.prepare(
    `SELECT name, position, region, phone, email, photo
     FROM team_members
     WHERE is_active = 1
     ORDER BY sort_order, name`
  ).all();
  return results.map((item) => ({ ...item, initials: initials(item.name), whatsapp: whatsapp(item.phone, item.name) }));
}

function initials(name) {
  return String(name || 'LB').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function whatsapp(phone, name) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const number = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Olá, vim pelo site da Lohmann do Brasil e gostaria de falar com ${name || 'um representante'}.`)}`;
}

async function seo(env, pageKey, request) {
  const fallback = pageFallback[pageKey] || pageFallback.home;
  const row = hasDb(env)
    ? await env.DB.prepare('SELECT * FROM seo_pages WHERE page_key = ? LIMIT 1').bind(pageKey).first().catch(() => null)
    : null;
  const base = origin(env, request);
  const path = ROUTES_REVERSE[pageKey] || '/';
  return {
    title: row?.title_pt || fallback.title,
    description: row?.description_pt || fallback.description,
    keywords: row?.keywords_pt || '',
    canonical: `${base}${path}`,
    ogImage: `${base}${row?.og_image || '/assets/logo-lohmann.png'}`,
    robots: row?.robots || 'index,follow',
    geoRegion: row?.geo_region || 'BR-SP',
    geoPlacename: row?.geo_placename || 'Nova Granada, São Paulo, Brasil',
  };
}

const ROUTES_REVERSE = Object.fromEntries(Object.entries(ROUTES).map(([path, page]) => [page, path]));

function origin(env, request) {
  return String(env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
}

function hasDb(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === 'function');
}

async function pageSections(env, pageKey) {
  if (!hasDb(env)) return {};
  const { results } = await env.DB.prepare(
    `SELECT * FROM editable_sections WHERE page_key = ? ORDER BY sort_order, id`
  ).bind(pageKey).all();
  return (results || []).reduce((items, row) => {
    items[row.section_key] = row;
    return items;
  }, {});
}

function sectionValue(sections, key, field, fallback = '') {
  return String(sections?.[key]?.[field] || fallback);
}

function fallbackRepresentatives() {
  return [
    {
      name: 'Equipe Lohmann do Brasil',
      role: 'Atendimento nacional',
      region: 'Encaminhamento para o representante responsável',
      phone: '(17) 3212-7347',
      email: 'contato@lohmann.com.br',
      city: 'Nova Granada, SP',
      initials: 'LB',
    },
  ];
}

async function renderPage(pageKey, request, env) {
  const url = new URL(request.url);
  const selectedLang = lang(url);
  const meta = await seo(env, pageKey, request);
  const productRows = await products(env, selectedLang).catch(() => []);
  const repRows = pageKey === 'representantes' ? await representatives(env).catch(() => ({})) : {};
  const teamRows = pageKey === 'sobre' ? await team(env).catch(() => []) : [];
  const sections = await pageSections(env, pageKey).catch(() => ({}));
  const main = renderMain(pageKey, productRows, repRows, teamRows, sections);

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${h(meta.title)}</title>
  <meta name="description" content="${h(meta.description)}">
  <meta name="robots" content="${h(meta.robots)}">
  <meta name="keywords" content="${h(meta.keywords)}">
  <meta name="geo.region" content="${h(meta.geoRegion)}">
  <meta name="geo.placename" content="${h(meta.geoPlacename)}">
  <link rel="canonical" href="${h(meta.canonical)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Lohmann do Brasil">
  <meta property="og:title" content="${h(meta.title)}">
  <meta property="og:description" content="${h(meta.description)}">
  <meta property="og:url" content="${h(meta.canonical)}">
  <meta property="og:image" content="${h(meta.ogImage)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/site.css">
</head>
<body class="${pageKey === 'home' ? '' : 'internal-page'} ${pageKey}-page">
  ${topBarCloud()}
  ${headerCloud(pageKey)}
  <main>${main}</main>
  ${footerCloud()}
  <script>window.LohmannRepresentatives = ${JSON.stringify(repRows)}; window.LohmannFallbackRepresentatives = ${JSON.stringify(fallbackRepresentatives())};</script>
  <script src="/assets/site.js" defer></script>
</body>
</html>`;
}

function topBar() {
  return `<div class="top-utility"><div class="top-utility-inner"><strong class="top-brand-name">LOHMANN DO BRASIL <span class="br-flag" aria-hidden="true"></span></strong><div class="top-tools"><div class="top-language" aria-label="Idiomas"><a class="active" href="?lang=pt">🇧🇷 PT</a><a href="?lang=en">🇺🇸 EN</a><a href="?lang=es">🇪🇸 ES</a></div><div class="top-social" aria-label="Redes sociais"><a href="https://instagram.com/lohmanndobrasil" target="_blank" rel="noopener" aria-label="Instagram">◎</a><a href="https://www.linkedin.com/company/lohmann-do-brasil-avicultura/" target="_blank" rel="noopener" aria-label="LinkedIn">in</a></div></div></div></div>`;
}

function header(active) {
  const nav = [
    ['/', 'Início', 'home'],
    ['/a-lohmann', 'A Lohmann', 'sobre'],
    ['/linhagens', 'Linhagens', 'linhagens'],
    ['/representantes', 'Representantes', 'representantes'],
    ['/suporte-tecnico', 'Suporte técnico', 'suporte'],
    ['/biblioteca', 'Biblioteca', 'biblioteca'],
    ['/artigos', 'Artigos', 'artigos'],
    ['/#contato', 'Contato', 'contato'],
    ['/radar-tecnico', '<span></span>Radar Técnico', 'radar'],
  ].map(([href, label, key]) => `<a class="${key === active ? 'active' : ''} ${key === 'radar' ? 'radar-nav-link' : ''}" href="${href}">${label}</a>`).join('');
  return `<header class="site-header"><a class="brand" href="/" aria-label="Lohmann do Brasil"><img class="logo-top" src="/assets/logo-lohmann-header-white.png" alt="Lohmann do Brasil"><img class="logo-scrolled" src="/assets/logo-lohmann.png" alt="Lohmann do Brasil"></a><button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span></button><nav class="nav" aria-label="Principal">${nav}</nav><div class="header-actions"><a class="portal-link" href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div></header>`;
}

function footer() {
  return `<footer><a class="brand footer-brand" href="/"><img src="/assets/logo-lohmann-header.png" alt="Lohmann do Brasil"></a><p>Genética como engenharia de sistema.</p><div><a href="/admin">Administração</a><a href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div><small>&copy; ${new Date().getFullYear()} Lohmann do Brasil</small></footer>`;
}

function renderMain(pageKey, productRows, repRows, teamRows, sections = {}) {
  if (pageKey === 'home') return homeCloud(productRows, sections);
  if (pageKey === 'sobre') return sobre(teamRows, sections);
  if (pageKey === 'linhagens') return linhagens(productRows, sections);
  if (pageKey === 'representantes') return reps(repRows, sections);
  if (pageKey === 'radar') return radar(sections);
  if (pageKey === 'suporte') return simplePage('Suporte técnico', 'Acompanhamento técnico para manejo, leitura de indicadores e organização da rotina produtiva.');
  if (pageKey === 'biblioteca') return simplePage('Biblioteca', 'Planilhas, materiais técnicos e conteúdos de apoio para acompanhamento de sistemas de postura.');
  if (pageKey === 'artigos') return simplePage('Artigos', 'Conteúdos técnicos e institucionais para produtores, granjas e distribuidores.');
  return home(productRows);
}

function topBarCloud() {
  return `<div class="top-utility"><div class="top-utility-inner"><strong class="top-brand-name">LOHMANN DO BRASIL <span class="br-flag" aria-hidden="true"></span></strong><div class="top-tools"><div class="top-language" aria-label="Idiomas"><a class="active" href="?lang=pt">PT</a><a href="?lang=en">EN</a><a href="?lang=es">ES</a></div><div class="top-social" aria-label="Redes sociais"><a href="https://instagram.com/lohmanndobrasil" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17" cy="7" r="1"></circle></svg></a><a href="https://www.linkedin.com/company/lohmann-do-brasil-avicultura/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4v11H4z"></path><path d="M6 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"></path><path d="M10 9h4v1.6c.7-1 1.8-1.9 3.6-1.9 2.7 0 4.4 1.8 4.4 5.2V20h-4v-5.5c0-1.5-.6-2.4-1.9-2.4-1.2 0-2.1.8-2.1 2.4V20h-4z"></path></svg></a></div></div></div></div>`;
}

function headerCloud(active) {
  const nav = [
    ['/', 'Início', 'home'],
    ['/a-lohmann', 'A Lohmann', 'sobre'],
    ['/linhagens', 'Linhagens', 'linhagens'],
    ['/representantes', 'Representantes', 'representantes'],
    ['/suporte-tecnico', 'Suporte técnico', 'suporte'],
    ['/biblioteca', 'Biblioteca', 'biblioteca'],
    ['/artigos', 'Artigos', 'artigos'],
    ['/#contato', 'Contato', 'contato'],
    ['/radar-tecnico', '<span></span>Radar Técnico', 'radar'],
  ].map(([href, label, key]) => `<a class="${key === active ? 'active' : ''} ${key === 'radar' ? 'radar-nav-link' : ''}" href="${href}">${label}</a>`).join('');

  return `<header class="site-header"><a class="brand" href="/" aria-label="Lohmann do Brasil"><img class="logo-top" src="/assets/logo-lohmann-header-white.png" alt="Lohmann do Brasil"><img class="logo-scrolled" src="/assets/logo-lohmann.png" alt="Lohmann do Brasil"></a><button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span></button><nav class="nav" aria-label="Principal">${nav}</nav><div class="header-actions"><a class="portal-link" href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div></header>`;
}

function footerCloud() {
  return `<footer><a class="brand footer-brand" href="/"><img src="/assets/logo-lohmann-header.png" alt="Lohmann do Brasil"></a><p>Genética como engenharia de sistema.</p><div><a href="/admin">Administração</a><a href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div><small>&copy; ${new Date().getFullYear()} Lohmann do Brasil</small></footer>`;
}

function homeCloud(productRows, sections = {}) {
  const heroTitle = sectionValue(sections, 'hero', 'title_pt', 'A ave certa para o seu sistema produtivo.');
  const heroText = sectionValue(sections, 'hero', 'text_pt', 'A Lohmann do Brasil combina genética avícola, acompanhamento técnico e leitura de mercado para apoiar sistemas produtivos com previsibilidade, qualidade de ovos e eficiência operacional.');
  const heroButton = sectionValue(sections, 'hero', 'button_label_pt', 'Conhecer linhagens');
  const heroUrl = sectionValue(sections, 'hero', 'button_url', '/linhagens');

  return `<section class="hero" id="inicio"><div class="hero-copy reveal"><div class="live-label"><i></i>Genética como engenharia de sistema</div><h1>${h(heroTitle)}</h1><p>${h(heroText)}</p><div class="actions"><a class="button primary" href="${h(heroUrl)}">${h(heroButton)}</a><a class="button ghost" href="#contato">Falar com a equipe</a></div><div class="signal-row"><span><b>01</b> Sistema</span><span><b>02</b> Manejo</span><span><b>03</b> Calibragem</span></div></div><div class="hero-visual" aria-hidden="true"><div class="egg-photo-layer"></div><div class="tech-grid"></div><div class="scan-line"></div><div class="particle particle-a"></div><div class="particle particle-b"></div><div class="particle particle-c"></div><div class="lohmann-l-motion"><span class="l-mark l-mark-large"></span><span class="l-mark l-mark-medium"></span><span class="l-mark l-mark-small"></span></div><div class="data-card"><span>LOHMANN // SYSTEM DATA</span><strong>Calibragem em campo</strong><div class="data-bars"><i></i><i></i><i></i></div><small>Manejo, mercado e suporte técnico</small></div><div class="coordinate">BRASIL<br>REDE TÉCNICA</div></div></section>
  <section class="proof-bar" aria-label="Diferenciais Lohmann"><article><strong>01</strong><span>Adequação de sistema</span></article><article><strong>02</strong><span>Desempenho acompanhado</span></article><article><strong>03</strong><span>Calibragem em campo</span></article><div class="proof-pulse"><i></i> SISTEMA ATIVO</div></section>
  <section class="intro section" id="sobre"><div><p class="eyebrow">Lohmann do Brasil</p><h2>${h(sectionValue(sections, 'about', 'title_pt', 'Genética avícola orientada por desempenho, manejo e mercado.'))}</h2></div><div><p>${h(sectionValue(sections, 'about', 'text_pt', 'A Lohmann do Brasil disponibiliza linhagens para diferentes realidades produtivas, com suporte técnico próximo e foco em estabilidade, persistência, qualidade de ovos e adequação ao mercado de destino.'))}</p><p>O trabalho técnico considera as variáveis reais da operação: sistema produtivo, clima, peso de ovo, mercado de destino, manejo disponível e objetivo de desempenho.</p><a class="text-link" href="/a-lohmann">Conhecer a Lohmann <span>+</span></a></div></section>
  ${productGrid(productRows)}
  <section class="journey section"><header class="section-heading"><div><p class="eyebrow">Método Lohmann</p><h2>Da decisão de alojamento à performance prevista.</h2></div><p>O trabalho técnico começa antes da ave: leitura do sistema produtivo, definição da linhagem e acompanhamento para manter o potencial genético calibrado em campo.</p></header><div class="journey-grid"><article class="reveal"><span>01</span><div class="journey-icon"><i></i></div><h3>Diagnóstico do sistema</h3><p>Análise de manejo, clima, estrutura, mercado de saída e objetivo produtivo para orientar a escolha genética.</p></article><article class="reveal"><span>02</span><div class="journey-icon"><i></i></div><h3>Linhagem calibrada</h3><p>Portfólio segmentado por variável de manejo, peso de ovo e perfil de operação, sem promessa genérica para todos os sistemas.</p></article><article class="reveal"><span>03</span><div class="journey-icon"><i></i></div><h3>Acompanhamento técnico</h3><p>Suporte regional para interpretar indicadores, ajustar manejo e manter robustez, persistência e viabilidade como métricas de produção.</p></article></div></section>
  <section class="technical" id="tecnico"><div class="technical-copy reveal"><p class="eyebrow light">Suporte técnico</p><h2>Acompanhamento para transformar potencial genético em resultado previsível.</h2><p>Materiais, treinamentos e atendimento regional apoiam a rotina de manejo, a leitura de indicadores e a tomada de decisão ao longo do ciclo produtivo.</p><a class="button light" href="/suporte-tecnico">Saiba mais</a></div><div class="technical-list"><article><span>01</span><h3>Documentos técnicos</h3><p>Guias e materiais para padronizar leitura de manejo, indicadores e rotina produtiva.</p></article><article><span>02</span><h3>Treinamentos</h3><p>Conteúdo técnico organizado por sistema, etapa produtiva e objetivo de performance.</p></article><article><span>03</span><h3>Gestão de manejo</h3><p>Ferramentas para acompanhar lote, interpretar desvios e antecipar ajustes de manejo.</p></article></div></section>
  <section class="representatives-shortcut section"><div class="shortcut-copy reveal"><p class="eyebrow">Representantes</p><h2>${h(sectionValue(sections, 'representantes', 'title_pt', 'Rede técnica regional para calibrar decisão e manejo.'))}</h2><p>${h(sectionValue(sections, 'representantes', 'text_pt', 'Encontre o contato responsável pelo seu estado e direcione dúvidas comerciais, técnicas e de distribuição.'))}</p><a class="button primary" href="${h(sectionValue(sections, 'representantes', 'button_url', '/representantes'))}">${h(sectionValue(sections, 'representantes', 'button_label_pt', 'Ver representantes'))}</a></div><div class="shortcut-image reveal" aria-hidden="true"><img src="${h(sectionValue(sections, 'representantes', 'image_path', '/assets/representantes-atalho.png'))}" alt=""></div></section>
  <section class="innovation"><div class="innovation-visual" aria-hidden="true"><div class="analysis-egg"><span></span><i></i></div><span class="metric metric-one"><b>360°</b> sistema calibrado</span><span class="metric metric-two"><b>24/7</b> dados de produção</span><div class="radar"></div></div><div class="innovation-copy reveal"><p class="eyebrow">Ovoflock</p><h2>Dados de produção e rotina técnica em um só ambiente.</h2><p>Uma plataforma para apoiar o acompanhamento de lotes, indicadores e decisões operacionais com mais organização.</p><ul><li>Indicadores de lote</li><li>Acompanhamento produtivo</li><li>Gestão operacional</li><li>Dados para decisão</li></ul><a class="button primary" href="https://ovoflock.com/login" target="_blank" rel="noopener">Acessar Ovoflock</a></div></section>
  <section class="news section" id="artigos"><header class="section-heading"><div><p class="eyebrow">Artigos</p><h2>Artigos técnicos e institucionais.</h2></div><p>Conteúdos sobre linhagens, manejo, suporte técnico, mercado e presença da Lohmann do Brasil no setor avícola.</p></header></section>
  <section class="partners-section section" id="parceiros"><header class="section-heading"><div><p class="eyebrow">Parceiros</p><h2>Relações que fortalecem a presença da Lohmann no campo.</h2></div><p>Empresas parceiras conectam genética, produção, distribuição e mercado com atuação próxima ao setor avícola brasileiro.</p></header><div class="partners-grid"><article class="partner-card reveal"><img src="/assets/partners/tangara.png" alt="Tangará"></article><article class="partner-card reveal"><img src="/assets/partners/ovos-sousa.png" alt="Ovos Sousa"></article></div></section>
  <section class="technical-radar radar-shortcut section" id="radar-tecnico"><header class="section-heading"><div><p class="eyebrow"><span class="live-dot"></span>Radar Técnico</p><h2>Indicadores de mercado em uma página dedicada.</h2></div><p>Acompanhe referências de mercado para ovos em diferentes praças brasileiras e use os dados como apoio para leitura técnica e comercial.</p></header><a class="button primary" href="/radar-tecnico">Abrir Radar Técnico</a></section>
  <section class="contact" id="contato"><div class="contact-copy"><p class="eyebrow light">Contato</p><h2>Fale com a equipe Lohmann do Brasil.</h2><p>Envie sua solicitação para direcionarmos o atendimento.</p><address>Rua Theofilo Mancor, 670<br>Nova Granada, SP<br>CEP 15440-000</address></div><form action="/api/contact" method="post" class="contact-form"><label>Nome<input name="name" required></label><label>Empresa<input name="company"></label><label>E-mail<input type="email" name="email" required></label><label>Telefone<input name="phone"></label><label class="wide">Assunto<input name="subject"></label><label class="wide">Mensagem<textarea name="message" rows="4" required></textarea></label><button class="button light" type="submit">Enviar</button></form></section>`;
}

function home(productRows, sections = {}) {
  const heroTitle = sectionValue(sections, 'hero', 'title_pt', 'A ave certa para o seu sistema produtivo.');
  const heroText = sectionValue(sections, 'hero', 'text_pt', 'A Lohmann do Brasil combina genética avícola, acompanhamento técnico e leitura de mercado para apoiar sistemas produtivos com previsibilidade, qualidade de ovos e eficiência operacional.');
  const heroButton = sectionValue(sections, 'hero', 'button_label_pt', 'Conhecer linhagens');
  const heroUrl = sectionValue(sections, 'hero', 'button_url', '/linhagens');
  const heroImage = sectionValue(sections, 'hero', 'image_path', '/assets/hero-galinhas-linhagens-cliente.png');
  return `<section class="hero" id="inicio"><div class="hero-copy"><p class="eyebrow">Genética como engenharia de sistema</p><h1>${h(heroTitle)}</h1><p>${h(heroText)}</p><a class="button primary" href="${h(heroUrl)}">${h(heroButton)}</a></div><div class="hero-visual"><img class="hero-hens" src="${h(heroImage)}" alt="Linhagens Lohmann"></div></section>
  <section class="section"><header class="section-heading"><div><p class="eyebrow">Lohmann do Brasil</p><h2>${h(sectionValue(sections, 'about', 'title_pt', 'Atuação baseada em genética, manejo e acompanhamento técnico.'))}</h2></div><p>${h(sectionValue(sections, 'about', 'text_pt', 'Um trabalho construído para reduzir incertezas no campo e apoiar decisões por sistema produtivo.'))}</p></header></section>
  ${productGrid(productRows)}
  <section class="representatives-home"><div><p class="eyebrow">Rede regional</p><h2>${h(sectionValue(sections, 'representantes', 'title_pt', 'Encontre representantes por estado.'))}</h2><p>${h(sectionValue(sections, 'representantes', 'text_pt', 'O mapa interativo direciona o contato técnico e comercial conforme a região de atendimento.'))}</p><a class="button primary" href="${h(sectionValue(sections, 'representantes', 'button_url', '/representantes'))}">${h(sectionValue(sections, 'representantes', 'button_label_pt', 'Ver representantes'))}</a></div><img src="${h(sectionValue(sections, 'representantes', 'image_path', '/assets/representantes-atalho.png'))}" alt=""></section>
  <section class="technical-radar-short"><div><p class="eyebrow">Radar Técnico</p><h2>${h(sectionValue(sections, 'radar', 'title_pt', 'Leitura de mercado para apoiar decisões.'))}</h2><p>${h(sectionValue(sections, 'radar', 'text_pt', 'Acompanhe indicadores de referência em uma página dedicada.'))}</p><a class="button light" href="${h(sectionValue(sections, 'radar', 'button_url', '/radar-tecnico'))}">${h(sectionValue(sections, 'radar', 'button_label_pt', 'Abrir radar'))}</a></div></section>
  <section class="contact" id="contato"><div class="contact-copy"><p class="eyebrow light">Contato</p><h2>Fale com a equipe Lohmann do Brasil.</h2><p>Envie sua solicitação para direcionarmos o atendimento.</p></div><form action="/api/contact" method="post" class="contact-form"><label>Nome<input name="name" required></label><label>Empresa<input name="company"></label><label>E-mail<input type="email" name="email" required></label><label>Telefone<input name="phone"></label><label class="wide">Assunto<input name="subject"></label><label class="wide">Mensagem<textarea name="message" rows="4" required></textarea></label><button class="button light" type="submit">Enviar</button></form></section>`;
}

function productGrid(productRows) {
  const rows = productRows.length ? productRows : fallbackProducts();
  return `<section class="products section" id="linhagens"><header class="section-heading"><div><p class="eyebrow">Portfólio Lohmann</p><h2>Linhagens calibradas por manejo, clima e mercado.</h2></div></header><div class="product-grid">${rows.map((product, index) => `<article class="product-card reveal"><div class="product-art product-art-${index + 1}"><span>0${index + 1}</span><img class="product-hen official-hen" src="/assets/${product.slug.includes('brown') ? 'galinha-marron-oficial-lohmann.png' : 'galinha-branca-oficial-lohmann.png'}" alt="${h(product.name)}"></div><div class="product-copy"><small>${h(product.egg_color)}</small><h3>${h(product.name)}</h3><p>${h(product.summary)}</p><a href="/linhagens/${h(product.slug)}">Ver detalhes <b>+</b></a></div></article>`).join('')}</div></section>`;
}

function fallbackProducts() {
  return [
    { slug: 'lohmann-lsl-lite', name: 'LOHMANN LSL-LITE', egg_color: 'Ovos brancos', summary: 'Linhagem calibrada para uniformidade, eficiência alimentar e manejo previsível.' },
    { slug: 'lohmann-brown-lite', name: 'LOHMANN BROWN-LITE', egg_color: 'Ovos marrons', summary: 'Linhagem projetada para eficiência, persistência e ajuste ao mercado.' },
  ];
}

function sobre(teamRows) {
  return `<section class="internal-hero"><p class="eyebrow">A Lohmann</p><h1>Genética avícola com presença técnica no campo.</h1><p>A Lohmann do Brasil atua junto a produtores, granjas e distribuidores com linhagens comerciais de postura, materiais técnicos e acompanhamento de campo.</p></section><section class="content-bands content-bands-rich"><div class="content-prose"><p class="eyebrow">Atuação técnica</p><h2>Atuação baseada em genética, manejo e acompanhamento técnico.</h2><p>A presença da Lohmann do Brasil no campo aproxima genética, manejo e informação técnica para apoiar diferentes realidades produtivas e mercados de destino.</p></div><div class="content-grid content-grid-four"><article class="content-card"><span>01</span><h2>Adequação de sistema</h2><p>A escolha da ave considera sistema produtivo, manejo disponível e mercado de cada cliente.</p></article><article class="content-card"><span>02</span><h2>Engenharia de performance</h2><p>Robustez, persistência e longevidade são tratadas como parâmetros de projeto.</p></article><article class="content-card"><span>03</span><h2>Bem-estar como eficiência</h2><p>Estresse, viabilidade, estabilidade de penas e mortalidade entram na leitura técnica do sistema.</p></article><article class="content-card"><span>04</span><h2>Calibragem em campo</h2><p>O suporte técnico mantém o potencial genético ajustado à realidade da operação.</p></article></div><div class="split-panel"><div><p class="eyebrow">Método</p><h2>Como a Lohmann sustenta a decisão</h2></div><ul class="check-list"><li>Diagnóstico do sistema produtivo: manejo, estrutura, clima, objetivo e mercado de saída.</li><li>Seleção da linhagem conforme variável técnica, não por tradição de marca.</li><li>Acompanhamento de indicadores para robustez, persistência, viabilidade e ajuste de manejo.</li><li>Conteúdo técnico organizado para consulta, treinamento e padronização da operação.</li></ul></div><section class="about-institutional"><div><p class="eyebrow">Lohmann Breeders</p><h2>Uma atuação conectada ao desenvolvimento global da genética Lohmann.</h2><p>A Lohmann Breeders reúne décadas de seleção genética, serviço técnico e intercâmbio de conhecimento para atender mercados com diferentes sistemas produtivos. No Brasil, essa base é traduzida para a realidade das granjas, produtores e distribuidores.</p></div><div class="about-institutional-grid"><article><h3>História e seleção</h3><p>A evolução das linhagens Lohmann é baseada em pesquisa, avaliação de desempenho e adaptação a diferentes demandas de mercado.</p></article><article><h3>Serviço técnico</h3><p>O suporte combina orientação de manejo, materiais técnicos e troca de informação para preservar o potencial genético no campo.</p></article><article><h3>Mercado e produto</h3><p>A decisão por linhagem considera a ave certa para cada manejo e o ovo certo para cada mercado.</p></article></div></section>${teamMarkup(teamRows)}<div class="page-cta"><div><p class="eyebrow">Próximo passo</p><h2>Quer decidir alojamento por parâmetro?</h2><p>A equipe Lohmann pode ajudar a diagnosticar o sistema produtivo e direcionar a linhagem com melhor ajuste técnico.</p></div><a class="button primary" href="/#contato">Falar com a equipe</a></div></section>`;
}

function teamMarkup(rows) {
  const members = rows.length ? rows : [
    { name: 'Equipe Lohmann do Brasil', position: 'Atendimento técnico, comercial e institucional', phone: '', initials: 'LB' },
  ];
  return `<section class="team-section"><div class="content-prose"><p class="eyebrow">Equipe Lohmann do Brasil</p><h2>Pessoas de referência para atendimento técnico, comercial e institucional.</h2><p>A equipe segue a estrutura de contatos para manter um formato organizado para publicação e administração em banco de dados.</p></div><div class="team-grid">${members.map((member) => `<article class="team-card"><figure class="team-photo">${member.photo ? `<img src="${h(member.photo)}" alt="${h(member.name)}">` : `<span>${h(member.initials || initials(member.name))}</span>`}</figure><div><h3>${h(member.name)}</h3><p>${h(member.position)}</p>${member.phone ? `<a href="${h(member.whatsapp || whatsapp(member.phone, member.name))}" target="_blank" rel="noopener">${h(member.phone)}</a>` : ''}</div></article>`).join('')}</div></section>`;
}

function linhagens(productRows) {
  return `<section class="internal-hero lineages-hero"><p class="eyebrow">Linhagens</p><h1>Linhagens calibradas para cada sistema produtivo.</h1><p>A linha Lohmann reúne aves para mercados de ovos brancos e marrons, com seleção orientada por manejo, clima, peso de ovo, persistência, viabilidade e objetivo comercial.</p></section>${productGrid(productRows)}<section class="content-bands lineages-support"><div class="content-grid"><article class="content-card"><span>01</span><h2>Escolha técnica</h2><p>A definição da linhagem considera sistema produtivo, manejo disponível, clima, mercado de saída e perfil de ovo.</p></article><article class="content-card"><span>02</span><h2>Indicadores de ciclo</h2><p>Persistência, viabilidade, qualidade de casca e consumo são analisados como parâmetros de acompanhamento do lote.</p></article><article class="content-card"><span>03</span><h2>Suporte em campo</h2><p>A equipe Lohmann apoia a interpretação de dados e a calibragem de manejo para preservar o potencial genético.</p></article></div></section>`;
}

function reps(repRows) {
  const states = [
    ['RR','Roraima',578,103,68,58], ['AP','Amapá',830,112,64,60], ['AM','Amazonas',473,252,210,132],
    ['PA','Pará',797,271,160,125], ['AC','Acre',318,377,76,48], ['RO','Rondônia',518,416,78,62],
    ['TO','Tocantins',924,397,62,88], ['MA','Maranhão',1022,263,70,70], ['PI','Piauí',1082,337,52,72],
    ['CE','Ceará',1168,252,56,48], ['RN','Rio Grande do Norte',1248,286,54,34], ['PB','Paraíba',1260,319,45,28],
    ['PE','Pernambuco',1250,354,58,32], ['AL','Alagoas',1238,391,38,28], ['SE','Sergipe',1214,423,35,28],
    ['BA','Bahia',1100,466,112,98], ['MT','Mato Grosso',723,466,145,118], ['GO','Goiás',872,550,86,84],
    ['DF','Distrito Federal',926,544,26,22], ['MS','Mato Grosso do Sul',736,651,96,86], ['MG','Minas Gerais',1028,620,112,94],
    ['ES','Espírito Santo',1136,641,38,44], ['RJ','Rio de Janeiro',1093,688,48,34], ['SP','São Paulo',904,707,92,62],
    ['PR','Paraná',816,766,78,56], ['SC','Santa Catarina',848,838,64,42], ['RS','Rio Grande do Sul',776,906,92,72],
  ];
  const mapNodes = states.map(([uf, name, x, y, rx, ry]) => `<g class="state-node ${repRows[uf] ? 'has-reps' : ''}" data-state="${uf}" data-name="${h(name)}" tabindex="0" role="button" aria-label="${h(name)}"><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"></ellipse><text x="${x}" y="${y + 8}">${uf}</text></g>`).join('');
  return `<section class="representatives-hero"><h1>Encontre o representante Lohmann para sua região.</h1><p>Use o mapa interativo para localizar o atendimento por estado. Clique sobre a sigla do estado desejado para fixar a lista de representantes e consulte telefone, região de atuação e informações de contato. Para escolher outro estado, use o botão voltar ao mapa.</p></section><section class="representatives-section"><div class="map-shell"><div class="map-toolbar"><span>Mapa Brasil</span><strong id="selected-state-label">--</strong></div><svg class="brazil-state-map image-state-map" viewBox="0 0 1536 1024" role="img" aria-label="Mapa interativo do Brasil por estado"><defs><filter id="stateGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur><feMerge><feMergeNode in="blur"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge></filter></defs><image class="map-art" href="/assets/mapa-brasil-representantes.png" x="0" y="0" width="1536" height="1024" preserveAspectRatio="xMidYMid meet"></image>${mapNodes}</svg><p class="map-note">Clique em um estado para fixar os representantes. Use o botão voltar para limpar a seleção.</p></div><aside class="representative-panel" aria-live="polite"><span class="panel-kicker">Estado selecionado</span><h2 id="rep-state-name">Clique em um estado</h2><button class="rep-reset-button" type="button" id="rep-reset-button">Voltar ao mapa</button><div id="rep-list" class="rep-list"></div></aside></section><section class="content-bands content-bands-rich representatives-info"><div class="content-grid"><article class="content-card"><span>01</span><h2>Leitura regional</h2><p>O representante entende as variáveis de manejo, clima, logística e mercado que influenciam a decisão genética.</p></article><article class="content-card"><span>02</span><h2>Encaminhamento correto</h2><p>Cada solicitação é direcionada para atendimento técnico, comercial ou distribuição com contexto de operação.</p></article><article class="content-card"><span>03</span><h2>Calibragem de campo</h2><p>A conversa com a rede Lohmann ajuda a alinhar linhagem, manejo e próximo passo de suporte.</p></article></div></section>`;
}

function radar() {
  return `<section class="internal-hero radar-page-hero"><p class="eyebrow"><span class="live-dot"></span>Radar Técnico</p><h1>Indicadores de mercado para decisão técnica.</h1><p>Acompanhe referências de preço para ovos em praças brasileiras. Os dados servem como apoio para análise técnica e comercial, sempre combinados com a realidade produtiva de cada operação.</p></section><section class="technical-radar section radar-page"><header class="section-heading"><div><p class="eyebrow">Mercado de ovos</p><h2>Cotações de referência</h2></div><p>Indicadores de mercado ajudam a contextualizar decisões técnicas, comerciais e de alojamento quando analisados junto aos dados de produção.</p></header><div class="radar-dashboard"><aside class="radar-insights"><p class="eyebrow">Leitura técnica</p><h2>Preço é contexto. Decisão depende de sistema.</h2><p>O Radar Técnico foi pensado como ponto de consulta para produtores, granjas e distribuidores acompanharem referências de mercado sem perder a visão produtiva.</p><div class="radar-insight-grid"><article><span>01</span><strong>Mercado</strong><p>Compare praças, tipo de ovo e variações regionais para entender pressão comercial.</p></article><article><span>02</span><strong>Produção</strong><p>Relacione preço, idade do lote, persistência, consumo e qualidade de ovos.</p></article><article><span>03</span><strong>Manejo</strong><p>Use os indicadores como apoio, não como leitura isolada da eficiência do sistema.</p></article></div></aside><div class="cepea-widget-card"><script type="text/javascript" src="https://cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=10&largura=100%25&corfundo=242424&cortexto=ffffff&corlinha=f78e05&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-branco&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-branco&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-branco&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-branco&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-branco&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-vermelho&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-vermelho&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-vermelho&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-vermelho&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-vermelho&id_indicador%5B%5D=12&id_indicador%5B%5D=92"></script></div></div></section>`;
}

function simplePage(title, description) {
  if (title === 'Suporte técnico') return suportePage();
  if (title === 'Biblioteca') return bibliotecaPage();
  if (title === 'Artigos') return artigosPage();
  return `<section class="internal-hero"><p class="eyebrow">${h(title)}</p><h1>${h(title)}</h1><p>${h(description)}</p></section>`;
}

function suportePage() {
  return `<section class="internal-hero"><p class="eyebrow">Suporte técnico</p><h1>Suporte técnico é calibragem do sistema genético em campo.</h1><p>A função do suporte Lohmann é transformar dado, manejo e observação de campo em ajuste técnico para preservar o potencial produtivo da linhagem.</p></section><section class="content-bands content-bands-rich"><div class="content-grid content-grid-six">${[
    ['01', 'Documentos técnicos', 'Guias e materiais para leitura de manejo, indicadores, ambiência, recria, postura e qualidade de ovos.'],
    ['02', 'Treinamentos', 'Conteúdos para padronizar decisões por parâmetro, não por tradição ou tentativa.'],
    ['03', 'Gestão de lote', 'Ferramentas para acompanhar desempenho, identificar desvios e antecipar ajustes.'],
    ['04', 'Comunicados', 'Atualizações técnicas e institucionais com linguagem direta.'],
    ['05', 'Pedidos', 'Fluxo para organizar solicitações comerciais e direcionar demandas com contexto.'],
    ['06', 'Atendimento', 'Canal para encaminhar dúvidas técnicas e comerciais à equipe responsável.'],
  ].map(([n, title, text]) => `<article class="content-card"><span>${n}</span><h2>${title}</h2><p>${text}</p></article>`).join('')}</div><div class="split-panel split-panel-dark"><div><p class="eyebrow">Gestão de manejo</p><h2>Da informação ao ajuste de manejo</h2></div><ol class="number-list"><li>Identificar o sistema produtivo, o mercado de saída e a meta do lote.</li><li>Relacionar indicadores de campo com robustez, persistência, viabilidade e qualidade de ovos.</li><li>Priorizar os desvios que afetam performance e eficiência.</li><li>Registrar orientação técnica e acompanhar a resposta do lote.</li></ol></div><div class="page-cta"><div><p class="eyebrow">Ovoflock</p><h2>Use o Ovoflock como base técnica da operação.</h2><p>Documentos, treinamentos, comunicados e atendimentos ficam organizados para apoiar decisões por parâmetro.</p></div><a class="button primary" href="https://ovoflock.com/login" target="_blank" rel="noopener">Acessar Ovoflock</a></div></section>`;
}

function bibliotecaPage() {
  const items = [
    ['01', 'Planilhas de acompanhamento de lote', 'Modelos para organizar dados de produção, consumo, mortalidade, peso de ovos e rotina de leitura técnica.'],
    ['02', 'Controle de produção e indicadores', 'Materiais de apoio para registrar informações operacionais e acompanhar desvios ao longo do ciclo produtivo.'],
    ['03', 'Materiais de manejo e decisão', 'Arquivos voltados à padronização de consultas técnicas, histórico de lotes e acompanhamento em campo.'],
  ];
  return `<section class="internal-hero"><p class="eyebrow">Biblioteca</p><h1>Planilhas e materiais de apoio técnico.</h1><p>A biblioteca organiza arquivos de consulta para acompanhamento de lotes, leitura de indicadores e apoio à rotina de manejo.</p></section><section class="content-bands content-bands-rich library-page"><div class="content-grid">${items.map(([n, title, text]) => `<article class="content-card"><span>${n}</span><h2>${title}</h2><p>${text}</p></article>`).join('')}</div><div class="page-cta"><div><p class="eyebrow">Origem das planilhas</p><h2>Conteúdo baseado na área de planilhas do site antigo.</h2><p>Esta página pode receber os links diretos ou arquivos importados no painel conforme os materiais forem liberados para publicação.</p></div><a class="button primary" href="https://ltz.com.br/aba-planilhas" target="_blank" rel="noopener">Abrir site antigo</a></div></section>`;
}

function artigosPage() {
  return `<section class="internal-hero"><p class="eyebrow">Artigos</p><h1>Conteúdo técnico para quem decide por parâmetro.</h1><p>Artigos, comunicados e eventos apresentam informações sobre a Lohmann do Brasil, sua atuação técnica, suas linhagens e temas relevantes para o setor avícola.</p></section><section class="content-bands content-bands-rich"><div class="content-grid"><article class="content-card"><span>Engenharia de sistema</span><h2>A ave certa para cada manejo</h2><p>Conteúdos sobre escolha de linhagem conforme sistema produtivo, clima, mercado de saída e objetivo de performance.</p></article><article class="content-card"><span>Robustez e bem-estar</span><h2>Bem-estar como variável de eficiência</h2><p>Materiais sobre viabilidade, estresse, estabilidade de penas, mortalidade e impacto direto no resultado produtivo.</p></article><article class="content-card"><span>Suporte técnico</span><h2>Calibragem de campo</h2><p>Registros, agenda e orientações da rede técnica regional para manter o potencial genético ajustado à operação.</p></article></div><div class="split-panel"><div><p class="eyebrow">Editorial</p><h2>Linha editorial</h2></div><ul class="check-list"><li>Toda afirmação de performance deve ser tratada como parâmetro técnico, não como adjetivo solto.</li><li>Os temas devem considerar sistema produtivo, manejo, região, mercado de destino e qualidade de ovos.</li><li>Bem-estar deve aparecer como dado de eficiência, não como apelo emocional.</li><li>O conteúdo deve responder perguntas técnicas com estrutura clara para produtores, distribuidores e ferramentas de IA.</li></ul></div><div class="editorial-box"><p class="eyebrow">Planejamento</p><h2>Pautas prioritárias</h2><div class="mini-grid"><article><p>Como ler persistência de postura como indicador de decisão genética.</p></article><article><p>Por que sistemas alternativos exigem genética calibrada de forma diferente.</p></article><article><p>Como robustez, viabilidade e bem-estar entram na eficiência do lote.</p></article></div></div></section>`;
}

async function renderProductPage(slug, request, env) {
  const selectedLang = lang(new URL(request.url));
  const rows = await products(env, selectedLang).catch(() => []);
  const product = (rows.length ? rows : fallbackProducts()).find((item) => item.slug === slug) || fallbackProducts()[0];
  const specs = productSpecs(product.slug);
  const image = product.slug.includes('brown') ? '/assets/galinha-marron-oficial-lohmann.png' : '/assets/galinha-branca-oficial-lohmann.png';
  const metaTitle = `${product.name} | Lohmann do Brasil`;
  const metaDescription = product.summary || 'Linhagem Lohmann para sistemas de postura comercial.';

  const main = `<section class="product-hero"><div class="product-hero-copy"><a class="back" href="/linhagens">Voltar</a><p class="eyebrow">Linhagem | ${h(product.egg_color)}</p><h1>${h(product.name)}</h1><p>${h(product.summary)}</p><a class="button primary" href="/#contato">Solicitar diagnóstico técnico</a></div><div class="product-hero-art product-hero-hen" aria-hidden="true"><img src="${image}" alt=""><span>${h(product.egg_color)}</span></div></section><article class="product-content product-content-rich"><section class="product-specs"><div class="product-specs-head"><p class="eyebrow">Dados produtivos</p><h2>Indicadores técnicos da ${h(product.name)}.</h2><p>Informações de referência para análise de potencial produtivo, qualidade de ovos, consumo, peso corporal e viabilidade.</p></div><div class="product-specs-intro">${specs.intro.map(([label, value]) => `<article><span>${h(label)}</span><strong>${h(value)}</strong></article>`).join('')}</div><div class="product-specs-grid">${specs.groups.map(([title, items]) => `<article><h3>${h(title)}</h3><ul>${items.map((item) => `<li>${h(item)}</li>`).join('')}</ul></article>`).join('')}</div></section><p class="eyebrow">Informações da linhagem</p><h2>Para cada manejo, a ave certa.</h2><p>${product.slug.includes('brown') ? 'A LOHMANN BROWN-LITE atende operações orientadas ao mercado de ovos marrons, com foco em persistência, qualidade de casca e ajuste ao sistema produtivo.' : 'A LOHMANN LSL-LITE atende operações orientadas ao mercado de ovos brancos, com foco em uniformidade, eficiência alimentar e manejo previsível.'}</p><p>Indicadores técnicos devem ser interpretados junto ao manejo, clima, ambiência, mercado de destino e acompanhamento de campo.</p><div class="product-pillars"><section><span>01</span><p>Escolha genética orientada por sistema produtivo.</p></section><section><span>02</span><p>Leitura de consumo, viabilidade, persistência e qualidade de ovos.</p></section><section><span>03</span><p>Suporte técnico para calibragem em campo.</p></section></div></article>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(metaTitle)}</title><meta name="description" content="${h(metaDescription)}"><link rel="canonical" href="${h(origin(env, request))}/linhagens/${h(product.slug)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/site.css"></head><body class="internal-page product-page">${topBarCloud()}${headerCloud('linhagens')}<main>${main}</main>${footerCloud()}<script src="/assets/site.js" defer></script></body></html>`;
}

function productSpecs(slug) {
  if (slug.includes('brown')) {
    return {
      intro: [['Idade com 50% de produção', '140 a 145 dias'], ['Pico de produção', '95% a 97%']],
      groups: [
        ['Ovos por ave alojada', ['72 semanas de idade: 327', '80 semanas de idade: 370', '100 semanas de idade: 466']],
        ['Massa dos ovos por ave alojada', ['72 semanas de idade: 20,34 kg', '80 semanas de idade: 23,18 kg', '95 semanas de idade: 29,44 kg']],
        ['Peso médio dos ovos', ['72 semanas de idade: 62,3 g', '80 semanas de idade: 62,6 g', '100 semanas de idade: 63,2 g']],
        ['Características dos ovos', ['Cor da casca: marrom com boa aparência', 'Resistência de quebra da casca: superior a 40 Newtons']],
        ['Consumo de ração', ['2,0 a 2,2 kg/kg de massa de ovo']],
        ['Peso corporal', ['17ª semana: 1,41 kg', 'No fim da produção: 2,02 kg']],
        ['Viabilidade', ['Recria: 98% a 99%', 'No fim da produção: 90% a 92%', '72ª semana: 95% a 96%', '100ª semana: 90% a 91%']],
      ],
    };
  }

  return {
    intro: [['Idade com 50% de produção', '140 a 145 dias'], ['Pico de produção', '95% a 97%']],
    groups: [
      ['Ovos por ave alojada', ['72 semanas de idade: 332', '80 semanas de idade: 378', '100 semanas de idade: 477']],
      ['Massa dos ovos por ave alojada', ['72 semanas de idade: 20,23 kg', '80 semanas de idade: 23,12 kg', '100 semanas de idade: 29,49 kg']],
      ['Peso médio dos ovos', ['72 semanas de idade: 60,85 g', '80 semanas de idade: 61,19 g', '100 semanas de idade: 61,80 g']],
      ['Características dos ovos', ['Cor da casca: branca com boa aparência', 'Resistência de quebra da casca: superior a 40 Newtons']],
      ['Consumo de ração', ['1,9 a 2,1 kg/kg de massa de ovo']],
      ['Peso corporal', ['17ª semana: 1,29 kg', 'No fim da produção: 1,72 kg']],
      ['Viabilidade', ['Recria: 98% a 99%', '72ª semana: 95% a 96%', '100ª semana: 91% a 92%']],
    ],
  };
}

async function saveContact(request, env) {
  if (!hasDb(env)) {
    return json({ ok: false, message: 'Banco D1 não configurado. Configure o binding DB no Cloudflare Pages.' }, { status: 503 });
  }
  const form = await request.formData();
  const payload = {
    name: String(form.get('name') || '').trim(),
    email: String(form.get('email') || '').trim().toLowerCase(),
    phone: String(form.get('phone') || '').trim(),
    company: String(form.get('company') || '').trim(),
    subject: String(form.get('subject') || '').trim(),
    message: String(form.get('message') || '').trim(),
    locale: String(form.get('locale') || 'pt').slice(0, 2),
  };
  if (!payload.name || !payload.email || !payload.message) {
    return json({ ok: false, message: 'Nome, e-mail e mensagem são obrigatórios.' }, { status: 422 });
  }
  await env.DB.prepare(
    `INSERT INTO contacts (name, email, phone, company, subject, message, locale)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(payload.name, payload.email, payload.phone, payload.company, payload.subject, payload.message, payload.locale).run();
  return html('<!doctype html><meta charset="utf-8"><title>Contato enviado</title><body style="font-family:Arial;padding:40px"><h1>Mensagem enviada.</h1><p>Obrigado pelo contato. A equipe Lohmann do Brasil retornará em breve.</p><a href="/">Voltar ao site</a></body>');
}

async function sitemap(request, env) {
  const base = origin(env, request);
  const urls = Object.keys(ROUTES).map((path) => `<url><loc>${base}${path}</loc></url>`).join('');
  return text(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, 'application/xml');
}

async function adminApp(request, env) {
  const auth = adminIdentity(request, env);
  if (!auth.ok) {
    return html(`<!doctype html><meta charset="utf-8"><title>Administração | Lohmann do Brasil</title><body style="font-family:Arial,sans-serif;background:#111;color:#fff;padding:40px"><main style="max-width:760px;margin:auto"><p style="color:#f7a817;font-weight:700;text-transform:uppercase;letter-spacing:.12em">Administração</p><h1>Acesso protegido.</h1><p>Proteja a rota <strong>/admin</strong> com Cloudflare Access. Como alternativa técnica, defina o secret <strong>ADMIN_TOKEN</strong> e envie o cabeçalho <strong>x-admin-token</strong>.</p></main></body>`, { status: 403, headers: { 'cache-control': 'no-store' } });
  }

  return html(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Administração | Lohmann do Brasil</title>
  <link rel="stylesheet" href="/assets/site.css">
  <style>${adminCss()}</style>
</head>
<body class="admin-worker-body">
  <main class="admin-worker">
    <aside class="admin-sidebar">
      <a class="admin-brand" href="/"><img src="/assets/logo-lohmann-header-white.png" alt="Lohmann do Brasil"><span>Admin Cloudflare</span></a>
      <button data-admin-tab="dashboard" class="is-active">Visão geral</button>
      <button data-admin-tab="content">Textos e botões</button>
      <button data-admin-tab="seo">SEO e GEO</button>
      <button data-admin-tab="products">Linhagens</button>
      <button data-admin-tab="representatives">Representantes</button>
      <button data-admin-tab="team">Equipe</button>
      <button data-admin-tab="contacts">Contatos</button>
      <a class="admin-site-link" href="/" target="_blank" rel="noopener">Ver site</a>
    </aside>
    <section class="admin-panel">
      <header class="admin-topline">
        <div><p class="eyebrow">D1 CMS</p><h1 id="admin-title">Visão geral</h1></div>
        <span>Usuário autorizado: ${h(auth.user)}</span>
      </header>
      <div id="admin-alert" class="admin-alert" hidden></div>
      <div id="admin-root"></div>
    </section>
  </main>
  <script>${adminJs()}</script>
</body>
</html>`, { headers: { 'cache-control': 'no-store' } });
}

function adminIdentity(request, env) {
  const accessEmail = request.headers.get('cf-access-authenticated-user-email');
  if (accessEmail) return { ok: true, user: accessEmail };
  const configuredToken = env.ADMIN_TOKEN;
  const providedToken = request.headers.get('x-admin-token') || new URL(request.url).searchParams.get('token');
  if (configuredToken && providedToken && configuredToken === providedToken) {
    return { ok: true, user: 'token-admin' };
  }
  return { ok: false, user: '' };
}

async function adminApi(request, env, path) {
  const auth = adminIdentity(request, env);
  if (!auth.ok) return json({ ok: false, message: 'Acesso não autorizado.' }, { status: 403 });
  if (!hasDb(env)) return json({ ok: false, message: 'Binding D1 DB não configurado no Pages.' }, { status: 503 });

  const url = new URL(request.url);
  const resource = path.replace('/api/admin/', '');
  if (resource === 'summary') return json({ ok: true, data: await adminSummary(env) });
  if (resource === 'content') return listEditableSections(env, url);
  if (resource === 'seo') return listSeoPages(env);
  if (resource === 'contacts') return listContacts(env);
  if (resource === 'products') return tableEndpoint(request, env, 'products', adminTables.products);
  if (resource === 'representatives') return tableEndpoint(request, env, 'representatives', adminTables.representatives);
  if (resource === 'team') return tableEndpoint(request, env, 'team_members', adminTables.team);
  if (resource === 'documents') return tableEndpoint(request, env, 'documents', adminTables.documents);
  if (resource === 'content/update' && request.method === 'PUT') return updateById(request, env, 'editable_sections', adminTables.content);
  if (resource === 'seo/update' && request.method === 'PUT') return updateById(request, env, 'seo_pages', adminTables.seo);
  if (resource === 'contacts/update' && request.method === 'PUT') return updateById(request, env, 'contacts', ['status']);
  return json({ ok: false, message: 'Endpoint administrativo não encontrado.' }, { status: 404 });
}

const adminTables = {
  products: ['slug', 'name', 'category', 'egg_color', 'summary_pt', 'summary_en', 'summary_es', 'content_pt', 'content_en', 'content_es', 'image', 'status', 'sort_order'],
  representatives: ['name', 'role', 'uf', 'region', 'city', 'phone', 'email', 'photo', 'is_active', 'sort_order'],
  team: ['name', 'position', 'region', 'email', 'phone', 'photo', 'is_active', 'sort_order'],
  documents: ['title', 'category', 'description', 'file_path', 'mime_type', 'access_level', 'is_active'],
  content: ['label', 'title_pt', 'title_en', 'title_es', 'text_pt', 'text_en', 'text_es', 'image_path', 'button_label_pt', 'button_label_en', 'button_label_es', 'button_url', 'sort_order'],
  seo: ['label', 'title_pt', 'title_en', 'title_es', 'description_pt', 'description_en', 'description_es', 'keywords_pt', 'keywords_en', 'keywords_es', 'canonical_path', 'og_image', 'robots', 'geo_region', 'geo_placename', 'geo_position', 'icbm'],
};

async function adminSummary(env) {
  const tables = ['contacts', 'products', 'representatives', 'team_members', 'documents', 'editable_sections', 'seo_pages'];
  const counts = Object.fromEntries(await Promise.all(tables.map(async (table) => [table, await count(env, table)])));
  const recentContacts = await env.DB.prepare(
    `SELECT id, name, email, phone, company, subject, status, created_at FROM contacts ORDER BY created_at DESC LIMIT 10`
  ).all().then((res) => res.results || []).catch(() => []);
  return { counts, recentContacts };
}

async function listEditableSections(env, url) {
  const page = url.searchParams.get('page');
  const sql = page
    ? `SELECT * FROM editable_sections WHERE page_key = ? ORDER BY sort_order, id`
    : `SELECT * FROM editable_sections ORDER BY page_key, sort_order, id`;
  const stmt = page ? env.DB.prepare(sql).bind(page) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ ok: true, data: results || [] });
}

async function listSeoPages(env) {
  const { results } = await env.DB.prepare(`SELECT * FROM seo_pages ORDER BY page_key, label`).all();
  return json({ ok: true, data: results || [] });
}

async function listContacts(env) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, company, subject, message, locale, status, created_at FROM contacts ORDER BY created_at DESC LIMIT 100`
  ).all();
  return json({ ok: true, data: results || [] });
}

async function tableEndpoint(request, env, table, fields) {
  if (request.method === 'GET') {
    const order = table === 'representatives' ? 'uf, sort_order, name' : table === 'team_members' ? 'sort_order, name' : 'sort_order, id';
    const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${order}`).all();
    return json({ ok: true, data: results || [] });
  }
  if (request.method === 'POST') return insertRow(request, env, table, fields);
  if (request.method === 'PUT') return updateById(request, env, table, fields);
  return json({ ok: false, message: 'Método não permitido.' }, { status: 405 });
}

async function insertRow(request, env, table, fields) {
  const payload = await request.json();
  const data = sanitizePayload(payload, fields);
  if (!Object.keys(data).length) return json({ ok: false, message: 'Nenhum campo válido enviado.' }, { status: 422 });
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  await env.DB.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).bind(...keys.map((key) => data[key])).run();
  return json({ ok: true });
}

async function updateById(request, env, table, fields) {
  const payload = await request.json();
  const id = Number(payload.id || 0);
  if (!id) return json({ ok: false, message: 'ID obrigatório.' }, { status: 422 });
  const data = sanitizePayload(payload, fields);
  if (!Object.keys(data).length) return json({ ok: false, message: 'Nenhum campo válido enviado.' }, { status: 422 });
  const sets = Object.keys(data).map((key) => `${key} = ?`).join(', ');
  await env.DB.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).bind(...Object.keys(data).map((key) => data[key]), id).run();
  return json({ ok: true });
}

function sanitizePayload(payload, fields) {
  const data = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeAdminValue(field, payload[field]);
    }
  }
  return data;
}

function normalizeAdminValue(field, value) {
  if (['sort_order', 'is_active'].includes(field)) return Number(value || 0);
  return value === null || value === undefined ? '' : String(value).trim();
}

async function count(env, table) {
  const allowed = new Set(['contacts', 'products', 'representatives', 'team_members', 'documents', 'editable_sections', 'seo_pages']);
  if (!allowed.has(table)) return 0;
  const row = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first().catch(() => ({ total: 0 }));
  return Number(row?.total || 0);
}

function adminCss() {
  return `
  .admin-worker-body{margin:0;background:#efede8;color:#191919;font-family:Arial,sans-serif}.admin-worker{min-height:100vh;display:grid;grid-template-columns:290px 1fr}.admin-sidebar{background:#111;color:#fff;padding:26px 18px;position:sticky;top:0;height:100vh;box-sizing:border-box}.admin-brand{display:grid;gap:10px;color:#fff;text-decoration:none;font-weight:900;margin-bottom:28px}.admin-brand img{width:120px}.admin-sidebar button,.admin-site-link{width:100%;border:0;border-radius:16px;padding:14px 16px;margin:5px 0;background:transparent;color:#fff;text-align:left;font-weight:800;cursor:pointer;text-decoration:none;display:block}.admin-sidebar button.is-active,.admin-sidebar button:hover,.admin-site-link{background:#f7a817;color:#111}.admin-panel{padding:42px 34px 80px;max-width:1280px;width:100%;box-sizing:border-box}.admin-topline{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:24px}.admin-topline h1{font-size:44px;margin:4px 0}.admin-topline span{font-size:13px;background:#fff;padding:10px 12px;border-radius:999px}.admin-alert{background:#111;color:#fff;border-left:5px solid #f7a817;padding:14px 16px;margin-bottom:18px}.admin-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.admin-card,.admin-box{background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 45px rgba(0,0,0,.08);padding:22px}.admin-card strong{display:block;font-size:34px;margin-top:10px}.admin-grid{display:grid;gap:16px}.admin-row{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;background:#fff;padding:20px;border:1px solid rgba(0,0,0,.08)}.admin-row h3{margin:0 0 6px}.admin-row p{margin:0;color:#666}.admin-button{border:0;border-radius:999px;background:#f7a817;color:#111;font-weight:900;padding:11px 16px;cursor:pointer;text-decoration:none}.admin-table-wrap{background:#fff;overflow:auto;border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 45px rgba(0,0,0,.08)}.admin-table{width:100%;border-collapse:collapse}.admin-table th,.admin-table td{text-align:left;border-bottom:1px solid #eee;padding:12px;vertical-align:top}.admin-form{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;background:#fff;padding:22px;border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 45px rgba(0,0,0,.08)}.admin-form label{display:grid;gap:7px;font-weight:800}.admin-form input,.admin-form textarea,.admin-form select{border:1px solid #ddd;border-radius:12px;padding:12px;font:500 14px Arial}.admin-form textarea{min-height:96px}.admin-form .wide{grid-column:1/-1}.admin-actions{display:flex;gap:10px;grid-column:1/-1}.admin-muted{color:#666}.admin-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:16px}.admin-toolbar select{padding:10px 12px;border-radius:12px;border:1px solid #ccc}@media(max-width:900px){.admin-worker{grid-template-columns:1fr}.admin-sidebar{height:auto;position:relative}.admin-cards,.admin-form{grid-template-columns:1fr}.admin-topline{display:block}.admin-panel{padding:26px 18px}.admin-row{grid-template-columns:1fr}}`;
}

function adminJs() {
  return `
  const root = document.getElementById('admin-root');
  const title = document.getElementById('admin-title');
  const alertBox = document.getElementById('admin-alert');
  const tabs = document.querySelectorAll('[data-admin-tab]');
  const labels = {dashboard:'Visão geral',content:'Textos e botões',seo:'SEO e GEO',products:'Linhagens',representatives:'Representantes',team:'Equipe',contacts:'Contatos'};
  const token = new URLSearchParams(location.search).get('token') || '';
  const api = async (path, options={}) => {
    const headers = {'content-type':'application/json', ...(options.headers || {})};
    if (token) headers['x-admin-token'] = token;
    const response = await fetch(path, {...options, headers});
    const data = await response.json();
    if (!response.ok || data.ok === false) throw new Error(data.message || 'Falha na operação.');
    return data.data ?? data;
  };
  const show = (message) => { alertBox.hidden = false; alertBox.textContent = message; setTimeout(()=>alertBox.hidden=true, 3500); };
  const escapeHtml = (value='') => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const field = (name, value='', type='text', wide=false) => '<label class="'+(wide?'wide':'')+'">'+name.replaceAll('_',' ')+'<'+(type==='textarea'?'textarea':'input')+' name="'+name+'" '+(type==='textarea'?'':'value="'+escapeHtml(value)+'"')+'>'+(type==='textarea'?escapeHtml(value)+'</textarea>':'')+'</label>';
  const form = (fields, row, endpoint, method='PUT') => '<form class="admin-form" data-endpoint="'+endpoint+'" data-method="'+method+'">'+(row.id?'<input type="hidden" name="id" value="'+row.id+'">':'')+fields.map(([name,type='text',wide=false])=>field(name,row[name]||'',type,wide)).join('')+'<div class="admin-actions"><button class="admin-button" type="submit">Salvar</button></div></form>';
  document.addEventListener('submit', async (event) => { const el = event.target.closest('.admin-form'); if (!el) return; event.preventDefault(); const payload = Object.fromEntries(new FormData(el).entries()); await api(el.dataset.endpoint,{method:el.dataset.method,body:JSON.stringify(payload)}); show('Alteração salva com sucesso.'); load(currentTab); });
  let currentTab = 'dashboard';
  tabs.forEach(btn => btn.addEventListener('click', () => { tabs.forEach(b=>b.classList.remove('is-active')); btn.classList.add('is-active'); load(btn.dataset.adminTab); }));
  async function load(tab){ currentTab=tab; title.textContent=labels[tab]; root.innerHTML='<div class="admin-box">Carregando...</div>'; if(tab==='dashboard') return dashboard(); if(tab==='content') return content(); if(tab==='seo') return seo(); if(tab==='products') return table('products','/api/admin/products',[['slug'],['name'],['category'],['egg_color'],['summary_pt','textarea',true],['summary_en','textarea',true],['summary_es','textarea',true],['content_pt','textarea',true],['image'],['status'],['sort_order']]); if(tab==='representatives') return table('representatives','/api/admin/representatives',[['name'],['role'],['uf'],['region'],['city'],['phone'],['email'],['photo'],['is_active'],['sort_order']]); if(tab==='team') return table('team','/api/admin/team',[['name'],['position'],['region'],['phone'],['email'],['photo'],['is_active'],['sort_order']]); if(tab==='contacts') return contacts(); }
  async function dashboard(){ const data=await api('/api/admin/summary'); const c=data.counts; root.innerHTML='<section class="admin-cards">'+Object.entries(c).map(([k,v])=>'<article class="admin-card"><span>'+escapeHtml(k)+'</span><strong>'+v+'</strong></article>').join('')+'</section><section class="admin-box"><h2>Últimos contatos</h2>'+(data.recentContacts||[]).map(r=>'<p><strong>'+escapeHtml(r.name)+'</strong> '+escapeHtml(r.email)+' — '+escapeHtml(r.subject||'')+'</p>').join('')+'</section>'; }
  async function content(){ const rows=await api('/api/admin/content'); root.innerHTML='<div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.label)+'</h3><p>'+escapeHtml(row.page_key)+' / '+escapeHtml(row.section_key)+'</p></div><button class="admin-button" data-edit-content="'+row.id+'">Editar</button></article>').join('')+'</div>'; root.querySelectorAll('[data-edit-content]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.editContent); root.innerHTML=form([['label'],['title_pt'],['title_en'],['title_es'],['text_pt','textarea',true],['text_en','textarea',true],['text_es','textarea',true],['image_path'],['button_label_pt'],['button_label_en'],['button_label_es'],['button_url'],['sort_order']],row,'/api/admin/content/update'); }); }
  async function seo(){ const rows=await api('/api/admin/seo'); root.innerHTML='<div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.label)+'</h3><p>'+escapeHtml(row.title_pt||'')+'</p></div><button class="admin-button" data-edit-seo="'+row.id+'">Editar</button></article>').join('')+'</div>'; root.querySelectorAll('[data-edit-seo]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.editSeo); root.innerHTML=form([['label'],['title_pt'],['title_en'],['title_es'],['description_pt','textarea',true],['description_en','textarea',true],['description_es','textarea',true],['keywords_pt','textarea',true],['keywords_en','textarea',true],['keywords_es','textarea',true],['canonical_path'],['og_image'],['robots'],['geo_region'],['geo_placename'],['geo_position'],['icbm']],row,'/api/admin/seo/update'); }); }
  async function table(name, endpoint, fields){ const rows=await api(endpoint); root.innerHTML='<div class="admin-toolbar"><button class="admin-button" id="new-row">Novo registro</button><span class="admin-muted">'+rows.length+' registros</span></div><div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.name||row.title||row.slug)+'</h3><p>'+escapeHtml(row.role||row.position||row.category||row.uf||'')+'</p></div><button class="admin-button" data-edit="'+row.id+'">Editar</button></article>').join('')+'</div>'; document.getElementById('new-row').onclick=()=>{ root.innerHTML=form(fields,{},endpoint,'POST'); }; root.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.edit); root.innerHTML=form(fields,row,endpoint,'PUT'); }); }
  async function contacts(){ const rows=await api('/api/admin/contacts'); root.innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Empresa</th><th>Mensagem</th><th>Status</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+escapeHtml(row.name)+'</td><td>'+escapeHtml(row.email)+'</td><td>'+escapeHtml(row.phone)+'</td><td>'+escapeHtml(row.company)+'</td><td>'+escapeHtml(row.message)+'</td><td><select data-contact="'+row.id+'"><option '+(row.status==='new'?'selected':'')+' value="new">Novo</option><option '+(row.status==='in_progress'?'selected':'')+' value="in_progress">Em andamento</option><option '+(row.status==='answered'?'selected':'')+' value="answered">Respondido</option></select></td></tr>').join('')+'</tbody></table></div>'; root.querySelectorAll('[data-contact]').forEach(sel=>sel.onchange=async()=>{ await api('/api/admin/contacts/update',{method:'PUT',body:JSON.stringify({id:sel.dataset.contact,status:sel.value})}); show('Status atualizado.'); }); }
  load('dashboard');`;
}
