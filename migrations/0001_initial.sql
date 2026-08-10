PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('administrator','editor','support')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent_hash TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_attempt_email_time ON admin_login_attempts(email, attempted_at);
CREATE INDEX IF NOT EXISTS idx_admin_attempt_ip_time ON admin_login_attempts(ip_hash, attempted_at);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company TEXT,
  document TEXT,
  phone TEXT,
  profile TEXT NOT NULL DEFAULT 'producer' CHECK (profile IN ('producer','farm','distributor','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  accepted_terms_at TEXT NOT NULL,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  egg_color TEXT,
  summary_pt TEXT NOT NULL,
  summary_en TEXT,
  summary_es TEXT,
  content_pt TEXT,
  content_en TEXT,
  content_es TEXT,
  image TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('page','news','event')),
  slug TEXT NOT NULL,
  title_pt TEXT NOT NULL,
  title_en TEXT,
  title_es TEXT,
  excerpt_pt TEXT,
  excerpt_en TEXT,
  excerpt_es TEXT,
  content_pt TEXT,
  content_en TEXT,
  content_es TEXT,
  cover_image TEXT,
  event_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, slug)
);

CREATE TABLE IF NOT EXISTS editable_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_key TEXT NOT NULL,
  section_key TEXT NOT NULL,
  label TEXT NOT NULL,
  title_pt TEXT,
  title_en TEXT,
  title_es TEXT,
  text_pt TEXT,
  text_en TEXT,
  text_es TEXT,
  image_path TEXT,
  button_label_pt TEXT,
  button_label_en TEXT,
  button_label_es TEXT,
  button_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(page_key, section_key)
);

CREATE TABLE IF NOT EXISTS seo_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  title_pt TEXT,
  title_en TEXT,
  title_es TEXT,
  description_pt TEXT,
  description_en TEXT,
  description_es TEXT,
  keywords_pt TEXT,
  keywords_en TEXT,
  keywords_es TEXT,
  canonical_path TEXT,
  og_image TEXT,
  robots TEXT NOT NULL DEFAULT 'index,follow',
  geo_region TEXT,
  geo_placename TEXT,
  geo_position TEXT,
  icbm TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  product_id INTEGER,
  access_level TEXT NOT NULL DEFAULT 'restricted' CHECK (access_level IN ('public','restricted')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS trainings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  content TEXT,
  duration_minutes INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('all','producers','farms','distributors')),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER,
  quantity INTEGER,
  desired_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_review','answered','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'pt',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','answered')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS representatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  uf TEXT NOT NULL,
  region TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  photo TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(name, uf, phone)
);

CREATE INDEX IF NOT EXISTS idx_representatives_uf_active ON representatives(uf, is_active);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  region TEXT,
  email TEXT,
  phone TEXT,
  photo TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(name, phone)
);

INSERT OR IGNORE INTO products (slug, name, category, egg_color, summary_pt, summary_en, summary_es, content_pt, status, sort_order) VALUES
('lohmann-lsl-lite', 'LOHMANN LSL-LITE', 'Poedeira comercial', 'Ovos brancos', 'Linhagem para ovos brancos calibrada para uniformidade, eficiência alimentar e manejo previsível.', 'A white egg strain calibrated for uniformity, feed efficiency and predictable flock management.', 'Línea para huevos blancos calibrada para uniformidad, eficiencia alimentaria y manejo previsible.', 'Indicadores técnicos da LOHMANN LSL-LITE: 50% de produção entre 140 e 145 dias, pico de produção de 95% a 97%, ovos por ave alojada de 332 às 72 semanas, 378 às 80 semanas e 477 às 100 semanas.', 'published', 1),
('lohmann-brown-lite', 'LOHMANN BROWN-LITE', 'Poedeira comercial', 'Ovos marrons', 'Linhagem para ovos marrons projetada para eficiência, persistência e ajuste ao mercado.', 'A brown egg strain designed for efficiency, persistence and market fit.', 'Línea para huevos marrones diseñada para eficiencia, persistencia y ajuste al mercado.', 'Indicadores técnicos da LOHMANN BROWN-LITE: 50% de produção entre 140 e 145 dias, pico de produção de 95% a 97%, ovos por ave alojada de 327 às 72 semanas, 370 às 80 semanas e 466 às 100 semanas.', 'published', 2);

INSERT OR IGNORE INTO representatives(name, role, uf, region, city, phone, sort_order) VALUES
('Jalmir', 'Representante comercial', 'RS', 'Rio Grande do Sul', 'RS', '54 99974-8703', 10),
('Silvio', 'Representante comercial', 'SC', 'Santa Catarina', 'SC', '48 99947-1314', 20),
('Alessandro', 'Representante comercial', 'PR', 'Paraná, São Paulo e Goiás', 'PR / SP / GO', '43 99122-3263', 30),
('Alessandro', 'Representante comercial', 'SP', 'Paraná, São Paulo e Goiás', 'PR / SP / GO', '43 99122-3263', 31),
('Alessandro', 'Representante comercial', 'GO', 'Paraná, São Paulo e Goiás', 'PR / SP / GO', '43 99122-3263', 32),
('Carlinhos', 'Representante comercial', 'MS', 'Mato Grosso do Sul e São Paulo (Bastos)', 'MS / Bastos, SP', '14 99857-6450', 40),
('Carlinhos', 'Representante comercial', 'SP', 'Mato Grosso do Sul e São Paulo (Bastos)', 'MS / Bastos, SP', '14 99857-6450', 41),
('Jair', 'Representante comercial', 'SP', 'Atendimento comercial regional', 'SP', '14 99786-7924', 50),
('Matheus Fraga', 'Representante comercial', 'MG', 'Minas Gerais', 'MG', '17 99772-0946', 60),
('Roberson', 'Representante comercial', 'MT', 'Mato Grosso, Rondônia e Acre', 'MT / RO / AC', '66 99995-9998', 70),
('Roberson', 'Representante comercial', 'RO', 'Mato Grosso, Rondônia e Acre', 'MT / RO / AC', '66 99995-9998', 71),
('Roberson', 'Representante comercial', 'AC', 'Mato Grosso, Rondônia e Acre', 'MT / RO / AC', '66 99995-9998', 72),
('Sergio', 'Representante comercial', 'RJ', 'Rio de Janeiro', 'RJ', '24 99264-2238', 80),
('Gilberto', 'Representante comercial', 'ES', 'Espírito Santo', 'ES', '27 99983-7167', 90),
('Cintia', 'Representante comercial', 'TO', 'Tocantins', 'TO', '62 98133-6390', 100),
('Thiago Dias', 'Representante comercial', 'BA', 'Bahia e Sergipe', 'BA / SE', '79 99987-8819', 110),
('Thiago Dias', 'Representante comercial', 'SE', 'Bahia e Sergipe', 'BA / SE', '79 99987-8819', 111),
('Eduardo Galvão', 'Representante comercial', 'AL', 'Alagoas e Pernambuco (São Bento do Una)', 'AL / PE', '82 9 9641-4435', 120),
('Eduardo Galvão', 'Representante comercial', 'PE', 'Alagoas e Pernambuco (São Bento do Una)', 'AL / PE', '82 9 9641-4435', 121),
('Charles Lima', 'Gerente Comercial Norte e Nordeste', 'PE', 'Pernambuco, Paraíba e Rio Grande do Norte', 'PE / PB / RN', '17 99757-0688', 130),
('Charles Lima', 'Gerente Comercial Norte e Nordeste', 'PB', 'Pernambuco, Paraíba e Rio Grande do Norte', 'PE / PB / RN', '17 99757-0688', 131),
('Charles Lima', 'Gerente Comercial Norte e Nordeste', 'RN', 'Pernambuco, Paraíba e Rio Grande do Norte', 'PE / PB / RN', '17 99757-0688', 132),
('Valdir Castiglione', 'Representante comercial', 'CE', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', 140),
('Valdir Castiglione', 'Representante comercial', 'PI', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', 141),
('Valdir Castiglione', 'Representante comercial', 'MA', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', 142),
('Valdir Castiglione', 'Representante comercial', 'PA', 'Ceará, Piauí, Maranhão e Pará', 'CE / PI / MA / PA', '85 98115-9972', 143);

INSERT OR IGNORE INTO team_members (name, position, region, phone, sort_order) VALUES
('Leomar Klassmann', 'Diretor Geral', 'Lohmann do Brasil', '17 99645-3745', 10),
('Marcos Borges', 'Consultor de contas chaves', 'Lohmann do Brasil', '17 99714-7837', 20),
('Charles Lima', 'Gerente Comercial Norte e Nordeste', 'Lohmann do Brasil', '17 99757-0688', 30),
('Matheus Fraga', 'Diretor Técnico', 'Lohmann do Brasil', '17 99772-0946', 40),
('Guilherme Ferreira', 'Analista de programação', 'Lohmann do Brasil', '17 99757-2703', 50),
('Judson Soares', 'Assistente Técnico', 'Lohmann do Brasil', '17 99641-3574', 60),
('Felipe Kawamura', 'Assistente Técnico', 'Lohmann do Brasil', '17 99739-3152', 70);

INSERT OR IGNORE INTO seo_pages(page_key, label, title_pt, description_pt, keywords_pt, canonical_path, og_image, geo_region, geo_placename) VALUES
('home', 'Home', 'Lohmann do Brasil | Genética avícola e suporte técnico', 'Linhagens de postura, suporte técnico e informações para produtores, granjas e distribuidores no Brasil.', 'Lohmann do Brasil, genética avícola, poedeiras comerciais, linhagens de postura', '/', '/assets/logo-lohmann.png', 'BR-SP', 'Nova Granada, São Paulo, Brasil'),
('sobre', 'A Lohmann', 'A Lohmann | Lohmann do Brasil', 'Atuação institucional da Lohmann do Brasil em genética de postura, suporte técnico e presença no setor avícola.', 'Lohmann, Lohmann do Brasil, genética de postura', '/a-lohmann', '/assets/logo-lohmann.png', 'BR-SP', 'Nova Granada, São Paulo, Brasil'),
('linhagens', 'Linhagens', 'Linhagens Lohmann | Lohmann do Brasil', 'Linhagens LOHMANN LSL-LITE e LOHMANN BROWN-LITE para diferentes sistemas produtivos e mercados.', 'Lohmann Brown-Lite, Lohmann LSL-Lite, linhagens de postura', '/linhagens', '/assets/logo-lohmann.png', 'BR-SP', 'Nova Granada, São Paulo, Brasil'),
('representantes', 'Representantes', 'Representantes | Lohmann do Brasil', 'Encontre representantes da Lohmann do Brasil por estado para atendimento técnico e comercial.', 'representantes Lohmann, atendimento avícola, suporte regional', '/representantes', '/assets/logo-lohmann.png', 'BR-SP', 'Nova Granada, São Paulo, Brasil'),
('radar', 'Radar Técnico', 'Radar Técnico | Lohmann do Brasil', 'Indicadores de mercado para apoio à leitura técnica do setor avícola.', 'mercado de ovos, radar técnico, avicultura', '/radar-tecnico', '/assets/logo-lohmann.png', 'BR-SP', 'Nova Granada, São Paulo, Brasil');

INSERT OR IGNORE INTO editable_sections
(page_key, section_key, label, title_pt, text_pt, image_path, button_label_pt, button_url, sort_order) VALUES
('home', 'hero', 'Hero principal', 'A ave certa para o seu sistema produtivo.', 'A Lohmann do Brasil combina genética avícola, acompanhamento técnico e leitura de mercado para apoiar sistemas produtivos com previsibilidade, qualidade de ovos e eficiência operacional.', '/assets/hero-galinhas-linhagens-cliente.png', 'Conhecer linhagens', '/linhagens', 10),
('home', 'about', 'Chamada A Lohmann', 'Atuação baseada em genética, manejo e acompanhamento técnico.', 'Um trabalho construído para reduzir incertezas no campo e apoiar decisões por sistema produtivo.', '', 'Conhecer a Lohmann', '/a-lohmann', 20),
('home', 'representantes', 'Atalho Representantes', 'Encontre representantes por estado.', 'O mapa interativo direciona o contato técnico e comercial conforme a região de atendimento.', '/assets/representantes-atalho.png', 'Ver representantes', '/representantes', 30),
('home', 'radar', 'Atalho Radar Técnico', 'Leitura de mercado para apoiar decisões.', 'Acompanhe indicadores de referência em uma página dedicada.', '', 'Abrir radar', '/radar-tecnico', 40),
('sobre', 'hero', 'Hero A Lohmann', 'Genética avícola com presença técnica no campo.', 'A Lohmann do Brasil atua junto a produtores, granjas e distribuidores com linhagens comerciais de postura, materiais técnicos e acompanhamento de campo.', '', '', '', 10),
('linhagens', 'hero', 'Hero Linhagens', 'Linhagens calibradas para cada sistema produtivo.', 'A linha Lohmann reúne aves para mercados de ovos brancos e marrons, com seleção orientada por manejo, clima, peso de ovo, persistência, viabilidade e objetivo comercial.', '', '', '', 10),
('representantes', 'hero', 'Hero Representantes', 'Encontre sua rede técnica regional.', 'Clique em um estado no mapa para fixar a lista de representantes ao lado. Para voltar ao mapa completo, use o botão de retorno.', '', '', '', 10),
('radar', 'hero', 'Hero Radar Técnico', 'Indicadores de mercado para apoio à leitura técnica.', 'A página centraliza dados de referência para acompanhar movimentos do setor e apoiar a rotina comercial e produtiva.', '', '', '', 10);
