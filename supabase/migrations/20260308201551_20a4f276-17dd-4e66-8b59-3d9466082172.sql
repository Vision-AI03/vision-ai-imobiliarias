-- Templates de contrato (modelos base)
CREATE TABLE contrato_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  conteudo_template TEXT NOT NULL,
  placeholders JSONB DEFAULT '[]'::jsonb,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contrato_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_templates" ON contrato_templates FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Contratos gerados a partir de templates
CREATE TABLE contratos_gerados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  template_id UUID REFERENCES contrato_templates(id),
  lead_id UUID REFERENCES leads(id),
  nome_cliente VARCHAR(200) NOT NULL,
  email_cliente VARCHAR(200),
  telefone_cliente VARCHAR(50),
  cnpj_cpf VARCHAR(30),
  endereco TEXT,
  dados_preenchidos JSONB NOT NULL DEFAULT '{}'::jsonb,
  conteudo_final TEXT NOT NULL,
  valor_total DECIMAL(10,2),
  numero_parcelas INTEGER,
  tipo_pagamento VARCHAR(50) DEFAULT 'avista',
  valor_recorrente DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'rascunho',
  chat_historico JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contratos_gerados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_contratos_gerados" ON contratos_gerados FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);