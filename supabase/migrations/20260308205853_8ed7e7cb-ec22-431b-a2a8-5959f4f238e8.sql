
-- Listas de emails importadas
CREATE TABLE public.email_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome VARCHAR(200) NOT NULL,
  nicho VARCHAR(100) NOT NULL,
  descricao TEXT,
  total_emails INTEGER DEFAULT 0,
  emails_enviados INTEGER DEFAULT 0,
  emails_abertos INTEGER DEFAULT 0,
  emails_respondidos INTEGER DEFAULT 0,
  arquivo_origem TEXT,
  status VARCHAR(50) DEFAULT 'importada',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contatos individuais de cada lista
CREATE TABLE public.email_contatos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lista_id UUID REFERENCES public.email_lists(id) ON DELETE CASCADE,
  nome VARCHAR(200),
  email VARCHAR(200) NOT NULL,
  empresa VARCHAR(200),
  cargo VARCHAR(200),
  telefone VARCHAR(50),
  dados_extras JSONB,
  email_gerado TEXT,
  email_assunto VARCHAR(300),
  status_envio VARCHAR(50) DEFAULT 'pendente',
  enviado_em TIMESTAMPTZ,
  aberto_em TIMESTAMPTZ,
  respondido_em TIMESTAMPTZ,
  resend_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Templates de abordagem por nicho
CREATE TABLE public.email_templates_nicho (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nicho VARCHAR(100) NOT NULL,
  nome VARCHAR(200) NOT NULL,
  prompt_ia TEXT NOT NULL,
  assunto_base VARCHAR(300),
  exemplo_email TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates_nicho ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_email_lists" ON public.email_lists FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_email_contatos" ON public.email_contatos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_email_templates_nicho" ON public.email_templates_nicho FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
