-- WhatsApp config per user
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  phone_number_id VARCHAR(50),
  waba_id VARCHAR(50),
  verify_token VARCHAR(200),
  webhook_url TEXT,
  status VARCHAR(20) DEFAULT 'desconectado',
  ultimo_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_whatsapp_config" ON whatsapp_config FOR ALL USING (auth.uid() = user_id);

-- WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lead_id UUID REFERENCES leads(id),
  wamid VARCHAR(200),
  direcao VARCHAR(10) NOT NULL,
  tipo_mensagem VARCHAR(30) DEFAULT 'text',
  conteudo TEXT,
  media_url TEXT,
  telefone_remetente VARCHAR(30) NOT NULL,
  telefone_destinatario VARCHAR(30) NOT NULL,
  timestamp_whatsapp TIMESTAMPTZ NOT NULL,
  status_entrega VARCHAR(20),
  metadata JSONB,
  analisado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wpp_msg_lead ON whatsapp_mensagens(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_msg_telefone ON whatsapp_mensagens(telefone_remetente, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wpp_msg_wamid ON whatsapp_mensagens(wamid);
ALTER TABLE whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_whatsapp_mensagens" ON whatsapp_mensagens FOR ALL USING (auth.uid() = user_id);

-- AI lead stage analysis log
CREATE TABLE IF NOT EXISTS analise_lead_ia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lead_id UUID REFERENCES leads(id) NOT NULL,
  estagio_anterior VARCHAR(50),
  estagio_sugerido VARCHAR(50) NOT NULL,
  confianca INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  acoes_sugeridas TEXT,
  aplicado BOOLEAN DEFAULT false,
  mensagens_analisadas INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE analise_lead_ia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_analise" ON analise_lead_ia FOR ALL USING (auth.uid() = user_id);

-- Weekly reports
CREATE TABLE IF NOT EXISTS relatorios_semanais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  resumo_executivo TEXT NOT NULL,
  total_leads_abordados INTEGER DEFAULT 0,
  total_avancaram INTEGER DEFAULT 0,
  total_perdidos INTEGER DEFAULT 0,
  taxa_conversao DECIMAL(5,2) DEFAULT 0,
  analise_funcionou TEXT NOT NULL DEFAULT '',
  analise_nao_funcionou TEXT NOT NULL DEFAULT '',
  sugestoes_melhoria TEXT NOT NULL DEFAULT '',
  previsao_proxima_semana TEXT NOT NULL DEFAULT '',
  leads_destaque JSONB,
  relatorio_completo TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE relatorios_semanais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_relatorios" ON relatorios_semanais FOR ALL USING (auth.uid() = user_id);

-- Extend leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estagio_fonte VARCHAR(20) DEFAULT 'manual';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_mensagem_whatsapp TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_mensagens_whatsapp INTEGER DEFAULT 0;
