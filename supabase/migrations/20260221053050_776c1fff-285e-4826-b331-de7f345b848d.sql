
-- Tabela comunicacoes
CREATE TABLE public.comunicacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('email', 'whatsapp')),
  direcao TEXT NOT NULL CHECK (direcao IN ('enviado', 'recebido')),
  assunto TEXT,
  conteudo TEXT,
  status TEXT NOT NULL DEFAULT 'enviado',
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comunicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler comunicacoes" ON public.comunicacoes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem inserir comunicacoes" ON public.comunicacoes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem atualizar comunicacoes" ON public.comunicacoes
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabela contratos
CREATE TABLE public.contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefone TEXT,
  tipo_servico TEXT NOT NULL DEFAULT 'agente_ia',
  status TEXT NOT NULL DEFAULT 'pendente_assinatura',
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler contratos" ON public.contratos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem inserir contratos" ON public.contratos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem atualizar contratos" ON public.contratos
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabela parcelas
CREATE TABLE public.parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  descricao TEXT,
  valor NUMERIC(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  notificacao_enviada BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler parcelas" ON public.parcelas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem inserir parcelas" ON public.parcelas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem atualizar parcelas" ON public.parcelas
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabela recorrencias
CREATE TABLE public.recorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  valor_mensal NUMERIC(12,2) NOT NULL,
  dia_vencimento INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler recorrencias" ON public.recorrencias
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem inserir recorrencias" ON public.recorrencias
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem atualizar recorrencias" ON public.recorrencias
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Tabela custos
CREATE TABLE public.custos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'outro',
  valor_mensal NUMERIC(12,2) NOT NULL,
  data_renovacao DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.custos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ler custos" ON public.custos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem inserir custos" ON public.custos
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Autenticados podem atualizar custos" ON public.custos
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Trigger para atualizar atualizado_em em contratos
CREATE TRIGGER update_contratos_atualizado_em
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_atualizado_em();
