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

    if (path === '/api/products') return json(await products(env, lang(url)));
    if (path === '/api/representatives') return json(await representatives(env));
    if (path === '/api/team') return json(await team(env));
    if (path === '/api/contact' && request.method === 'POST') return saveContact(request, env);
    if (path.startsWith('/api/admin/')) return adminApi(request, env, path);
    if (path === '/admin') return adminApp(request, env);

    if (path === '/sitemap.xml') return sitemap(request, env);
    if (path === '/robots.txt') return text(`User-agent: *\nAllow: /\nSitemap: ${origin(env, request)}/sitemap.xml\n`, 'text/plain');

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
  <script>window.LohmannRepresentatives = ${JSON.stringify(repRows)}; window.LohmannFallbackRepresentatives = [];</script>
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
  const rows = productRows.length ? productRows : [
    { slug: 'lohmann-lsl-lite', name: 'LOHMANN LSL-LITE', egg_color: 'Ovos brancos', summary: 'Linhagem calibrada para uniformidade, eficiência alimentar e manejo previsível.' },
    { slug: 'lohmann-brown-lite', name: 'LOHMANN BROWN-LITE', egg_color: 'Ovos marrons', summary: 'Linhagem projetada para eficiência, persistência e ajuste ao mercado.' },
  ];
  return `<section class="products section" id="linhagens"><header class="section-heading"><div><p class="eyebrow">Portfólio Lohmann</p><h2>Linhagens calibradas por manejo, clima e mercado.</h2></div></header><div class="product-grid">${rows.map((product, index) => `<article class="product-card reveal"><div class="product-art product-art-${index + 1}"><span>0${index + 1}</span><img class="product-hen official-hen" src="/assets/${product.slug.includes('brown') ? 'galinha-marron-oficial-lohmann.png' : 'galinha-branca-oficial-lohmann.png'}" alt="${h(product.name)}"></div><div class="product-copy"><small>${h(product.egg_color)}</small><h3>${h(product.name)}</h3><p>${h(product.summary)}</p><a href="/linhagens">Ver detalhes <b>+</b></a></div></article>`).join('')}</div></section>`;
}

function sobre(teamRows) {
  return `<section class="internal-hero"><p class="eyebrow">A Lohmann</p><h1>Genética avícola com presença técnica no campo.</h1><p>A Lohmann do Brasil atua junto a produtores, granjas e distribuidores com linhagens comerciais de postura, materiais técnicos e acompanhamento de campo.</p></section><section class="content-bands content-bands-rich"><div class="content-grid content-grid-four"><article class="content-card"><span>01</span><h2>Genética</h2><p>Seleção orientada por eficiência, viabilidade, persistência e qualidade de ovos.</p></article><article class="content-card"><span>02</span><h2>Manejo</h2><p>Leitura técnica para adaptar a linhagem ao sistema produtivo.</p></article><article class="content-card"><span>03</span><h2>Mercado</h2><p>A ave certa para cada manejo e o ovo certo para cada mercado.</p></article><article class="content-card"><span>04</span><h2>Campo</h2><p>Rede técnica para atendimento regional e acompanhamento de indicadores.</p></article></div>${teamMarkup(teamRows)}</section>`;
}

function teamMarkup(rows) {
  if (!rows.length) return '';
  return `<section class="team-section"><div class="content-prose"><p class="eyebrow">Equipe Lohmann do Brasil</p><h2>Pessoas de referência para atendimento técnico, comercial e institucional.</h2></div><div class="team-grid">${rows.map((member) => `<article class="team-card"><figure class="team-photo">${member.photo ? `<img src="${h(member.photo)}" alt="${h(member.name)}">` : `<span>${h(member.initials)}</span>`}</figure><div><h3>${h(member.name)}</h3><p>${h(member.position)}</p>${member.phone ? `<a href="${h(member.whatsapp)}" target="_blank" rel="noopener">${h(member.phone)}</a>` : ''}</div></article>`).join('')}</div></section>`;
}

function linhagens(productRows) {
  return `<section class="internal-hero lineages-hero"><p class="eyebrow">Linhagens</p><h1>Linhagens calibradas para cada sistema produtivo.</h1><p>A linha Lohmann reúne aves para mercados de ovos brancos e marrons, com seleção orientada por manejo, clima, peso de ovo, persistência, viabilidade e objetivo comercial.</p></section>${productGrid(productRows)}<section class="content-bands lineages-support"><div class="content-grid"><article class="content-card"><span>LSL</span><h2>LOHMANN LSL-LITE</h2><p>50% de produção entre 140 e 145 dias, pico entre 95% e 97% e foco em ovos brancos com boa aparência e resistência de casca.</p></article><article class="content-card"><span>BR</span><h2>LOHMANN BROWN-LITE</h2><p>50% de produção entre 140 e 145 dias, pico entre 95% e 97% e foco em ovos marrons com persistência e qualidade de casca.</p></article></div></section>`;
}

function reps(repRows) {
  const buttons = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
  return `<section class="internal-hero reps-hero"><p class="eyebrow">Representantes</p><h1>Encontre sua rede técnica regional.</h1><p>Clique em um estado no mapa para fixar a lista de representantes ao lado. Para voltar ao mapa completo, use o botão de retorno.</p></section><section class="representatives-section"><div class="map-shell"><div class="map-label"><span>Estado selecionado</span><strong id="selected-state-label">--</strong></div><img class="brazil-map-image" src="/assets/mapa-brasil-representantes.png" alt="Mapa do Brasil">${buttons.map((uf) => `<button class="state-node state-${uf.toLowerCase()}" data-state="${uf}" data-name="${uf}" type="button">${uf}</button>`).join('')}</div><aside class="representatives-panel"><button id="rep-reset-button" class="button primary" type="button" hidden>Voltar ao mapa</button><p class="eyebrow">Estado selecionado</p><h2 id="rep-state-name">Clique em um estado</h2><div id="rep-list"></div></aside></section>`;
}

function radar() {
  return `<section class="internal-hero radar-page-hero"><p class="eyebrow">Radar Técnico</p><h1>Indicadores de mercado para apoio à leitura técnica.</h1><p>A página centraliza dados de referência para acompanhar movimentos do setor e apoiar a rotina comercial e produtiva.</p></section><section class="radar-page-grid"><article class="content-card"><span>Leitura</span><h2>Como usar os dados</h2><p>Os indicadores ajudam a observar tendências, comparar praças e contextualizar decisões de alojamento, manejo e comercialização.</p></article><div class="cepea-widget"><script type="text/javascript" src="https://cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=10&largura=400px&corfundo=111111&cortexto=ffffff&corlinha=f78e05&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-branco&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-branco&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-branco&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-branco&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-branco&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-vermelho&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-vermelho&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-vermelho&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-vermelho&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-vermelho&id_indicador%5B%5D=12&id_indicador%5B%5D=92"></script></div></section>`;
}

function simplePage(title, description) {
  return `<section class="internal-hero"><p class="eyebrow">${h(title)}</p><h1>${h(title)}</h1><p>${h(description)}</p></section><section class="content-bands"><div class="content-grid"><article class="content-card"><span>01</span><h2>Conteúdo administrável</h2><p>Esta página está preparada para receber dados do D1 e evoluir com novos módulos no painel.</p></article><article class="content-card"><span>02</span><h2>Estrutura Cloudflare</h2><p>Assets estáticos, rotas no Worker e dados versionados em migrations D1.</p></article></div></section>`;
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
