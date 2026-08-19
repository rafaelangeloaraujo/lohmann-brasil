UPDATE seo_pages
SET
  label = 'Base de Conhecimento',
  title_pt = 'Base de Conhecimento | Lohmann do Brasil',
  title_en = 'Knowledge Base | Lohmann do Brasil',
  title_es = 'Base de Conocimiento | Lohmann do Brasil',
  description_pt = 'Guias de manejo, planilhas de acompanhamento e materiais técnicos para apoio à rotina produtiva.',
  description_en = 'Management guides, monitoring spreadsheets and technical materials to support production routines.',
  description_es = 'Guías de manejo, planillas de seguimiento y materiales técnicos para apoyar la rutina productiva.',
  keywords_pt = 'base de conhecimento, guias de manejo, planilhas Lohmann, materiais técnicos avicultura',
  keywords_en = 'knowledge base, management guides, Lohmann spreadsheets, poultry technical materials',
  keywords_es = 'base de conocimiento, guías de manejo, planillas Lohmann, materiales técnicos avicultura',
  canonical_path = '/base-de-conhecimento',
  updated_at = CURRENT_TIMESTAMP
WHERE page_key = 'biblioteca';

UPDATE seo_pages
SET
  label = 'Radar de Mercado',
  title_pt = 'Radar de Mercado | Lohmann do Brasil',
  title_en = 'Market Radar | Lohmann do Brasil',
  title_es = 'Radar de Mercado | Lohmann do Brasil',
  description_pt = 'Indicadores de mercado para apoio à leitura técnica e comercial do setor avícola.',
  description_en = 'Market indicators to support technical and commercial reading for the poultry sector.',
  description_es = 'Indicadores de mercado para apoyar la lectura técnica y comercial del sector avícola.',
  keywords_pt = 'mercado de ovos, radar de mercado, avicultura, Lohmann do Brasil',
  keywords_en = 'egg market, market radar, poultry, Lohmann do Brasil',
  keywords_es = 'mercado de huevos, radar de mercado, avicultura, Lohmann do Brasil',
  updated_at = CURRENT_TIMESTAMP
WHERE page_key = 'radar';

UPDATE editable_sections
SET
  label = 'Atalho Radar de Mercado',
  title_pt = 'Leitura de mercado para apoiar decisões.',
  title_en = 'Market reading to support decisions.',
  title_es = 'Lectura de mercado para apoyar decisiones.',
  button_label_pt = 'Abrir radar',
  button_label_en = 'Open market radar',
  button_label_es = 'Abrir radar',
  updated_at = CURRENT_TIMESTAMP
WHERE page_key = 'home' AND section_key = 'radar';
