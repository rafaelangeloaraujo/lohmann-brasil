const LANGS = new Set(['pt', 'en', 'es']);
const ASSET_VERSION = '20260827-mobile-report-share';
const GOOGLE_ANALYTICS_ID = 'G-0E2FLEYP1B';
const ARTICLE_142_PDF = '/assets/biblioteca/a-hora-do-ovo-142-lohmann.pdf';

function googleAnalyticsTag() {
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GOOGLE_ANALYTICS_ID}');
  </script>`;
}

const ROUTES = {
  '/': 'home',
  '/a-lohmann': 'sobre',
  '/linhagens': 'linhagens',
  '/representantes': 'representantes',
  '/suporte-tecnico': 'suporte',
  '/base-de-conhecimento': 'biblioteca',
  '/base-de-conhecimento/genetica-que-se-confirma-no-campo': 'artigoLohmann142',
  '/artigos/genetica-que-se-confirma-no-campo': 'artigoLohmann142',
  '/radar-tecnico': 'radar',
};

const LEGACY_REDIRECTS = {
  '/index.php': '/',
  '/sobre.php': '/a-lohmann',
  '/linhagens.php': '/linhagens',
  '/representantes.php': '/representantes',
  '/suporte-tecnico.php': '/suporte-tecnico',
  '/biblioteca': '/base-de-conhecimento',
  '/biblioteca.php': '/base-de-conhecimento',
  '/artigos': '/base-de-conhecimento',
  '/artigos/artigo-exemplo': '/base-de-conhecimento/genetica-que-se-confirma-no-campo',
  '/noticias.php': '/base-de-conhecimento',
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
  suporte: {
    title: 'Suporte técnico | Lohmann do Brasil',
    description: 'Acompanhamento técnico para manejo, leitura de indicadores e organização da rotina produtiva.',
  },
  biblioteca: {
    title: 'Base de Conhecimento | Lohmann do Brasil',
    description: 'Guias de manejo, planilhas de acompanhamento e materiais técnicos para apoio à rotina produtiva.',
  },
  radar: {
    title: 'Radar de Mercado | Lohmann do Brasil',
    description: 'Indicadores de mercado para apoio à leitura técnica do setor avícola.',
  },
  artigoLohmann142: {
    title: 'Genética que se confirma no campo | Lohmann do Brasil',
    description: 'Artigo sobre os resultados de clientes Lohmann do Brasil destacados na edição 142 da revista A Hora do Ovo.',
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = normalizePath(url.pathname);
    const langPrefix = path.match(/^\/(en|es)(\/.*)?$/);
    if (langPrefix) {
      url.searchParams.set('lang', langPrefix[1]);
      path = normalizePath(langPrefix[2] || '/');
    }

    if (path === '/download/a-hora-do-ovo-142-lohmann.pdf') {
      return downloadAsset(request, env, ARTICLE_142_PDF, 'A_Hora_do_Ovo_142_Lohmann_do_Brasil.pdf');
    }

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
    if (path.startsWith('/api/admin/')) return adminApi(request, env, path).catch((error) => json({ ok: false, message: error?.message || 'Erro ao carregar dados administrativos.' }, { status: 500 }));
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
  const pathLang = url.pathname.match(/^\/(en|es)(\/|$)/)?.[1];
  const value = url.searchParams.get('lang') || pathLang || 'pt';
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

async function downloadAsset(request, env, assetPath, filename) {
  const assetUrl = new URL(assetPath, request.url);
  const assetResponse = env.ASSETS
    ? await env.ASSETS.fetch(new Request(assetUrl.toString(), request))
    : await fetch(assetUrl.toString());

  if (!assetResponse.ok) {
    return new Response('Arquivo não encontrado para download.', {
      status: 404,
      headers: securityHeaders(),
    });
  }

  const headers = new Headers(assetResponse.headers);
  headers.set('content-type', 'application/pdf');
  headers.set('content-disposition', `attachment; filename="${filename}"`);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  Object.entries(securityHeaders()).forEach(([key, value]) => headers.set(key, value));

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    headers,
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
  if (!hasDb(env)) return fallbackProducts(selectedLang);
  const column = selectedLang === 'en' ? 'summary_en' : selectedLang === 'es' ? 'summary_es' : 'summary_pt';
  const { results } = await env.DB.prepare(
    `SELECT slug, name, category, egg_color, ${column} AS summary, image
     FROM products
     WHERE status = 'published'
     ORDER BY CASE WHEN slug = 'lohmann-lsl-lite' THEN 0 WHEN slug = 'lohmann-brown-lite' THEN 1 ELSE 2 END, sort_order, name`
  ).all();
  return (results || []).map((product) => ({
    ...product,
    egg_color: translatedEggColor(product.egg_color, selectedLang),
    summary: product.summary || fallbackProductSummary(product.slug, selectedLang),
  }));
}

async function representatives(env) {
  if (!hasDb(env)) return fallbackRepresentativeMap();
  const { results } = await env.DB.prepare(
    `SELECT name, role, uf, region, city, phone, email, photo
     FROM representatives
     WHERE is_active = 1
     ORDER BY uf, sort_order, name`
  ).all();

  if (!results?.length) return fallbackRepresentativeMap();

  return results.reduce((grouped, item) => {
    const uf = item.uf || 'BR';
    grouped[uf] ||= [];
    grouped[uf].push({
      ...item,
      photo: item.photo || representativePhoto(item.name),
      initials: initials(item.name),
      whatsapp: whatsapp(item.phone, item.name),
    });
    return grouped;
  }, {});
}

function fallbackRepresentativeMap() {
  const rows = [
    ['Jalmir Moy', 'Representante comercial', 'RS', 'Rio Grande do Sul', 'RS', '54 99974-8703', '/assets/representantes/jalmir-moy.png', 10],
    ['Silvio Schlickmann', 'Representante comercial', 'SC', 'Santa Catarina', 'SC', '48 99947-1314', '/assets/representantes/silvio-schlickmann.png', 20],
    ['Alessandro Martini', 'Representante comercial', 'PR', 'Paraná, São Paulo e Goiás', 'PR / SP / GO', '43 99122-3263', '/assets/representantes/alessandro-martini.png', 30],
    ['Alessandro Martini', 'Representante comercial', 'SP', 'Paraná, São Paulo e Goiás', 'PR / SP / GO', '43 99122-3263', '/assets/representantes/alessandro-martini.png', 31],
    ['Alessandro Martini', 'Representante comercial', 'GO', 'Paraná, São Paulo e Goiás', 'PR / SP / GO', '43 99122-3263', '/assets/representantes/alessandro-martini.png', 32],
    ['Carlos Gastali', 'Representante comercial', 'MS', 'Mato Grosso do Sul e São Paulo (Bastos)', 'MS / Bastos, SP', '14 99857-6450', '', 40],
    ['Carlos Gastali', 'Representante comercial', 'SP', 'Mato Grosso do Sul e São Paulo (Bastos)', 'MS / Bastos, SP', '14 99857-6450', '', 41],
    ['Jair Luis', 'Representante comercial', 'SP', 'Atendimento comercial regional', 'SP', '14 99786-7924', '/assets/representantes/jair-luis.png', 50],
    ['Matheus Fraga', 'Representante comercial', 'MG', 'Minas Gerais', 'MG', '17 99772-0946', '/assets/team/matheus-fraga.jpg', 60],
    ['Roberson Bergamini', 'Representante comercial', 'MT', 'Mato Grosso, Rondônia e Acre', 'MT / RO / AC', '66 99995-9998', '/assets/representantes/roberson-bergamini.png', 70],
    ['Roberson Bergamini', 'Representante comercial', 'RO', 'Mato Grosso, Rondônia e Acre', 'MT / RO / AC', '66 99995-9998', '/assets/representantes/roberson-bergamini.png', 71],
    ['Roberson Bergamini', 'Representante comercial', 'AC', 'Mato Grosso, Rondônia e Acre', 'MT / RO / AC', '66 99995-9998', '/assets/representantes/roberson-bergamini.png', 72],
    ['Carlos Alberto', 'Representante comercial', 'RJ', 'Rio de Janeiro', 'RJ', '24 99264-2087', '', 80],
    ['Gilberto Shwamback', 'Representante comercial', 'ES', 'Espírito Santo', 'ES', '27 99983-7167', '/assets/representantes/gilberto-shwamback.png', 90],
    ['Cintia Fernandes', 'Representante comercial', 'TO', 'Tocantins', 'TO', '62 98133-6390', '/assets/representantes/cintia-fernandes.png', 100],
    ['Thiago Dias', 'Representante comercial', 'BA', 'Bahia e Sergipe', 'BA / SE', '79 99987-8819', '/assets/representantes/thiago-dias.png', 110],
    ['Thiago Dias', 'Representante comercial', 'SE', 'Bahia e Sergipe', 'BA / SE', '79 99987-8819', '/assets/representantes/thiago-dias.png', 111],
    ['Eduardo Galvão', 'Representante comercial', 'AL', 'Alagoas e Pernambuco (São Bento do Una)', 'AL / PE', '82 9 9641-4435', '/assets/representantes/eduardo-galvao.png', 120],
    ['Eduardo Galvão', 'Representante comercial', 'PE', 'Alagoas e Pernambuco (São Bento do Una)', 'AL / PE', '82 9 9641-4435', '/assets/representantes/eduardo-galvao.png', 121],
    ['Charles Lima', 'Gerente Comercial Norte e Nordeste', 'PE', 'Pernambuco, Paraíba e Rio Grande do Norte', 'PE / PB / RN', '17 99757-0688', '/assets/team/charles-lima.jpg', 130],
    ['Charles Lima', 'Gerente Comercial Norte e Nordeste', 'PB', 'Pernambuco, Paraíba e Rio Grande do Norte', 'PE / PB / RN', '17 99757-0688', '/assets/team/charles-lima.jpg', 131],
    ['Charles Lima', 'Gerente Comercial Norte e Nordeste', 'RN', 'Pernambuco, Paraíba e Rio Grande do Norte', 'PE / PB / RN', '17 99757-0688', '/assets/team/charles-lima.jpg', 132],
    ['Valdir Castiglioni', 'Representante comercial', 'CE', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', '', 140],
    ['Valdir Castiglioni', 'Representante comercial', 'PI', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', '', 141],
    ['Valdir Castiglioni', 'Representante comercial', 'MA', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', '', 142],
    ['Valdir Castiglioni', 'Representante comercial', 'PA', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', '', 143],
    ['Departamento Comercial', 'Atendimento comercial', 'AM', 'Demais estados', 'AM / AP / RR / DF', '17 99757-2703', '', 200],
    ['Departamento Comercial', 'Atendimento comercial', 'AP', 'Demais estados', 'AM / AP / RR / DF', '17 99757-2703', '', 201],
    ['Departamento Comercial', 'Atendimento comercial', 'RR', 'Demais estados', 'AM / AP / RR / DF', '17 99757-2703', '', 202],
    ['Departamento Comercial', 'Atendimento comercial', 'DF', 'Demais estados', 'AM / AP / RR / DF', '17 99757-2703', '', 203],
  ];

  return rows.reduce((grouped, [name, role, uf, region, city, phone, photo]) => {
    grouped[uf] ||= [];
    grouped[uf].push({
      name,
      role,
      uf,
      region,
      city,
      phone,
      email: '',
      photo,
      initials: initials(name),
      whatsapp: whatsapp(phone, name),
    });
    return grouped;
  }, {});
}
async function team(env) {
  if (!hasDb(env)) return fallbackTeamMembers();
  const { results } = await env.DB.prepare(
    `SELECT name, position, region, phone, email, photo
     FROM team_members
     WHERE is_active = 1
     ORDER BY sort_order, name`
  ).all();
  if (!results?.length) return fallbackTeamMembers();
  return results.map((item) => ({
    ...item,
    photo: item.photo || teamPhoto(item.name),
    initials: initials(item.name),
    whatsapp: whatsapp(item.phone, item.name),
  }));
}

function fallbackTeamMembers() {
  return [
    ['Leomar Klassmann', 'Diretor Geral', '17 99645-3745', '/assets/team/leomar-klassmann.jpg'],
    ['Marcos Borges', 'Consultor de contas chaves', '17 99714-7837', '/assets/team/marcos-borges.jpg'],
    ['Charles Lima', 'Gerente Comercial Norte e Nordeste', '17 99757-0688', '/assets/team/charles-lima.jpg'],
    ['Matheus Fraga', 'Diretor Técnico', '17 99772-0946', '/assets/team/matheus-fraga.jpg'],
    ['Guilherme Ferreira', 'Analista de programação', '17 99757-2703', '/assets/team/guilherme-ferreira.jpg'],
    ['Judson Soares', 'Assistente Técnico', '17 99641-3574', '/assets/team/judson-soares.jpg'],
    ['Felipe Kawamura', 'Assistente Técnico', '17 99739-3152', '/assets/team/felipe-kawamura.jpg'],
  ].map(([name, position, phone, photo]) => ({
    name,
    position,
    region: 'Lohmann do Brasil',
    phone,
    email: '',
    photo,
    initials: initials(name),
    whatsapp: whatsapp(phone, name),
  }));
}

function teamPhoto(name) {
  const key = String(name || '').toLowerCase();
  if (key.includes('leomar')) return '/assets/team/leomar-klassmann.jpg';
  if (key.includes('marcos')) return '/assets/team/marcos-borges.jpg';
  if (key.includes('charles')) return '/assets/team/charles-lima.jpg';
  if (key.includes('matheus')) return '/assets/team/matheus-fraga.jpg';
  if (key.includes('guilherme')) return '/assets/team/guilherme-ferreira.jpg';
  if (key.includes('judson')) return '/assets/team/judson-soares.jpg';
  if (key.includes('felipe')) return '/assets/team/felipe-kawamura.jpg';
  return '';
}

function representativePhoto(name) {
  const key = String(name || '').toLowerCase();
  if (key.includes('charles')) return '/assets/team/charles-lima.jpg';
  if (key.includes('matheus')) return '/assets/team/matheus-fraga.jpg';
  return '';
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

async function seo(env, pageKey, request, selectedLang = 'pt') {
  const fallback = pageFallback[pageKey] || pageFallback.home;
  const row = hasDb(env)
    ? await env.DB.prepare('SELECT * FROM seo_pages WHERE page_key = ? LIMIT 1').bind(pageKey).first().catch(() => null)
    : null;
  const base = origin(env, request);
  const path = ROUTES_REVERSE[pageKey] || '/';
  const suffix = selectedLang === 'pt' ? '' : `?lang=${selectedLang}`;
  const titleField = selectedLang === 'en' ? 'title_en' : selectedLang === 'es' ? 'title_es' : 'title_pt';
  const descriptionField = selectedLang === 'en' ? 'description_en' : selectedLang === 'es' ? 'description_es' : 'description_pt';
  const keywordsField = selectedLang === 'en' ? 'keywords_en' : selectedLang === 'es' ? 'keywords_es' : 'keywords_pt';
  const fallbackMeta = translatedMeta(pageKey, selectedLang, fallback);
  return {
    title: row?.[titleField] || fallbackMeta.title,
    description: row?.[descriptionField] || fallbackMeta.description,
    keywords: row?.[keywordsField] || '',
    canonical: `${base}${path}${suffix}`,
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

function translatedMeta(pageKey, selectedLang, fallback) {
  if (selectedLang === 'pt') return fallback;
  const en = {
    home: ['Lohmann do Brasil | Poultry genetics and technical support', 'Layer strains, technical support and information for producers, farms and distributors in Brazil.'],
    sobre: ['About Lohmann | Lohmann do Brasil', 'Institutional presence of Lohmann do Brasil in layer genetics, technical support and the poultry sector.'],
    linhagens: ['Lohmann Strains | Lohmann do Brasil', 'LOHMANN LSL-LITE and LOHMANN BROWN-LITE strains for different production systems and markets.'],
    representantes: ['Representatives | Lohmann do Brasil', 'Find Lohmann do Brasil representatives by state for technical and commercial service.'],
    radar: ['Market Radar | Lohmann do Brasil', 'Market indicators to support technical and commercial reading in the poultry sector.'],
  };
  const es = {
    home: ['Lohmann do Brasil | Genética avícola y soporte técnico', 'Líneas de postura, soporte técnico e información para productores, granjas y distribuidores en Brasil.'],
    sobre: ['La Lohmann | Lohmann do Brasil', 'Actuación institucional de Lohmann do Brasil en genética de postura, soporte técnico y sector avícola.'],
    linhagens: ['Líneas Lohmann | Lohmann do Brasil', 'Líneas LOHMANN LSL-LITE y LOHMANN BROWN-LITE para diferentes sistemas productivos y mercados.'],
    representantes: ['Representantes | Lohmann do Brasil', 'Encuentre representantes de Lohmann do Brasil por estado para atención técnica y comercial.'],
    radar: ['Radar de Mercado | Lohmann do Brasil', 'Indicadores de mercado para apoyar la lectura técnica del sector avícola.'],
  };
  const item = (selectedLang === 'es' ? es : en)[pageKey];
  return item ? { title: item[0], description: item[1] } : fallback;
}

function emptyCustomCodes() {
  return { head: '', bodyStart: '', bodyEnd: '' };
}

async function customCodes(env) {
  if (!hasDb(env)) return emptyCustomCodes();
  const { results } = await env.DB.prepare(
    `SELECT location, code FROM custom_codes WHERE is_active = 1 ORDER BY sort_order, id`
  ).all();
  const snippets = emptyCustomCodes();
  for (const row of results || []) {
    const code = String(row.code || '').trim();
    if (!code) continue;
    const location = String(row.location || 'head').trim();
    if (location === 'body_start') snippets.bodyStart += `\n${code}`;
    else if (location === 'body_end') snippets.bodyEnd += `\n${code}`;
    else snippets.head += `\n${code}`;
  }
  return snippets;
}

async function renderPage(pageKey, request, env) {
  const url = new URL(request.url);
  const selectedLang = lang(url);
  const meta = await seo(env, pageKey, request, selectedLang);
  const productRows = await products(env, selectedLang).catch(() => []);
  const repRows = pageKey === 'representantes' ? await representatives(env).catch(() => ({})) : {};
  const teamRows = pageKey === 'sobre' ? await team(env).catch(() => []) : [];
  const sections = await pageSections(env, pageKey).catch(() => ({}));
  const custom = await customCodes(env).catch(() => emptyCustomCodes());
  const main = renderMain(pageKey, productRows, repRows, teamRows, sections, selectedLang);

  return `<!doctype html>
<html lang="${h(langAttr(selectedLang))}">
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
  <link rel="stylesheet" href="/assets/site.css?v=${ASSET_VERSION}">
  ${googleAnalyticsTag()}
  ${custom.head}
</head>
<body class="${pageKey === 'home' ? '' : 'internal-page'} ${pageKey}-page">
  ${custom.bodyStart}
  ${localizedTopBar(selectedLang)}
  ${localizedHeader(pageKey, selectedLang)}
  <main>${main}</main>
  ${footerCloud(selectedLang)}
  <script>window.LohmannRepresentatives = ${JSON.stringify(repRows)}; window.LohmannFallbackRepresentatives = ${JSON.stringify(fallbackRepresentatives())};</script>
  <script src="/assets/site.js?v=${ASSET_VERSION}" defer></script>
  ${custom.bodyEnd}
</body>
</html>`;
}

function topBar() {
  return `<div class="top-utility"><div class="top-utility-inner"><strong class="top-brand-name">LOHMANN DO BRASIL</strong><div class="top-tools"><div class="top-language" aria-label="Idiomas"><a class="active" href="?lang=pt">PT</a><a href="?lang=en">EN</a><a href="?lang=es">ES</a></div><div class="top-social" aria-label="Redes sociais"><a href="https://instagram.com/lohmanndobrasil" target="_blank" rel="noopener" aria-label="Instagram">◎</a><a href="https://www.linkedin.com/company/lohmann-do-brasil-avicultura/" target="_blank" rel="noopener" aria-label="LinkedIn">in</a></div></div></div></div>`;
}

function header(active) {
  const nav = [
    ['/', 'Início', 'home'],
    ['/a-lohmann', 'A Lohmann', 'sobre'],
    ['/linhagens', 'Linhagens', 'linhagens'],
    ['/representantes', 'Representantes', 'representantes'],
    ['/suporte-tecnico', 'Suporte técnico', 'suporte'],
    ['/base-de-conhecimento', 'Base de Conhecimento', 'biblioteca'],
    ['/#contato', 'Contato', 'contato'],
    ['/radar-tecnico', '<span></span>Radar de Mercado', 'radar'],
  ].map(([href, label, key]) => `<a class="${key === active ? 'active' : ''} ${key === 'radar' ? 'radar-nav-link' : ''}" href="${href}">${label}</a>`).join('');
  return `<header class="site-header"><a class="brand" href="/" aria-label="Lohmann do Brasil"><img class="logo-top" src="/assets/logo-lohmann-header-white.png" alt="Lohmann do Brasil"><img class="logo-scrolled" src="/assets/logo-lohmann.png" alt="Lohmann do Brasil"></a><button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span></button><nav class="nav" aria-label="Principal">${nav}</nav><div class="header-actions"><a class="portal-link" href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div></header>`;
}

function footer() {
  return `<footer><a class="brand footer-brand" href="/"><img src="/assets/logo-lohmann-header.png" alt="Lohmann do Brasil"></a><p>Genética como engenharia de sistema.</p><div><a href="/admin">Administração</a><a href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div><small>&copy; ${new Date().getFullYear()} Lohmann do Brasil</small></footer>`;
}

function renderMain(pageKey, productRows, repRows, teamRows, sections = {}, selectedLang = 'pt') {
  if (pageKey === 'artigoLohmann142') return articleLohmann142Page();
  if (selectedLang !== 'pt') return translatedPage(pageKey, productRows, repRows, teamRows, selectedLang);
  if (pageKey === 'home') return translateStatic(homeCloud(productRows, sections), selectedLang);
  if (pageKey === 'sobre') return translateStatic(sobre(teamRows, sections), selectedLang);
  if (pageKey === 'linhagens') return translateStatic(linhagens(productRows, sections), selectedLang);
  if (pageKey === 'representantes') return translateStatic(reps(repRows, sections), selectedLang);
  if (pageKey === 'radar') return translateStatic(radar(sections), selectedLang);
  if (pageKey === 'suporte') return simplePage('Suporte técnico', 'Acompanhamento técnico para manejo, leitura de indicadores e organização da rotina produtiva.');
  if (pageKey === 'biblioteca') return simplePage('Base de Conhecimento', 'Planilhas, guias, materiais técnicos e conteúdos de apoio para acompanhamento de sistemas de postura.');
  return translateStatic(home(productRows), selectedLang);
}

function topBarCloud() {
  return `<div class="top-utility"><div class="top-utility-inner"><strong class="top-brand-name">LOHMANN DO BRASIL</strong><div class="top-tools"><div class="top-language" aria-label="Idiomas"><a class="active" href="?lang=pt">PT</a><a href="?lang=en">EN</a><a href="?lang=es">ES</a></div><div class="top-social" aria-label="Redes sociais"><a href="https://instagram.com/lohmanndobrasil" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17" cy="7" r="1"></circle></svg></a><a href="https://www.linkedin.com/company/lohmann-do-brasil-avicultura/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4v11H4z"></path><path d="M6 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"></path><path d="M10 9h4v1.6c.7-1 1.8-1.9 3.6-1.9 2.7 0 4.4 1.8 4.4 5.2V20h-4v-5.5c0-1.5-.6-2.4-1.9-2.4-1.2 0-2.1.8-2.1 2.4V20h-4z"></path></svg></a></div></div></div></div>`;
}

function headerCloud(active) {
  const nav = [
    ['/', 'Início', 'home'],
    ['/a-lohmann', 'A Lohmann', 'sobre'],
    ['/linhagens', 'Linhagens', 'linhagens'],
    ['/representantes', 'Representantes', 'representantes'],
    ['/suporte-tecnico', 'Suporte técnico', 'suporte'],
    ['/base-de-conhecimento', 'Base de Conhecimento', 'biblioteca'],
    ['/#contato', 'Contato', 'contato'],
    ['/radar-tecnico', '<span></span>Radar de Mercado', 'radar'],
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
  ${productGrid(productRows, false)}
  <section class="journey section"><header class="section-heading"><div><p class="eyebrow">Método Lohmann</p><h2>Da decisão de alojamento à performance prevista.</h2></div><p>O trabalho técnico começa antes da ave: leitura do sistema produtivo, definição da linhagem e acompanhamento para manter o potencial genético calibrado em campo.</p></header><div class="journey-grid"><article class="reveal"><span>01</span><div class="journey-icon"><i></i></div><h3>Diagnóstico do sistema</h3><p>Análise de manejo, clima, estrutura, mercado de saída e objetivo produtivo para orientar a escolha genética.</p></article><article class="reveal"><span>02</span><div class="journey-icon"><i></i></div><h3>Linhagem calibrada</h3><p>Portfólio segmentado por variável de manejo, peso de ovo e perfil de operação, sem promessa genérica para todos os sistemas.</p></article><article class="reveal"><span>03</span><div class="journey-icon"><i></i></div><h3>Acompanhamento técnico</h3><p>Suporte regional para interpretar indicadores, ajustar manejo e manter robustez, persistência e viabilidade como métricas de produção.</p></article></div></section>
  <section class="technical" id="tecnico"><div class="technical-copy reveal"><p class="eyebrow light">Suporte técnico</p><h2>Acompanhamento para transformar potencial genético em resultado previsível.</h2><p>Materiais, treinamentos e atendimento regional apoiam a rotina de manejo, a leitura de indicadores e a tomada de decisão ao longo do ciclo produtivo.</p><a class="button light" href="/suporte-tecnico">Saiba mais</a></div><div class="technical-list"><article><span>01</span><h3>Documentos técnicos</h3><p>Guias e materiais para padronizar leitura de manejo, indicadores e rotina produtiva.</p></article><article><span>02</span><h3>Treinamentos</h3><p>Conteúdo técnico organizado por sistema, etapa produtiva e objetivo de performance.</p></article><article><span>03</span><h3>Gestão de manejo</h3><p>Ferramentas para acompanhar lote, interpretar desvios e antecipar ajustes de manejo.</p></article></div></section>
  <section class="representatives-shortcut section"><div class="shortcut-copy reveal"><p class="eyebrow">Representantes</p><h2>${h(sectionValue(sections, 'representantes', 'title_pt', 'Rede técnica regional para calibrar decisão e manejo.'))}</h2><p>${h(sectionValue(sections, 'representantes', 'text_pt', 'Encontre o contato responsável pelo seu estado e direcione dúvidas comerciais, técnicas e de distribuição.'))}</p><a class="button primary" href="${h(sectionValue(sections, 'representantes', 'button_url', '/representantes'))}">${h(sectionValue(sections, 'representantes', 'button_label_pt', 'Ver representantes'))}</a></div><div class="shortcut-image reveal" aria-hidden="true"><img src="${h(sectionValue(sections, 'representantes', 'image_path', '/assets/representantes-atalho.png'))}" alt=""></div></section>
  <section class="innovation"><div class="innovation-visual" aria-hidden="true"><div class="analysis-egg"><span></span><i></i></div><span class="metric metric-one"><b>360°</b> sistema calibrado</span><span class="metric metric-two"><b>24/7</b> dados de produção</span><div class="radar"></div></div><div class="innovation-copy reveal"><p class="eyebrow">Ovoflock</p><h2>Dados de produção e rotina técnica em um só ambiente.</h2><p>Uma plataforma para apoiar o acompanhamento de lotes, indicadores e decisões operacionais com mais organização.</p><ul><li>Indicadores de lote</li><li>Acompanhamento produtivo</li><li>Gestão operacional</li><li>Dados para decisão</li></ul><a class="button primary" href="https://ovoflock.com/login" target="_blank" rel="noopener">Acessar Ovoflock</a></div></section>
  <section class="partners-section section" id="parceiros"><header class="section-heading"><div><p class="eyebrow">Parceiros</p><h2>Relações que fortalecem a presença da Lohmann no campo.</h2></div><p>Empresas parceiras conectam genética, produção, distribuição e mercado com atuação próxima ao setor avícola brasileiro.</p></header><div class="partners-grid"><article class="partner-card reveal"><img src="/assets/logo-parceiro-tangara.png?v=${ASSET_VERSION}" alt="Tangará"></article><article class="partner-card reveal"><img src="/assets/logo-parceiro-ovos-sousa.png?v=${ASSET_VERSION}" alt="Ovos Sousa"></article></div></section>
  <section class="technical-radar radar-shortcut section" id="radar-tecnico"><header class="section-heading"><div><p class="eyebrow"><span class="live-dot"></span>Radar de Mercado</p><h2>Indicadores de mercado em uma página dedicada.</h2></div><p>Acompanhe referências de mercado para ovos em diferentes praças brasileiras e use os dados como apoio para leitura técnica e comercial.</p></header><a class="button primary" href="/radar-tecnico">Abrir Radar de Mercado</a></section>
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
  ${productGrid(productRows, false)}
  <section class="representatives-home"><div><p class="eyebrow">Rede regional</p><h2>${h(sectionValue(sections, 'representantes', 'title_pt', 'Encontre representantes por estado.'))}</h2><p>${h(sectionValue(sections, 'representantes', 'text_pt', 'O mapa interativo direciona o contato técnico e comercial conforme a região de atendimento.'))}</p><a class="button primary" href="${h(sectionValue(sections, 'representantes', 'button_url', '/representantes'))}">${h(sectionValue(sections, 'representantes', 'button_label_pt', 'Ver representantes'))}</a></div><img src="${h(sectionValue(sections, 'representantes', 'image_path', '/assets/representantes-atalho.png'))}" alt=""></section>
  <section class="technical-radar-short"><div><p class="eyebrow">Radar de Mercado</p><h2>${h(sectionValue(sections, 'radar', 'title_pt', 'Leitura de mercado para apoiar decisões.'))}</h2><p>${h(sectionValue(sections, 'radar', 'text_pt', 'Acompanhe indicadores de referência em uma página dedicada.'))}</p><a class="button light" href="${h(sectionValue(sections, 'radar', 'button_url', '/radar-tecnico'))}">${h(sectionValue(sections, 'radar', 'button_label_pt', 'Abrir radar'))}</a></div></section>
  <section class="contact" id="contato"><div class="contact-copy"><p class="eyebrow light">Contato</p><h2>Fale com a equipe Lohmann do Brasil.</h2><p>Envie sua solicitação para direcionarmos o atendimento.</p></div><form action="/api/contact" method="post" class="contact-form"><label>Nome<input name="name" required></label><label>Empresa<input name="company"></label><label>E-mail<input type="email" name="email" required></label><label>Telefone<input name="phone"></label><label class="wide">Assunto<input name="subject"></label><label class="wide">Mensagem<textarea name="message" rows="4" required></textarea></label><button class="button light" type="submit">Enviar</button></form></section>`;
}

function productGrid(productRows, includeGuides = true) {
  const rows = productRows.length ? productRows : fallbackProducts();
  return `<section class="products section" id="linhagens"><header class="section-heading"><div><p class="eyebrow">Portfólio Lohmann</p><h2>Linhagens calibradas por manejo, clima e mercado.</h2></div></header><div class="product-grid">${rows.map((product, index) => `<article class="product-card reveal"><div class="product-art product-art-${index + 1}"><span>0${index + 1}</span><img class="product-hen official-hen" src="/assets/${product.slug.includes('brown') ? 'galinha-marron-oficial-lohmann.png' : 'galinha-branca-oficial-lohmann.png'}" alt="${h(product.name)}"></div><div class="product-copy"><small>${h(product.egg_color)}</small><h3>${h(product.name)}</h3><p>${h(product.summary)}</p><a href="/linhagens/${h(product.slug)}">Ver detalhes <b>+</b></a>${includeGuides ? productGuideLinks(product.slug, 'pt') : ''}</div></article>`).join('')}</div></section>`;
}

function productGuideLinks(slug, selectedLang = 'pt') {
  const labels = {
    pt: { title: 'Guias de manejo', open: 'Baixar' },
    en: { title: 'Management guides', open: 'Download' },
    es: { title: 'Guías de manejo', open: 'Descargar' },
  }[selectedLang] || {};
  return `<div class="product-card-guides"><strong>${h(labels.title)}</strong>${productGuideFiles(slug).map((file) => `<a href="/assets/biblioteca/${h(file.file)}" download>${h(file.shortTitle || file.title)} <span>${h(labels.open)}</span></a>`).join('')}</div>`;
}

function productGuideFiles(slug = '') {
  const isBrown = String(slug).includes('brown');
  const specific = isBrown
    ? { type: 'PDF', title: 'Gestão de Lote BROWN-LITE', shortTitle: 'Gestão BROWN-LITE', file: 'gestao-lote-brown-lite.pdf' }
    : { type: 'PDF', title: 'Gestão de Lote LSL-LITE', shortTitle: 'Gestão LSL-LITE', file: 'gestao-lote-lsl-lite.pdf' };
  const dailySheet = isBrown
    ? { type: 'XLSX', title: 'Gestão de Lote Diário Max e Min - LOHMANN BROWN', shortTitle: 'Planilha diária BROWN', file: 'gestao-diaria-brown-ovos-1-galpao.xlsx' }
    : { type: 'XLSX', title: 'Gestão de Lote Diário Max e Min - LOHMANN LSL', shortTitle: 'Planilha diária LSL', file: 'gestao-diaria-lsl-ovos-1-galpao.xlsx' };
  const maxMinSheet = isBrown
    ? { type: 'XLSX', title: 'Planilha de Gestão Max e Min - LOHMANN BROWN LITE - 2025', shortTitle: 'Max e Min BROWN', file: 'planilha-gestao-max-min-brown-lite-2025.xlsx' }
    : { type: 'XLSX', title: 'Planilha de Gestão Max e Min - LOHMANN LSL LITE - 2025', shortTitle: 'Max e Min LSL', file: 'planilha-gestao-max-min-lsl-lite-2025.xlsx' };
  return [
    specific,
    dailySheet,
    maxMinSheet,
    { type: 'PDF', title: 'Guia de Manejo LSL e BROWN', shortTitle: 'Guia LSL e BROWN', file: 'guia-de-manejo-lsl-brown.pdf' },
    { type: 'PDF', title: 'Manual Sistemas Alternativos', shortTitle: 'Sistemas Alternativos', file: 'manual-sistemas-alternativos-portugues.pdf' },
  ];
}

function fallbackProducts(selectedLang = 'pt') {
  return [
    { slug: 'lohmann-lsl-lite', name: 'LOHMANN LSL-LITE', egg_color: translatedEggColor('Ovos brancos', selectedLang), summary: fallbackProductSummary('lohmann-lsl-lite', selectedLang) },
    { slug: 'lohmann-brown-lite', name: 'LOHMANN BROWN-LITE', egg_color: translatedEggColor('Ovos marrons', selectedLang), summary: fallbackProductSummary('lohmann-brown-lite', selectedLang) },
  ];
}

function translatedEggColor(value, selectedLang = 'pt') {
  const normalized = String(value || '').toLowerCase();
  if (selectedLang === 'en') return normalized.includes('marrom') || normalized.includes('brown') ? 'Brown eggs' : 'White eggs';
  if (selectedLang === 'es') return normalized.includes('marrom') || normalized.includes('brown') || normalized.includes('marr') ? 'Huevos marrones' : 'Huevos blancos';
  return value || 'Ovos';
}

function fallbackProductSummary(slug, selectedLang = 'pt') {
  const brown = String(slug || '').includes('brown');
  if (selectedLang === 'en') return brown
    ? 'A brown egg strain designed for efficiency, persistence and market fit.'
    : 'A white egg strain calibrated for uniformity, feed efficiency and predictable management.';
  if (selectedLang === 'es') return brown
    ? 'Línea para huevos marrones diseñada para eficiencia, persistencia y ajuste al mercado.'
    : 'Línea para huevos blancos calibrada para uniformidad, eficiencia alimentaria y manejo previsible.';
  return brown
    ? 'Linhagem projetada para eficiência, persistência e ajuste ao mercado.'
    : 'Linhagem calibrada para uniformidade, eficiência alimentar e manejo previsível.';
}

function sobre(teamRows) {
  return `<section class="internal-hero"><p class="eyebrow">A Lohmann</p><h1>Genética avícola com presença técnica no campo.</h1><p>A Lohmann do Brasil atua junto a produtores, granjas e distribuidores com linhagens comerciais de postura, materiais técnicos e acompanhamento de campo.</p></section><section class="content-bands content-bands-rich"><div class="content-prose"><p class="eyebrow">Atuação técnica</p><h2>Atuação baseada em genética, manejo e acompanhamento técnico.</h2><p>A presença da Lohmann do Brasil no campo aproxima genética, manejo e informação técnica para apoiar diferentes realidades produtivas e mercados de destino.</p></div><div class="content-grid content-grid-four"><article class="content-card"><span>01</span><h2>Adequação de sistema</h2><p>A escolha da ave considera sistema produtivo, manejo disponível e mercado de cada cliente.</p></article><article class="content-card"><span>02</span><h2>Engenharia de performance</h2><p>Robustez, persistência e longevidade são tratadas como parâmetros de projeto.</p></article><article class="content-card"><span>03</span><h2>Bem-estar como eficiência</h2><p>Estresse, viabilidade, estabilidade de penas e mortalidade entram na leitura técnica do sistema.</p></article><article class="content-card"><span>04</span><h2>Calibragem em campo</h2><p>O suporte técnico mantém o potencial genético ajustado à realidade da operação.</p></article></div><div class="split-panel"><div><p class="eyebrow">Método</p><h2>Como a Lohmann sustenta a decisão</h2></div><ul class="check-list"><li>Diagnóstico do sistema produtivo: manejo, estrutura, clima, objetivo e mercado de saída.</li><li>Seleção da linhagem conforme variável técnica, não por tradição de marca.</li><li>Acompanhamento de indicadores para robustez, persistência, viabilidade e ajuste de manejo.</li><li>Conteúdo técnico organizado para consulta, treinamento e padronização da operação.</li></ul></div><section class="about-institutional"><div><p class="eyebrow">Lohmann Breeders</p><h2>Uma atuação conectada ao desenvolvimento global da genética Lohmann.</h2><p>A Lohmann Breeders reúne décadas de seleção genética, serviço técnico e intercâmbio de conhecimento para atender mercados com diferentes sistemas produtivos. No Brasil, essa base é traduzida para a realidade das granjas, produtores e distribuidores.</p></div><div class="about-institutional-grid"><article><h3>História e seleção</h3><p>A evolução das linhagens Lohmann é baseada em pesquisa, avaliação de desempenho e adaptação a diferentes demandas de mercado.</p></article><article><h3>Serviço técnico</h3><p>O suporte combina orientação de manejo, materiais técnicos e troca de informação para preservar o potencial genético no campo.</p></article><article><h3>Mercado e produto</h3><p>A decisão por linhagem considera a ave certa para cada manejo e o ovo certo para cada mercado.</p></article></div></section>${teamMarkup(teamRows)}<div class="page-cta"><div><p class="eyebrow">Próximo passo</p><h2>Quer decidir alojamento por parâmetro?</h2><p>A equipe Lohmann pode ajudar a diagnosticar o sistema produtivo e direcionar a linhagem com melhor ajuste técnico.</p></div><a class="button primary" href="/#contato">Falar com a equipe</a></div></section>`;
}

function teamMarkup(rows) {
  const members = rows.length ? rows : [
    { name: 'Equipe Lohmann do Brasil', position: 'Atendimento técnico, comercial e institucional', phone: '', initials: 'LB' },
  ];
  return `<section class="team-section"><div class="content-prose"><p class="eyebrow">Equipe Lohmann do Brasil</p><h2>Pessoas de referência para atendimento técnico, comercial e institucional.</h2><p>A equipe segue a estrutura de contatos para manter um formato organizado para publicação e administração em banco de dados.</p></div><div class="team-grid">${members.map((member) => `<article class="team-card"><figure class="team-photo">${member.photo ? `<img src="${h(member.photo)}" alt="${h(member.name)}">` : `<span>${h(member.initials || initials(member.name))}</span>`}</figure><div class="team-info"><h3>${h(member.name)}</h3><p>${h(member.position)}</p>${member.phone ? `<a class="team-whatsapp-link" href="${h(member.whatsapp || whatsapp(member.phone, member.name))}" target="_blank" rel="noopener">${h(member.phone)}</a>` : ''}</div></article>`).join('')}</div></section>`;
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
  return `<section class="internal-hero radar-page-hero"><p class="eyebrow"><span class="live-dot"></span>Radar de Mercado</p><h1>Indicadores de mercado para decisão técnica.</h1><p>Acompanhe referências de preço para ovos em praças brasileiras. Os dados servem como apoio para análise técnica e comercial, sempre combinados com a realidade produtiva de cada operação.</p></section><section class="technical-radar section radar-page"><header class="section-heading"><div><p class="eyebrow">Mercado de ovos</p><h2>Cotações de referência</h2></div><p>Indicadores de mercado ajudam a contextualizar decisões técnicas, comerciais e de alojamento quando analisados junto aos dados de produção.</p></header><div class="radar-dashboard"><aside class="radar-insights"><p class="eyebrow">Leitura técnica</p><h2>Preço é contexto. Decisão depende de sistema.</h2><p>O Radar de Mercado foi pensado como ponto de consulta para produtores, granjas e distribuidores acompanharem referências de mercado sem perder a visão produtiva.</p><div class="radar-insight-grid"><article><span>01</span><strong>Mercado</strong><p>Compare praças, tipo de ovo e variações regionais para entender pressão comercial.</p></article><article><span>02</span><strong>Produção</strong><p>Relacione preço, idade do lote, persistência, consumo e qualidade de ovos.</p></article><article><span>03</span><strong>Manejo</strong><p>Use os indicadores como apoio, não como leitura isolada da eficiência do sistema.</p></article></div></aside><div class="cepea-widget-card"><script type="text/javascript" src="https://cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=10&largura=100%25&corfundo=242424&cortexto=ffffff&corlinha=f78e05&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-branco&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-branco&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-branco&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-branco&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-branco&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-vermelho&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-vermelho&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-vermelho&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-vermelho&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-vermelho&id_indicador%5B%5D=12&id_indicador%5B%5D=92"></script></div></div></section>${marketReportBlock('pt')}`;
}

function marketReportBlock(selectedLang = 'pt') {
  const labels = {
    pt: { eyebrow: 'Relatório mensal', title: 'Plantel brasileiro de poedeiras', text: 'Visualize o material de apoio com dados de alojamento, plantel nacional e evolução dos indicadores. O arquivo completo fica disponível para download logo abaixo.', button: 'Baixar relatório em PDF', share: 'Compartilhar imagem', whatsapp: 'WhatsApp', email: 'E-mail', instagram: 'Instagram' },
    en: { eyebrow: 'Monthly report', title: 'Brazilian laying hen flock', text: 'View the support material with placement, national flock and indicator evolution data. The full file is available for download below.', button: 'Download PDF report', share: 'Share image', whatsapp: 'WhatsApp', email: 'E-mail', instagram: 'Instagram' },
    es: { eyebrow: 'Informe mensual', title: 'Plantel brasileño de ponedoras', text: 'Consulte el material de apoyo con datos de alojamiento, plantel nacional y evolución de indicadores. El archivo completo está disponible para descarga.', button: 'Descargar informe en PDF', share: 'Compartir imagen', whatsapp: 'WhatsApp', email: 'E-mail', instagram: 'Instagram' },
  }[selectedLang] || {};
  const pdf = '/assets/biblioteca/relatorio-mensal-plantel-poedeiras.pdf';
  const image = `/assets/radar-report-mensal.png?v=${ASSET_VERSION}`;
  return `<section class="market-report-section"><div class="market-report-copy"><p class="eyebrow">${h(labels.eyebrow)}</p><h2>${h(labels.title)}</h2><p>${h(labels.text)}</p><div class="market-report-actions"><a class="button primary" href="${pdf}" download>${h(labels.button)}</a><button class="button ghost report-share-native" type="button" data-share-image="${h(image)}">${h(labels.share)}</button></div><div class="report-share-buttons" data-share-image="${h(image)}"><a class="report-share-button report-share-whatsapp" href="#" data-share-channel="whatsapp">${h(labels.whatsapp)}</a><a class="report-share-button report-share-email" href="#" data-share-channel="email">${h(labels.email)}</a><a class="report-share-button report-share-instagram" href="${h(image)}" download="relatorio-mensal-plantel-poedeiras-lohmann.png" data-share-channel="instagram">${h(labels.instagram)}</a></div></div><div class="market-report-viewer market-report-image-only"><img src="${h(image)}" alt="Relatório mensal do plantel brasileiro de poedeiras"></div></section>`;
}
function simplePage(title, description) {
  if (title === 'Suporte técnico') return suportePage();
  if (title === 'Base de Conhecimento') return bibliotecaPage();
  if (title === 'Biblioteca') return bibliotecaPage();
  if (title === 'Artigos') return bibliotecaPage();
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
  return `<section class="internal-hero"><p class="eyebrow">Base de Conhecimento</p><h1>Materiais técnicos, guias e conteúdos para consulta.</h1><p>A Base de Conhecimento organiza arquivos de manejo, planilhas de acompanhamento e conteúdos técnicos em um único ambiente de apoio à rotina produtiva.</p></section><section class="content-bands content-bands-rich library-page">${articlesSection('pt')}${libraryDownloads('pt')}</section>`;
}

function artigosPage() {
  return `<section class="internal-hero"><p class="eyebrow">Artigos</p><h1>Artigos técnicos e institucionais.</h1><p>Esta área exibirá publicações da Lohmann do Brasil. Por enquanto, mantemos apenas um artigo modelo para validar o formato de listagem e a página interna.</p></section><section class="content-bands content-bands-rich article-list-section"><article class="article-card reveal"><span>Artigo modelo</span><h2>Como será exibido um artigo no site</h2><p>Modelo temporário para avaliar título, resumo, data, categoria e chamada para leitura completa.</p><div class="article-meta"><small>Categoria técnica</small><small>5 min de leitura</small></div><a class="button primary" href="/artigos/artigo-exemplo">Ver formato</a></article></section>`;
}

async function renderProductPage(slug, request, env) {
  const selectedLang = lang(new URL(request.url));
  const rows = await products(env, selectedLang).catch(() => []);
  const product = (rows.length ? rows : fallbackProducts(selectedLang)).find((item) => item.slug === slug) || fallbackProducts(selectedLang)[0];
  const custom = await customCodes(env).catch(() => emptyCustomCodes());
  const specs = productSpecs(product.slug);
  const image = product.slug.includes('brown') ? '/assets/galinha-marron-oficial-lohmann.png' : '/assets/galinha-branca-oficial-lohmann.png';
  const metaTitle = `${product.name} | Lohmann do Brasil`;
  const metaDescription = product.summary || (selectedLang === 'es' ? 'Línea Lohmann para sistemas comerciales de postura.' : selectedLang === 'en' ? 'Lohmann strain for commercial layer systems.' : 'Linhagem Lohmann para sistemas de postura comercial.');

  const main = translateStatic(`<section class="product-hero"><div class="product-hero-copy"><a class="back" href="${localizedHref('/linhagens', selectedLang)}">Voltar</a><p class="eyebrow">Linhagem | ${h(product.egg_color)}</p><h1>${h(product.name)}</h1><p>${h(product.summary)}</p><a class="button primary" href="${localizedHref('/#contato', selectedLang)}">Solicitar diagnóstico técnico</a></div><div class="product-hero-art product-hero-hen" aria-hidden="true"><img src="${image}" alt=""><span>${h(product.egg_color)}</span></div></section><article class="product-content product-content-rich"><section class="product-specs"><div class="product-specs-head"><p class="eyebrow">Dados produtivos</p><h2>Indicadores técnicos da ${h(product.name)}.</h2><p>Informações de referência para análise de potencial produtivo, qualidade de ovos, consumo, peso corporal e viabilidade.</p></div><div class="product-specs-intro">${specs.intro.map(([label, value]) => `<article><span>${h(label)}</span><strong>${h(value)}</strong></article>`).join('')}</div><div class="product-specs-grid">${specs.groups.map(([title, items]) => `<article><h3>${h(title)}</h3><ul>${items.map((item) => `<li>${h(item)}</li>`).join('')}</ul></article>`).join('')}</div></section>${productGuideDownloads(product.slug, selectedLang)}<p class="eyebrow">Informações da linhagem</p><h2>Para cada manejo, a ave certa.</h2><p>${product.slug.includes('brown') ? 'A LOHMANN BROWN-LITE atende operações orientadas ao mercado de ovos marrons, com foco em persistência, qualidade de casca e ajuste ao sistema produtivo.' : 'A LOHMANN LSL-LITE atende operações orientadas ao mercado de ovos brancos, com foco em uniformidade, eficiência alimentar e manejo previsível.'}</p><p>Indicadores técnicos devem ser interpretados junto ao manejo, clima, ambiência, mercado de destino e acompanhamento de campo.</p><div class="product-pillars"><section><span>01</span><p>Escolha genética orientada por sistema produtivo.</p></section><section><span>02</span><p>Leitura de consumo, viabilidade, persistência e qualidade de ovos.</p></section><section><span>03</span><p>Suporte técnico para calibragem em campo.</p></section></div></article>`, selectedLang);

  return `<!doctype html><html lang="${h(langAttr(selectedLang))}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${h(metaTitle)}</title><meta name="description" content="${h(metaDescription)}"><link rel="canonical" href="${h(origin(env, request))}${localizedHref(`/linhagens/${h(product.slug)}`, selectedLang)}"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/assets/site.css?v=${ASSET_VERSION}">${googleAnalyticsTag()}${custom.head}</head><body class="internal-page product-page">${custom.bodyStart}${localizedTopBar(selectedLang)}${localizedHeader('linhagens', selectedLang)}<main>${main}</main>${footerCloud(selectedLang)}<script src="/assets/site.js?v=${ASSET_VERSION}" defer></script>${custom.bodyEnd}</body></html>`;
}

function productGuideDownloads(slug = '', selectedLang = 'pt') {
  const labels = {
    pt: { eyebrow: 'Guias de manejo', title: 'Acesso rápido aos materiais técnicos', desc: 'Os arquivos abaixo foram correlacionados com a linhagem selecionada. Materiais gerais aparecem em ambas as linhagens.', button: 'Baixar guia' },
    en: { eyebrow: 'Management guides', title: 'Quick access to technical materials', desc: 'The files below are matched to the selected strain. General materials appear on both strain pages.', button: 'Download guide' },
    es: { eyebrow: 'Guías de manejo', title: 'Acceso rápido a materiales técnicos', desc: 'Los archivos abajo están relacionados con la línea seleccionada. Los materiales generales aparecen en ambas líneas.', button: 'Descargar guía' },
  }[selectedLang] || {};
  const files = productGuideFiles(slug);
  return `<section class="library-downloads product-guides"><div class="product-guides-inner"><header class="section-heading"><div><p class="eyebrow">${h(labels.eyebrow)}</p><h2>${h(labels.title)}</h2></div><p>${h(labels.desc)}</p></header><div class="download-grid">${files.map((file) => `<article class="download-card"><span>${h(file.type || 'PDF')}</span><h3>${h(file.title)}</h3><a class="button primary" href="/assets/biblioteca/${h(file.file)}" download>${h(labels.button)}</a></article>`).join('')}</div></div></section>`;
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
  if (request.method === 'POST') {
    const form = await request.formData();
    const token = String(form.get('token') || '').trim();
    const configuredToken = String(env.ADMIN_TOKEN || '').trim();
    if (configuredToken && token && token === configuredToken) {
      return new Response(null, {
        status: 303,
        headers: {
          location: '/admin',
          'set-cookie': `admin_token=${encodeURIComponent(token)}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Strict`,
          'cache-control': 'no-store',
        },
      });
    }
    return adminLoginPage('Token inválido. Confira o valor salvo em ADMIN_TOKEN.', 401);
  }

  const auth = adminIdentity(request, env);
  if (!auth.ok) {
    return adminLoginPage(env.ADMIN_TOKEN ? '' : 'Antes de entrar, crie a variável secreta ADMIN_TOKEN nas configurações do Worker/Pages.', env.ADMIN_TOKEN ? 200 : 403);
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
      <button data-admin-tab="customCodes">Pixels e scripts</button>
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

function adminLoginPage(message = '', status = 200) {
  const portals = [
    ['Portal LTZ', 'Acesso ao ambiente principal', 'http://app.ltz.com.br/'],
    ['Fluig Lohmann', 'Portal corporativo e processos internos', 'http://fluig.hyline.com.br:8080/portal/p/1/home'],
    ['LTZ Mobile', 'Acesso mobile ao sistema', 'http://m.app.ltz.com.br/'],
  ];
  return html(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Administração | Lohmann do Brasil</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0c0e;color:#fff;font-family:Arial,sans-serif;padding:28px}
    .login-layout{width:min(100%,980px);display:grid;grid-template-columns:minmax(320px,460px) minmax(280px,1fr);gap:22px;align-items:stretch}
    main,.portal-card{background:#151515;border:1px solid rgba(247,168,23,.32);box-shadow:0 30px 90px rgba(0,0,0,.45);border-radius:24px;padding:34px}
    p.kicker{color:#f7a817;font-weight:900;text-transform:uppercase;letter-spacing:.18em;font-size:12px;margin:0 0 18px}
    h1{font-size:36px;line-height:1.05;margin:0 0 14px}
    h2{font-size:28px;line-height:1.1;margin:0 0 14px}
    p{color:#d8d1c4;line-height:1.6}
    label{display:grid;gap:8px;margin:26px 0 16px;font-weight:800}
    input{border:1px solid rgba(255,255,255,.18);background:#08090b;color:#fff;border-radius:14px;padding:14px;font:600 16px Arial}
    button{width:100%;border:0;border-radius:999px;background:#f7a817;color:#111;font-weight:900;padding:14px 18px;cursor:pointer}
    .alert{background:rgba(247,168,23,.12);border-left:4px solid #f7a817;color:#fff;padding:12px 14px;border-radius:12px;margin:18px 0}
    small{display:block;color:#8f887b;margin-top:18px;line-height:1.55}
    .portal-list{display:grid;gap:12px;margin-top:24px}
    .portal-link-card{display:flex;justify-content:space-between;gap:18px;align-items:center;text-decoration:none;color:#fff;border:1px solid rgba(255,255,255,.12);background:#0b0c0e;border-radius:18px;padding:18px;transition:.2s ease}
    .portal-link-card:hover{border-color:#f7a817;transform:translateY(-2px)}
    .portal-link-card strong{display:block;color:#fff;font-size:17px;margin-bottom:5px}
    .portal-link-card span{display:block;color:#aaa;font-size:13px;line-height:1.45}
    .portal-link-card b{color:#f7a817;font-size:20px}
    @media (max-width:820px){.login-layout{grid-template-columns:1fr}main,.portal-card{padding:26px}h1{font-size:32px}}
  </style>
</head>
<body>
  <div class="login-layout">
    <main>
      <p class="kicker">Administração</p>
      <h1>Acesso protegido.</h1>
      <p>Informe o token administrativo configurado no Cloudflare para abrir o painel.</p>
      ${message ? `<div class="alert">${h(message)}</div>` : ''}
      <form method="post" action="/admin">
        <label>Token de acesso
          <input name="token" type="password" autocomplete="current-password" required autofocus>
        </label>
        <button type="submit">Entrar no painel</button>
      </form>
      <small>Recomendado: manter também Cloudflare Access protegendo a rota /admin para uma camada extra de segurança.</small>
    </main>
    <aside class="portal-card" aria-label="Acessos rápidos">
      <p class="kicker">Portais</p>
      <h2>Acessos rápidos</h2>
      <p>Links úteis para operação, sistemas internos e consulta mobile.</p>
      <div class="portal-list">
        ${portals.map(([title, desc, url]) => `<a class="portal-link-card" href="${h(url)}" target="_blank" rel="noopener"><span><strong>${h(title)}</strong>${h(desc)}</span><b>↗</b></a>`).join('')}
      </div>
    </aside>
  </div>
</body>
</html>`, { status, headers: { 'cache-control': 'no-store' } });
}
function adminIdentity(request, env) {
  const accessEmail = request.headers.get('cf-access-authenticated-user-email');
  if (accessEmail) return { ok: true, user: accessEmail };
  const configuredToken = String(env.ADMIN_TOKEN || '').trim();
  const providedToken = request.headers.get('x-admin-token') || new URL(request.url).searchParams.get('token') || cookieValue(request, 'admin_token');
  if (configuredToken && providedToken && configuredToken === providedToken) {
    return { ok: true, user: 'token-admin' };
  }
  return { ok: false, user: '' };
}

function cookieValue(request, name) {
  const cookie = request.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const value = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length) || '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
  if (resource === 'custom-codes') return tableEndpoint(request, env, 'custom_codes', adminTables.customCodes);
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
  customCodes: ['name', 'location', 'code', 'is_active', 'sort_order'],
};

async function adminSummary(env) {
  const tables = ['contacts', 'products', 'representatives', 'team_members', 'documents', 'editable_sections', 'seo_pages', 'custom_codes'];
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
  const allowed = new Set(['contacts', 'products', 'representatives', 'team_members', 'documents', 'editable_sections', 'seo_pages', 'custom_codes']);
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
  labels.customCodes = 'Pixels e scripts';
  const api = async (path, options={}) => {
    const headers = {'content-type':'application/json', ...(options.headers || {})};
    if (token) headers['x-admin-token'] = token;
    const response = await fetch(path, {...options, headers, credentials:'same-origin'});
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : { ok:false, message: await response.text() };
    if (!response.ok || data.ok === false) throw new Error(data.message || 'Falha na operação.');
    return data.data ?? data;
  };  const show = (message) => { alertBox.hidden = false; alertBox.textContent = message; setTimeout(()=>alertBox.hidden=true, 3500); };
  const escapeHtml = (value='') => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const field = (name, value='', type='text', wide=false) => '<label class="'+(wide?'wide':'')+'">'+name.replaceAll('_',' ')+'<'+(type==='textarea'?'textarea':'input')+' name="'+name+'" '+(type==='textarea'?'':'value="'+escapeHtml(value)+'"')+'>'+(type==='textarea'?escapeHtml(value)+'</textarea>':'')+'</label>';
  const form = (fields, row, endpoint, method='PUT') => '<form class="admin-form" data-endpoint="'+endpoint+'" data-method="'+method+'">'+(row.id?'<input type="hidden" name="id" value="'+row.id+'">':'')+fields.map(([name,type='text',wide=false])=>field(name,row[name]||'',type,wide)).join('')+'<div class="admin-actions"><button class="admin-button" type="submit">Salvar</button></div></form>';
  document.addEventListener('submit', async (event) => { const el = event.target.closest('.admin-form'); if (!el) return; event.preventDefault(); const payload = Object.fromEntries(new FormData(el).entries()); await api(el.dataset.endpoint,{method:el.dataset.method,body:JSON.stringify(payload)}); show('Alteração salva com sucesso.'); load(currentTab); });
  let currentTab = 'dashboard';
  tabs.forEach(btn => btn.addEventListener('click', () => { tabs.forEach(b=>b.classList.remove('is-active')); btn.classList.add('is-active'); load(btn.dataset.adminTab); }));
  async function load(tab){ currentTab=tab; title.textContent=labels[tab]; root.innerHTML='<div class="admin-box">Carregando...</div>'; try { if(tab==='dashboard') return await dashboard(); if(tab==='content') return await content(); if(tab==='seo') return await seo(); if(tab==='customCodes') return await customCodes(); if(tab==='products') return await table('products','/api/admin/products',[['slug'],['name'],['category'],['egg_color'],['summary_pt','textarea',true],['summary_en','textarea',true],['summary_es','textarea',true],['content_pt','textarea',true],['image'],['status'],['sort_order']]); if(tab==='representatives') return await table('representatives','/api/admin/representatives',[['name'],['role'],['uf'],['region'],['city'],['phone'],['email'],['photo'],['is_active'],['sort_order']]); if(tab==='team') return await table('team','/api/admin/team',[['name'],['position'],['region'],['phone'],['email'],['photo'],['is_active'],['sort_order']]); if(tab==='contacts') return await contacts(); } catch(error) { root.innerHTML='<section class="admin-box"><h2>Não foi possível carregar esta área.</h2><p class="admin-muted">'+escapeHtml(error.message || 'Erro desconhecido.')+'</p><p class="admin-muted">Confira se o binding D1 está configurado e se as migrations foram executadas no banco de produção.</p></section>'; show(error.message || 'Erro ao carregar dados.'); } }  async function dashboard(){ const data=await api('/api/admin/summary'); const c=data.counts; root.innerHTML='<section class="admin-cards">'+Object.entries(c).map(([k,v])=>'<article class="admin-card"><span>'+escapeHtml(k)+'</span><strong>'+v+'</strong></article>').join('')+'</section><section class="admin-box"><h2>Últimos contatos</h2>'+(data.recentContacts||[]).map(r=>'<p><strong>'+escapeHtml(r.name)+'</strong> '+escapeHtml(r.email)+' — '+escapeHtml(r.subject||'')+'</p>').join('')+'</section>'; }
  async function content(){ const rows=await api('/api/admin/content'); root.innerHTML='<div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.label)+'</h3><p>'+escapeHtml(row.page_key)+' / '+escapeHtml(row.section_key)+'</p></div><button class="admin-button" data-edit-content="'+row.id+'">Editar</button></article>').join('')+'</div>'; root.querySelectorAll('[data-edit-content]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.editContent); root.innerHTML=form([['label'],['title_pt'],['title_en'],['title_es'],['text_pt','textarea',true],['text_en','textarea',true],['text_es','textarea',true],['image_path'],['button_label_pt'],['button_label_en'],['button_label_es'],['button_url'],['sort_order']],row,'/api/admin/content/update'); }); }
  async function seo(){ const rows=await api('/api/admin/seo'); root.innerHTML='<div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.label)+'</h3><p>'+escapeHtml(row.title_pt||'')+'</p></div><button class="admin-button" data-edit-seo="'+row.id+'">Editar</button></article>').join('')+'</div>'; root.querySelectorAll('[data-edit-seo]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.editSeo); root.innerHTML=form([['label'],['title_pt'],['title_en'],['title_es'],['description_pt','textarea',true],['description_en','textarea',true],['description_es','textarea',true],['keywords_pt','textarea',true],['keywords_en','textarea',true],['keywords_es','textarea',true],['canonical_path'],['og_image'],['robots'],['geo_region'],['geo_placename'],['geo_position'],['icbm']],row,'/api/admin/seo/update'); }); }
  async function customCodes(){ const rows=await api('/api/admin/custom-codes'); const help='<section class="admin-box"><h2>Inserção de pixels, analytics e códigos externos</h2><p class="admin-muted">Use <strong>head</strong> para Google Analytics, Meta Pixel e verificação de domínio. Use <strong>body_start</strong> para códigos que pedem instalação logo após abrir o body, como parte do Google Tag Manager. Use <strong>body_end</strong> para scripts que podem carregar no fim da página.</p></section>'; root.innerHTML=help+'<div class="admin-toolbar"><button class="admin-button" id="new-row">Novo código</button><span class="admin-muted">'+rows.length+' códigos cadastrados</span></div><div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.name)+'</h3><p>'+escapeHtml(row.location)+' | '+(Number(row.is_active)?'Ativo':'Inativo')+'</p></div><button class="admin-button" data-edit="'+row.id+'">Editar</button></article>').join('')+'</div>'; const fields=[['name'],['location'],['code','textarea',true],['is_active'],['sort_order']]; document.getElementById('new-row').onclick=()=>{ root.innerHTML=help+form(fields,{location:'head',is_active:1,sort_order:0},'/api/admin/custom-codes','POST'); }; root.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.edit); root.innerHTML=help+form(fields,row,'/api/admin/custom-codes','PUT'); }); }
  async function table(name, endpoint, fields){ const rows=await api(endpoint); root.innerHTML='<div class="admin-toolbar"><button class="admin-button" id="new-row">Novo registro</button><span class="admin-muted">'+rows.length+' registros</span></div><div class="admin-grid">'+rows.map(row=>'<article class="admin-row"><div><h3>'+escapeHtml(row.name||row.title||row.slug)+'</h3><p>'+escapeHtml(row.role||row.position||row.category||row.uf||'')+'</p></div><button class="admin-button" data-edit="'+row.id+'">Editar</button></article>').join('')+'</div>'; document.getElementById('new-row').onclick=()=>{ root.innerHTML=form(fields,{},endpoint,'POST'); }; root.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>{ const row=rows.find(r=>String(r.id)===btn.dataset.edit); root.innerHTML=form(fields,row,endpoint,'PUT'); }); }
  async function contacts(){ const rows=await api('/api/admin/contacts'); root.innerHTML='<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Empresa</th><th>Mensagem</th><th>Status</th></tr></thead><tbody>'+rows.map(row=>'<tr><td>'+escapeHtml(row.name)+'</td><td>'+escapeHtml(row.email)+'</td><td>'+escapeHtml(row.phone)+'</td><td>'+escapeHtml(row.company)+'</td><td>'+escapeHtml(row.message)+'</td><td><select data-contact="'+row.id+'"><option '+(row.status==='new'?'selected':'')+' value="new">Novo</option><option '+(row.status==='in_progress'?'selected':'')+' value="in_progress">Em andamento</option><option '+(row.status==='answered'?'selected':'')+' value="answered">Respondido</option></select></td></tr>').join('')+'</tbody></table></div>'; root.querySelectorAll('[data-contact]').forEach(sel=>sel.onchange=async()=>{ await api('/api/admin/contacts/update',{method:'PUT',body:JSON.stringify({id:sel.dataset.contact,status:sel.value})}); show('Status atualizado.'); }); }
  load('dashboard');`;
}

function langAttr(selectedLang) {
  if (selectedLang === 'en') return 'en';
  if (selectedLang === 'es') return 'es';
  return 'pt-BR';
}

function localizedHref(href, selectedLang) {
  if (selectedLang === 'pt' || href.startsWith('http') || href.startsWith('/admin')) return href;
  const hashIndex = href.indexOf('#');
  const base = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : '';
  const target = base || '/';
  const sep = target.includes('?') ? '&' : '?';
  return `${target}${sep}lang=${selectedLang}${hash}`;
}

function navLabel(key, selectedLang) {
  const labels = {
    pt: { home: 'Início', sobre: 'A Lohmann', linhagens: 'Linhagens', representantes: 'Representantes', suporte: 'Suporte técnico', biblioteca: 'Base de Conhecimento', contato: 'Contato', radar: 'Radar de Mercado' },
    en: { home: 'Home', sobre: 'About Lohmann', linhagens: 'Strains', representantes: 'Representatives', suporte: 'Technical Support', biblioteca: 'Knowledge Base', contato: 'Contact', radar: 'Market Radar' },
    es: { home: 'Inicio', sobre: 'La Lohmann', linhagens: 'Líneas', representantes: 'Representantes', suporte: 'Soporte técnico', biblioteca: 'Base de Conocimiento', contato: 'Contacto', radar: 'Radar de Mercado' },
  };
  return labels[selectedLang]?.[key] || labels.pt[key] || key;
}

function translateStatic(htmlText, selectedLang) {
  if (selectedLang === 'pt') return htmlText;
  let output = htmlText;
  const dictionary = STATIC_TRANSLATIONS[selectedLang] || {};
  for (const [pt, translated] of Object.entries(dictionary)) {
    output = output.split(pt).join(translated);
  }
  return output;
}

const STATIC_TRANSLATIONS = {
  en: {
    'GenÃ©tica como engenharia de sistema.': 'Genetics as system engineering.',
    'AdministraÃ§Ã£o': 'Administration',
    'Administração': 'Administration',
    'Voltar': 'Back',
    'Linhagem |': 'Strain |',
    'Solicitar diagnÃ³stico tÃ©cnico': 'Request a technical diagnosis',
    'Solicitar diagnóstico técnico': 'Request a technical diagnosis',
    'Dados produtivos': 'Production data',
    'InformaÃ§Ãµes da linhagem': 'Strain information',
    'Informações da linhagem': 'Strain information',
    'Para cada manejo, a ave certa.': 'The right bird for every management system.',
    'Linhagem |': 'Strain |',
    'Indicadores técnicos da': 'Technical indicators for',
    'Informações de referência para análise de potencial produtivo, qualidade de ovos, consumo, peso corporal e viabilidade.': 'Reference information for analyzing production potential, egg quality, feed intake, body weight and viability.',
    'A LOHMANN BROWN-LITE atende operações orientadas ao mercado de ovos marrons, com foco em persistência, qualidade de casca e ajuste ao sistema produtivo.': 'LOHMANN BROWN-LITE serves operations focused on the brown egg market, with emphasis on persistence, shell quality and production-system fit.',
    'A LOHMANN LSL-LITE atende operações orientadas ao mercado de ovos brancos, com foco em uniformidade, eficiência alimentar e manejo previsível.': 'LOHMANN LSL-LITE serves operations focused on the white egg market, with emphasis on uniformity, feed efficiency and predictable management.',
    'Indicadores técnicos devem ser interpretados junto ao manejo, clima, ambiência, mercado de destino e acompanhamento de campo.': 'Technical indicators should be interpreted together with management, climate, housing conditions, target market and field support.',
    'Escolha genética orientada por sistema produtivo.': 'Genetic choice guided by production system.',
    'Leitura de consumo, viabilidade, persistência e qualidade de ovos.': 'Reading feed intake, viability, persistence and egg quality.',
    'Suporte técnico para calibragem em campo.': 'Technical support for field calibration.',
    'Suporte tÃ©cnico': 'Technical support',
    'Suporte técnico': 'Technical support',
    'Ovos brancos': 'White eggs',
    'Ovos marrons': 'Brown eggs',
    'Ver detalhes': 'View details',
    'Enviar': 'Send',
    'Nome': 'Name',
    'Empresa': 'Company',
    'Telefone': 'Phone',
    'Assunto': 'Subject',
    'Mensagem': 'Message',
  },
  es: {
    'GenÃ©tica como engenharia de sistema.': 'Genética como ingeniería de sistema.',
    'AdministraÃ§Ã£o': 'Administración',
    'Administração': 'Administración',
    'Voltar': 'Volver',
    'Linhagem |': 'Línea |',
    'Solicitar diagnÃ³stico tÃ©cnico': 'Solicitar diagnóstico técnico',
    'Solicitar diagnóstico técnico': 'Solicitar diagnóstico técnico',
    'Dados produtivos': 'Datos productivos',
    'InformaÃ§Ãµes da linhagem': 'Información de la línea',
    'Informações da linhagem': 'Información de la línea',
    'Para cada manejo, a ave certa.': 'Para cada manejo, el ave adecuada.',
    'Linhagem |': 'Línea |',
    'Indicadores técnicos da': 'Indicadores técnicos de',
    'Informações de referência para análise de potencial produtivo, qualidade de ovos, consumo, peso corporal e viabilidade.': 'Información de referencia para analizar potencial productivo, calidad de huevos, consumo, peso corporal y viabilidad.',
    'A LOHMANN BROWN-LITE atende operações orientadas ao mercado de ovos marrons, com foco em persistência, qualidade de casca e ajuste ao sistema produtivo.': 'LOHMANN BROWN-LITE atiende operaciones orientadas al mercado de huevos marrones, con foco en persistencia, calidad de cáscara y ajuste al sistema productivo.',
    'A LOHMANN LSL-LITE atende operações orientadas ao mercado de ovos brancos, com foco em uniformidade, eficiência alimentar e manejo previsível.': 'LOHMANN LSL-LITE atiende operaciones orientadas al mercado de huevos blancos, con foco en uniformidad, eficiencia alimentaria y manejo previsible.',
    'Indicadores técnicos devem ser interpretados junto ao manejo, clima, ambiência, mercado de destino e acompanhamento de campo.': 'Los indicadores técnicos deben interpretarse junto al manejo, clima, ambiente, mercado de destino y acompañamiento de campo.',
    'Escolha genética orientada por sistema produtivo.': 'Elección genética orientada por sistema productivo.',
    'Leitura de consumo, viabilidade, persistência e qualidade de ovos.': 'Lectura de consumo, viabilidad, persistencia y calidad de huevos.',
    'Suporte técnico para calibragem em campo.': 'Soporte técnico para calibración en campo.',
    'Suporte tÃ©cnico': 'Soporte técnico',
    'Suporte técnico': 'Soporte técnico',
    'Ovos brancos': 'Huevos blancos',
    'Ovos marrons': 'Huevos marrones',
    'Ver detalhes': 'Ver detalles',
    'Enviar': 'Enviar',
    'Nome': 'Nombre',
    'Empresa': 'Empresa',
    'Telefone': 'Teléfono',
    'Assunto': 'Asunto',
    'Mensagem': 'Mensaje',
  },
};

function translatedCopy(selectedLang) {
  const en = {
    heroTitle: 'The right bird for your production system.',
    heroText: 'Lohmann do Brasil combines poultry genetics, technical support and market reading to support production systems with predictability, egg quality and operational efficiency.',
    heroButton: 'View strains',
    talk: 'Talk to the team',
    aboutTitle: 'Poultry genetics guided by performance, management and market needs.',
    aboutText: 'Lohmann do Brasil provides strains for different production realities, with close technical support focused on stability, persistence, egg quality and market fit.',
    aboutMore: 'Learn about Lohmann',
    strainsKicker: 'Lohmann Portfolio',
    strainsTitle: 'Strains calibrated by management, climate and market.',
    repsTitle: 'Regional technical network to calibrate decisions and management.',
    repsText: 'Find the contact responsible for your state and direct commercial, technical and distribution questions.',
    repsButton: 'View representatives',
    supportTitle: 'Technical support to turn genetic potential into predictable results.',
    supportText: 'Materials, training and regional service support management routines, indicator reading and decision-making throughout the production cycle.',
    ovoflockTitle: 'Production data and technical routines in one environment.',
    ovoflockText: 'A platform to support flock monitoring, indicators and operational decisions with better organization.',
    partnersTitle: 'Relationships that strengthen Lohmann presence in the field.',
    radarTitle: 'Market indicators on a dedicated page.',
    contactTitle: 'Talk to Lohmann do Brasil.',
    contactText: 'Send your request so we can direct the service.',
    aboutPageTitle: 'Poultry genetics with technical presence in the field.',
    aboutPageText: 'Lohmann do Brasil works with producers, farms and distributors through commercial layer strains, technical materials and field support.',
    teamTitle: 'Reference people for technical, commercial and institutional service.',
    strainsPageTitle: 'Lohmann strains for different production systems.',
    repsPageTitle: 'Find the Lohmann representative for your region.',
    repsPageText: 'Use the interactive map to locate service by state. Click the desired state abbreviation to keep the representative list visible.',
    supportPageTitle: 'Technical support is calibration of the genetic system in the field.',
    libraryPageTitle: 'Knowledge Base for technical consultation.',
    radarPageTitle: 'Market indicators for technical decisions.',
  };
  const es = {
    heroTitle: 'El ave adecuada para su sistema productivo.',
    heroText: 'Lohmann do Brasil combina genética avícola, soporte técnico y lectura de mercado para apoyar sistemas productivos con previsibilidad, calidad de huevos y eficiencia operativa.',
    heroButton: 'Ver líneas',
    talk: 'Hablar con el equipo',
    aboutTitle: 'Genética avícola orientada por desempeño, manejo y mercado.',
    aboutText: 'Lohmann do Brasil ofrece líneas para diferentes realidades productivas, con soporte técnico cercano enfocado en estabilidad, persistencia, calidad de huevos y adecuación al mercado.',
    aboutMore: 'Conocer Lohmann',
    strainsKicker: 'Portafolio Lohmann',
    strainsTitle: 'Líneas calibradas por manejo, clima y mercado.',
    repsTitle: 'Red técnica regional para calibrar decisiones y manejo.',
    repsText: 'Encuentre el contacto responsable por su estado y dirija dudas comerciales, técnicas y de distribución.',
    repsButton: 'Ver representantes',
    supportTitle: 'Soporte técnico para transformar potencial genético en resultados previsibles.',
    supportText: 'Materiales, entrenamientos y atención regional apoyan la rutina de manejo, la lectura de indicadores y la toma de decisiones durante el ciclo productivo.',
    ovoflockTitle: 'Datos de producción y rutina técnica en un solo ambiente.',
    ovoflockText: 'Una plataforma para apoyar el seguimiento de lotes, indicadores y decisiones operativas con mayor organización.',
    partnersTitle: 'Relaciones que fortalecen la presencia de Lohmann en el campo.',
    radarTitle: 'Indicadores de mercado en una página dedicada.',
    contactTitle: 'Hable con Lohmann do Brasil.',
    contactText: 'Envíe su solicitud para direccionar la atención.',
    aboutPageTitle: 'Genética avícola con presencia técnica en el campo.',
    aboutPageText: 'Lohmann do Brasil actúa junto a productores, granjas y distribuidores con líneas comerciales de postura, materiales técnicos y acompañamiento de campo.',
    teamTitle: 'Personas de referencia para atención técnica, comercial e institucional.',
    strainsPageTitle: 'Líneas Lohmann para diferentes sistemas productivos.',
    repsPageTitle: 'Encuentre el representante Lohmann para su región.',
    repsPageText: 'Use el mapa interactivo para localizar la atención por estado. Haga clic en la sigla del estado para fijar la lista de representantes.',
    supportPageTitle: 'El soporte técnico calibra el sistema genético en el campo.',
    libraryPageTitle: 'Base de Conocimiento para consulta técnica.',
    radarPageTitle: 'Indicadores de mercado para decisiones técnicas.',
  };
  return selectedLang === 'es' ? es : en;
}

function translatedPage(pageKey, productRows, repRows, teamRows, selectedLang) {
  const t = translatedCopy(selectedLang);
  if (pageKey === 'home') return translatedHome(productRows, selectedLang, t);
  if (pageKey === 'sobre') return translatedSobre(teamRows, selectedLang, t);
  if (pageKey === 'linhagens') return translatedLinhagens(productRows, selectedLang, t);
  if (pageKey === 'representantes') return translatedReps(repRows, selectedLang, t);
  if (pageKey === 'suporte') return translatedSupport(selectedLang, t);
  if (pageKey === 'biblioteca') return translatedLibrary(selectedLang, t);
  if (pageKey === 'radar') return translatedRadar(selectedLang, t);
  return translatedHome(productRows, selectedLang, t);
}

function translatedProductGrid(productRows, selectedLang, t, includeGuides = true) {
  const rows = productRows.length ? productRows : fallbackProducts(selectedLang);
  return `<section class="products section" id="linhagens"><header class="section-heading"><div><p class="eyebrow">${h(t.strainsKicker)}</p><h2>${h(t.strainsTitle)}</h2></div></header><div class="product-grid">${rows.map((product, index) => `<article class="product-card reveal"><div class="product-art product-art-${index + 1}"><span>0${index + 1}</span><img class="product-hen official-hen" src="/assets/${product.slug.includes('brown') ? 'galinha-marron-oficial-lohmann.png' : 'galinha-branca-oficial-lohmann.png'}" alt="${h(product.name)}"></div><div class="product-copy"><small>${h(product.egg_color)}</small><h3>${h(product.name)}</h3><p>${h(product.summary)}</p><a href="${localizedHref(`/linhagens/${h(product.slug)}`, selectedLang)}">${selectedLang === 'es' ? 'Ver detalles' : 'View details'} <b>+</b></a>${includeGuides ? productGuideLinks(product.slug, selectedLang) : ''}</div></article>`).join('')}</div></section>`;
}

function translatedHome(productRows, selectedLang, t) {
  const isEs = selectedLang === 'es';
  return `<section class="hero" id="inicio"><div class="hero-copy reveal"><div class="live-label"><i></i>${isEs ? 'Genética como ingeniería de sistema' : 'Genetics as system engineering'}</div><h1>${h(t.heroTitle)}</h1><p>${h(t.heroText)}</p><div class="actions"><a class="button primary" href="${localizedHref('/linhagens', selectedLang)}">${h(t.heroButton)}</a><a class="button ghost" href="#contato">${h(t.talk)}</a></div><div class="signal-row"><span><b>01</b> ${isEs ? 'Sistema' : 'System'}</span><span><b>02</b> ${isEs ? 'Manejo' : 'Management'}</span><span><b>03</b> ${isEs ? 'Calibración' : 'Calibration'}</span></div></div><div class="hero-visual" aria-hidden="true"><div class="egg-photo-layer"></div><div class="tech-grid"></div><div class="scan-line"></div><div class="lohmann-l-motion"><span class="l-mark l-mark-large"></span><span class="l-mark l-mark-medium"></span><span class="l-mark l-mark-small"></span></div></div></section>
  <section class="intro section"><div><p class="eyebrow">Lohmann do Brasil</p><h2>${h(t.aboutTitle)}</h2></div><div><p>${h(t.aboutText)}</p><a class="text-link" href="${localizedHref('/a-lohmann', selectedLang)}">${h(t.aboutMore)} <span>+</span></a></div></section>
  ${translatedProductGrid(productRows, selectedLang, t, false)}
  <section class="technical" id="tecnico"><div class="technical-copy reveal"><p class="eyebrow light">${navLabel('suporte', selectedLang)}</p><h2>${h(t.supportTitle)}</h2><p>${h(t.supportText)}</p><a class="button light" href="${localizedHref('/suporte-tecnico', selectedLang)}">${isEs ? 'Saber más' : 'Learn more'}</a></div><div class="technical-list"><article><span>01</span><h3>${isEs ? 'Documentos técnicos' : 'Technical documents'}</h3><p>${isEs ? 'Guías y materiales para estandarizar la lectura técnica.' : 'Guides and materials to standardize technical reading.'}</p></article><article><span>02</span><h3>${isEs ? 'Entrenamientos' : 'Training'}</h3><p>${isEs ? 'Contenido organizado por sistema, etapa productiva y objetivo.' : 'Content organized by system, production stage and goal.'}</p></article><article><span>03</span><h3>${isEs ? 'Gestión de manejo' : 'Management control'}</h3><p>${isEs ? 'Herramientas para acompañar lotes e interpretar desvíos.' : 'Tools to monitor flocks and interpret deviations.'}</p></article></div></section>
  <section class="representatives-shortcut section"><div class="shortcut-copy reveal"><p class="eyebrow">${navLabel('representantes', selectedLang)}</p><h2>${h(t.repsTitle)}</h2><p>${h(t.repsText)}</p><a class="button primary" href="${localizedHref('/representantes', selectedLang)}">${h(t.repsButton)}</a></div><div class="shortcut-image reveal" aria-hidden="true"><img src="/assets/representantes-atalho.png" alt=""></div></section>
  <section class="innovation"><div class="innovation-visual" aria-hidden="true"><div class="analysis-egg"><span></span><i></i></div><div class="radar"></div></div><div class="innovation-copy reveal"><p class="eyebrow">Ovoflock</p><h2>${h(t.ovoflockTitle)}</h2><p>${h(t.ovoflockText)}</p><a class="button primary" href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div></section>
  <section class="partners-section section"><header class="section-heading"><div><p class="eyebrow">${isEs ? 'Socios' : 'Partners'}</p><h2>${h(t.partnersTitle)}</h2></div></header><div class="partners-grid"><article class="partner-card reveal"><img src="/assets/logo-parceiro-tangara.png?v=${ASSET_VERSION}" alt="Tangará"></article><article class="partner-card reveal"><img src="/assets/logo-parceiro-ovos-sousa.png?v=${ASSET_VERSION}" alt="Ovos Sousa"></article></div></section>
  <section class="technical-radar radar-shortcut section"><header class="section-heading"><div><p class="eyebrow"><span class="live-dot"></span>${navLabel('radar', selectedLang)}</p><h2>${h(t.radarTitle)}</h2></div></header><a class="button primary" href="${localizedHref('/radar-tecnico', selectedLang)}">${isEs ? 'Abrir Radar de Mercado' : 'Open Market Radar'}</a></section>
  ${translatedContact(selectedLang, t)}`;
}

function translatedSobre(teamRows, selectedLang, t) {
  const rows = teamRows.length ? teamRows : fallbackTeamMembers();
  return `<section class="internal-hero"><p class="eyebrow">${navLabel('sobre', selectedLang)}</p><h1>${h(t.aboutPageTitle)}</h1><p>${h(t.aboutPageText)}</p></section><section class="content-bands content-bands-rich"><div class="content-prose"><p class="eyebrow">${selectedLang === 'es' ? 'Actuación técnica' : 'Technical presence'}</p><h2>${h(t.aboutTitle)}</h2><p>${h(t.aboutText)}</p></div><div class="team-section"><header class="section-heading"><div><p class="eyebrow">Equipe</p><h2>${h(t.teamTitle)}</h2></div></header><div class="team-grid">${rows.map((member) => `<article class="team-card"><div class="team-photo">${member.photo ? `<img src="${h(member.photo)}" alt="${h(member.name)}">` : `<span>${h(member.initials || initials(member.name))}</span>`}</div><div><h3>${h(member.name)}</h3><p>${h(member.position)}</p><small>${h(member.region || 'Lohmann do Brasil')}</small>${member.whatsapp ? `<a class="team-whatsapp-link" href="${h(member.whatsapp)}" target="_blank" rel="noopener">${h(member.phone || '')}</a>` : ''}</div></article>`).join('')}</div></div></section>`;
}

function translatedLinhagens(productRows, selectedLang, t) {
  return `<section class="internal-hero"><p class="eyebrow">${navLabel('linhagens', selectedLang)}</p><h1>${h(t.strainsPageTitle)}</h1><p>${selectedLang === 'es' ? 'Cada línea debe ser evaluada según manejo, clima, mercado y objetivo productivo.' : 'Each strain should be evaluated by management, climate, market and production goal.'}</p></section>${translatedProductGrid(productRows, selectedLang, t)}`;
}

function translatedReps(repRows, selectedLang, t) {
  return translateStatic(reps(repRows), selectedLang).replace('Encontre o representante Lohmann para sua regiÃ£o.', h(t.repsPageTitle)).replace('Use o mapa interativo para localizar o atendimento por estado. Clique sobre a sigla do estado desejado para fixar a lista de representantes e consulte telefone, regiÃ£o de atuaÃ§Ã£o e informaÃ§Ãµes de contato. Para escolher outro estado, use o botÃ£o voltar ao mapa.', h(t.repsPageText));
}

function translatedSupport(selectedLang, t) {
  return `<section class="internal-hero"><p class="eyebrow">${navLabel('suporte', selectedLang)}</p><h1>${h(t.supportPageTitle)}</h1><p>${h(t.supportText)}</p></section><section class="content-bands content-bands-rich"><div class="content-grid content-grid-six"><article class="content-card"><span>01</span><h2>${selectedLang === 'es' ? 'Documentos técnicos' : 'Technical documents'}</h2><p>${selectedLang === 'es' ? 'Guides y materiales para manejo, indicadores, ambiente, recría, postura y calidad de huevos.' : 'Guides and materials for management, indicators, environment, rearing, laying and egg quality.'}</p></article><article class="content-card"><span>02</span><h2>${selectedLang === 'es' ? 'Entrenamientos' : 'Training'}</h2><p>${selectedLang === 'es' ? 'Contenido para estandarizar decisiones por parámetros.' : 'Content to standardize decisions by parameters.'}</p></article><article class="content-card"><span>03</span><h2>${selectedLang === 'es' ? 'Gestión de lote' : 'Flock management'}</h2><p>${selectedLang === 'es' ? 'Tools para seguir desempeño e identificar desvíos.' : 'Tools to monitor performance and identify deviations.'}</p></article></div></section>`;
}

function translatedLibrary(selectedLang, t) {
  return `<section class="internal-hero"><p class="eyebrow">${navLabel('biblioteca', selectedLang)}</p><h1>${h(t.libraryPageTitle)}</h1><p>${selectedLang === 'es' ? 'La biblioteca organiza archivos de consulta para seguimiento de lotes, indicadores y rutina de manejo.' : 'The library organizes reference files for flock monitoring, indicator reading and management routines.'}</p></section><section class="content-bands content-bands-rich library-page">${articlesSection(selectedLang)}${libraryDownloads(selectedLang)}</section>`;
}

function articlesSection(selectedLang = 'pt') {
  const labels = {
    pt: { eyebrow: 'Artigos', title: 'Artigos', intro: 'Conteúdos técnicos e institucionais publicados para apoiar a leitura de mercado, genética e desempenho em campo.', button: 'Ler artigo' },
    en: { eyebrow: 'Articles', title: 'Articles', intro: 'Technical and institutional content to support market, genetics and field performance reading.', button: 'Read article' },
    es: { eyebrow: 'Artículos', title: 'Artículos', intro: 'Contenidos técnicos e institucionales para apoyar la lectura de mercado, genética y desempeño en campo.', button: 'Leer artículo' },
  }[selectedLang] || {};
  const href = localizedHref('/base-de-conhecimento/genetica-que-se-confirma-no-campo', selectedLang);
  return `<section class="articles-section"><header class="section-heading"><div><p class="eyebrow">${h(labels.eyebrow)}</p><h2>${h(labels.title)}</h2></div><p>${h(labels.intro)}</p></header><div class="article-card-grid"><article class="article-preview-card"><a class="article-preview-image" href="${h(href)}"><img src="/assets/artigo-lohmann-a-hora-do-ovo-edicao-142.png?v=${ASSET_VERSION}" alt="Artigo Lohmann do Brasil na edição 142 da revista A Hora do Ovo"></a><div class="article-preview-copy"><span>Publicação especial</span><h3>Genética que se confirma no campo: Lohmann do Brasil é destaque na edição 142 da revista A Hora do Ovo</h3><p>A publicação apresenta resultados históricos alcançados por clientes no Brasil e na Bolívia e evidencia como pesquisa, seleção genética, manejo e acompanhamento técnico se conectam à realidade das granjas.</p><a class="button primary" href="${h(href)}">${h(labels.button)}</a></div></article></div></section>`;
}

function articleLohmann142Page() {
  const pdf = '/download/a-hora-do-ovo-142-lohmann.pdf';
  return `<article class="article-detail"><header class="article-detail-hero"><a class="back" href="/base-de-conhecimento">Voltar para Base de Conhecimento</a><p class="eyebrow">Publicação especial | A Hora do Ovo - Edição 142</p><h1>Genética que se confirma no campo: Lohmann do Brasil é destaque na edição 142 da revista A Hora do Ovo</h1><p>A publicação apresenta resultados históricos alcançados por clientes no Brasil e na Bolívia e evidencia como pesquisa, seleção genética, manejo e acompanhamento técnico se conectam à realidade das granjas.</p><blockquote>O melhoramento genético é contínuo, e seus resultados se tornam visíveis geração após geração, lote após lote.</blockquote></header><figure class="article-feature-image"><img src="/assets/artigo-lohmann-a-hora-do-ovo-edicao-142.png?v=${ASSET_VERSION}" alt="Clientes da Lohmann do Brasil conquistam resultados históricos em nível mundial"></figure><div class="article-detail-body"><p>A evolução genética ganha significado quando se transforma em resultado dentro da granja. E é justamente essa conexão entre pesquisa, seleção, manejo e desempenho comercial que ganha destaque na edição 142 da revista A Hora do Ovo, em matéria dedicada à Lohmann do Brasil.</p><p>Com o título “Clientes da Lohmann do Brasil conquistam resultados históricos em nível mundial”, a publicação apresenta resultados obtidos por clientes no Brasil e na Bolívia e mostra como o trabalho contínuo de melhoramento genético vem se traduzindo em produtividade, eficiência e maior adaptação das aves às diferentes realidades de produção.</p><p>A relevância da matéria está justamente em ir além dos números. Os resultados apresentados ajudam a demonstrar que o desempenho observado no campo é consequência de um processo construído ao longo do tempo, envolvendo pesquisa genética, avaliação em condições comerciais, acompanhamento técnico, manejo, biossegurança e equipes preparadas.</p><h2>Melhoramento genético conectado às condições reais de produção</h2><p>Um dos principais pontos abordados pela reportagem é o Teste Crossline, ferramenta utilizada pela Lohmann para acelerar o processo de melhoramento genético. O programa avalia cruzamentos de aves pedigree em condições desafiadoras de produção, permitindo identificar famílias que apresentam melhor resposta em ambientes específicos e rastrear características importantes, como persistência de postura, adaptação e eficiência produtiva.</p><p>No Brasil, esse trabalho é realizado há mais de três anos e considera condições típicas da produção nacional, como aviários abertos, alta incidência de luz natural e situações de maior estresse térmico. A proposta é aproximar ainda mais a seleção genética dos desafios encontrados diariamente pelos produtores brasileiros.</p><p>Esse conceito representa um ponto importante para o futuro da postura comercial: não basta buscar elevado potencial genético em condições controladas. É necessário desenvolver aves capazes de expressar esse potencial em diferentes sistemas, regiões, estruturas e níveis de tecnificação.</p><h2>Resultados que ganham dimensão internacional</h2><p>A reportagem apresenta exemplos concretos dessa evolução. Na Bolívia, a Avícola Sofia alcançou, nos três primeiros lotes da linhagem Lohmann Brown Lite, resultados de 500, 503 e 504 ovos por ave alojada até as 100 semanas de idade, desempenho que colocou a empresa entre os cinco melhores produtores do ranking mundial citado pela publicação.</p><p>No Brasil, a Naturovos, de Salvador do Sul (RS), também alcançou um marco relevante ao se tornar, segundo a matéria, a primeira empresa brasileira a superar a marca de 500 ovos vermelhos por ave alojada com a Lohmann Brown Lite, chegando a 503 ovos por ave até as 100 semanas.</p><p>Mais do que registros isolados, esses desempenhos ajudam a evidenciar a interação entre diferentes pilares da produção. A própria matéria reforça que genética, manejo, sanidade e equipe técnica precisam atuar de maneira integrada para que elevados níveis de produtividade sejam alcançados.</p><h2>Evolução que não se limita a uma linhagem</h2><p>Outro aspecto importante destacado pela publicação é que os avanços observados inicialmente na Lohmann Brown Lite também vêm sendo incorporados à Lohmann LSL Lite. Os resultados encontrados em diferentes regiões brasileiras apontam para uma evolução genética consistente também em grandes lotes comerciais e diante das particularidades de cada sistema produtivo.</p><p>Isso amplia a importância do trabalho de pesquisa e seleção: o objetivo não é simplesmente alcançar um determinado recorde, mas construir aves cada vez mais eficientes, resilientes e preparadas para os desafios do campo.</p><h2>Pessoas e continuidade também fazem parte da evolução</h2><p>A edição 142 de A Hora do Ovo também registra um novo momento da área técnica da Lohmann do Brasil. Após 11 anos à frente da Gerência Técnica, Marcos Borges passa a atuar como Consultor Técnico para Contas-Chave, enquanto Matheus Fraga, há oito anos na empresa, assume a Gerência Técnica.</p><p>A transição reforça a continuidade de um trabalho construído com proximidade, conhecimento técnico e acompanhamento dos clientes. Segundo a publicação, a mudança preserva o compromisso da empresa com a excelência técnica e com a entrega de genética de alto desempenho para a avicultura brasileira e latino-americana.</p><h2>Conhecimento que precisa ser compartilhado</h2><p>Ter esse trabalho apresentado em uma publicação especializada como A Hora do Ovo é também uma oportunidade de compartilhar com todo o setor os processos que existem por trás dos resultados alcançados no campo.</p><p>Recordes chamam atenção, mas sua maior importância está no que representam: anos de seleção genética, validação em diferentes ambientes produtivos, trabalho conjunto com os clientes e aprendizado contínuo a partir das condições reais das granjas.</p><p>A matéria da edição 142 mostra exatamente esse caminho. O melhoramento genético é contínuo, e seus resultados se tornam visíveis geração após geração, lote após lote.</p><p>Para a Lohmann do Brasil, seguir evoluindo significa manter genética, pesquisa e assistência técnica cada vez mais próximas da realidade do produtor, transformando conhecimento em aves mais adaptadas e potencial genético em resultados consistentes no campo.</p><div class="article-download-box"><strong>Quer conferir a matéria completa?</strong><p>Faça o download do PDF da publicação e acompanhe todos os detalhes, resultados e depoimentos apresentados na edição 142 da revista A Hora do Ovo.</p><a class="button primary" href="${pdf}" download>Baixar artigo em PDF</a></div></div></article>`;
}
function libraryDownloads(selectedLang = 'pt') {
  const labels = {
    pt: { eyebrow: 'Arquivos disponíveis', title: 'Materiais para download', desc: 'Baixe PDFs e planilhas de gestão de lote para LOHMANN LSL-LITE e LOHMANN BROWN-LITE.', button: 'Baixar arquivo' },
    en: { eyebrow: 'Available files', title: 'Download materials', desc: 'Download PDFs and flock management spreadsheets for LOHMANN LSL-LITE and LOHMANN BROWN-LITE.', button: 'Download file' },
    es: { eyebrow: 'Archivos disponibles', title: 'Materiales para descarga', desc: 'Descargue PDFs y planillas de gestión de lote para LOHMANN LSL-LITE y LOHMANN BROWN-LITE.', button: 'Descargar archivo' },
  }[selectedLang] || {};
  const files = [
    ['PDF', 'Guia de Manejo LSL e BROWN', 'guia-de-manejo-lsl-brown.pdf'],
    ['PDF', 'Manual Sistemas Alternativos', 'manual-sistemas-alternativos-portugues.pdf'],
    ['PDF', 'Gestão de Lote BROWN-LITE', 'gestao-lote-brown-lite.pdf'],
    ['PDF', 'Gestão de Lote LSL-LITE', 'gestao-lote-lsl-lite.pdf'],
    ['PDF', 'A Hora do Ovo 142 - Lohmann do Brasil', 'a-hora-do-ovo-142-lohmann.pdf'],
    ['XLSX', 'Gestão de Lote Diário Max e Min - LOHMANN BROWN', 'gestao-diaria-brown-ovos-1-galpao.xlsx'],
    ['XLSX', 'Gestão de Lote Diário Max e Min - LOHMANN LSL', 'gestao-diaria-lsl-ovos-1-galpao.xlsx'],
    ['XLSX', 'Planilha de Gestão Max e Min - LOHMANN BROWN LITE - 2025', 'planilha-gestao-max-min-brown-lite-2025.xlsx'],
    ['XLSX', 'Planilha de Gestão Max e Min - LOHMANN LSL LITE - 2025', 'planilha-gestao-max-min-lsl-lite-2025.xlsx'],
  ];
  return `<section class="library-downloads"><header class="section-heading"><div><p class="eyebrow">${h(labels.eyebrow)}</p><h2>${h(labels.title)}</h2></div><p>${h(labels.desc)}</p></header><div class="download-grid">${files.map(([type, title, file]) => `<article class="download-card"><span>${h(type)}</span><h3>${h(title)}</h3><a class="button primary" href="/assets/biblioteca/${h(file)}" download>${h(labels.button)}</a></article>`).join('')}</div></section>`;
}

function translatedRadar(selectedLang, t) {
  return `<section class="internal-hero radar-page-hero"><p class="eyebrow"><span class="live-dot"></span>${navLabel('radar', selectedLang)}</p><h1>${h(t.radarPageTitle)}</h1><p>${selectedLang === 'es' ? 'Acompañe referencias de precio para huevos en plazas brasileñas y use los datos como apoyo técnico y comercial.' : 'Follow egg price references in Brazilian markets and use the data as technical and commercial support.'}</p></section><section class="technical-radar section radar-page"><div class="radar-dashboard"><aside class="radar-insights"><p class="eyebrow">${selectedLang === 'es' ? 'Lectura técnica' : 'Technical reading'}</p><h2>${selectedLang === 'es' ? 'El precio es contexto. La decisión depende del sistema.' : 'Price is context. Decision depends on the system.'}</h2><p>${selectedLang === 'es' ? 'El Radar de Mercado fue pensado como punto de consulta para productores, granjas y distribuidores.' : 'Technical Radar was designed as a reference point for producers, farms and distributors.'}</p></aside><div class="cepea-widget-card"><script type="text/javascript" src="https://cepea.org.br/br/widgetproduto.js.php?fonte=arial&tamanho=10&largura=100%25&corfundo=242424&cortexto=ffffff&corlinha=f78e05&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-branco&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-branco&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-branco&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-branco&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-branco&id_indicador%5B%5D=159-Bastos+(SP)+-+FOB-vermelho&id_indicador%5B%5D=159-Grande+BH+-+(MG)+-+CIF-vermelho&id_indicador%5B%5D=159-Grande+SP+(SP)+-+CIF-vermelho&id_indicador%5B%5D=159-Recife+(PE)+-+CIF-vermelho&id_indicador%5B%5D=159-S.+M.+de+Jetib%C3%A1+(ES)+-+FOB-vermelho&id_indicador%5B%5D=12&id_indicador%5B%5D=92"></script></div></div></section>${marketReportBlock(selectedLang)}`;
}

function translatedContact(selectedLang, t) {
  return `<section class="contact" id="contato"><div class="contact-copy"><p class="eyebrow light">${navLabel('contato', selectedLang)}</p><h2>${h(t.contactTitle)}</h2><p>${h(t.contactText)}</p><address>Rua Theofilo Mancor, 670<br>Nova Granada, SP<br>CEP 15440-000</address></div><form action="/api/contact" method="post" class="contact-form"><input type="hidden" name="locale" value="${h(selectedLang)}"><label>${selectedLang === 'es' ? 'Nombre' : 'Name'}<input name="name" required></label><label>${selectedLang === 'es' ? 'Empresa' : 'Company'}<input name="company"></label><label>E-mail<input type="email" name="email" required></label><label>${selectedLang === 'es' ? 'Teléfono' : 'Phone'}<input name="phone"></label><label class="wide">${selectedLang === 'es' ? 'Asunto' : 'Subject'}<input name="subject"></label><label class="wide">${selectedLang === 'es' ? 'Mensaje' : 'Message'}<textarea name="message" rows="4" required></textarea></label><button class="button light" type="submit">${selectedLang === 'es' ? 'Enviar' : 'Send'}</button></form></section>`;
}

function localizedHeader(active, selectedLang = 'pt') {
  if (selectedLang === 'pt') return headerCloud(active);
  const nav = [
    ['/', navLabel('home', selectedLang), 'home'],
    ['/a-lohmann', navLabel('sobre', selectedLang), 'sobre'],
    ['/linhagens', navLabel('linhagens', selectedLang), 'linhagens'],
    ['/representantes', navLabel('representantes', selectedLang), 'representantes'],
    ['/suporte-tecnico', navLabel('suporte', selectedLang), 'suporte'],
    ['/base-de-conhecimento', navLabel('biblioteca', selectedLang), 'biblioteca'],
    ['/#contato', navLabel('contato', selectedLang), 'contato'],
    ['/radar-tecnico', `<span></span>${navLabel('radar', selectedLang)}`, 'radar'],
  ].map(([href, label, key]) => `<a class="${key === active ? 'active' : ''} ${key === 'radar' ? 'radar-nav-link' : ''}" href="${localizedHref(href, selectedLang)}">${label}</a>`).join('');
  return `<header class="site-header"><a class="brand" href="${localizedHref('/', selectedLang)}" aria-label="Lohmann do Brasil"><img class="logo-top" src="/assets/logo-lohmann-header-white.png" alt="Lohmann do Brasil"><img class="logo-scrolled" src="/assets/logo-lohmann.png" alt="Lohmann do Brasil"></a><button class="menu-toggle" type="button" aria-label="Menu" aria-expanded="false"><span></span><span></span></button><nav class="nav" aria-label="Principal">${nav}</nav><div class="header-actions"><a class="portal-link" href="https://ovoflock.com/login" target="_blank" rel="noopener">Ovoflock</a></div></header>`;
}

function localizedTopBar(selectedLang = 'pt') {
  return `<div class="top-utility"><div class="top-utility-inner"><strong class="top-brand-name">LOHMANN DO BRASIL</strong><div class="top-tools"><div class="top-language" aria-label="Idiomas"><a class="${selectedLang === 'pt' ? 'active' : ''}" href="/?lang=pt">PT</a><a class="${selectedLang === 'en' ? 'active' : ''}" href="/?lang=en">EN</a><a class="${selectedLang === 'es' ? 'active' : ''}" href="/?lang=es">ES</a></div><div class="top-social" aria-label="Redes sociais"><a href="https://instagram.com/lohmanndobrasil" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17" cy="7" r="1"></circle></svg></a><a href="https://www.linkedin.com/company/lohmann-do-brasil-avicultura/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4v11H4z"></path><path d="M6 4.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"></path><path d="M10 9h4v1.6c.7-1 1.8-1.9 3.6-1.9 2.7 0 4.4 1.8 4.4 5.2V20h-4v-5.5c0-1.5-.6-2.4-1.9-2.4-1.2 0-2.1.8-2.1 2.4V20h-4z"></path></svg></a></div></div></div></div>`;
}
