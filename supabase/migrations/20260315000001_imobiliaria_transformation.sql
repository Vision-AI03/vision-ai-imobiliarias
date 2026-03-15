-- ================================================================
-- TRANSFORMAÇÃO VISION AI → PLATAFORMA IMOBILIÁRIA WHITE-LABEL
-- Migration: 20260315000001
-- ================================================================

-- ----------------------------------------------------------------
-- 1. CONFIGURAÇÕES WHITE-LABEL DO SISTEMA
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracoes_sistema (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  nome_plataforma TEXT NOT NULL DEFAULT 'Vision AI',
  logo_url TEXT,
  cor_primaria TEXT NOT NULL DEFAULT '#6366f1',
  cor_secundaria TEXT NOT NULL DEFAULT '#8b5cf6',
  nome_imobiliaria TEXT NOT NULL DEFAULT '',
  cnpj TEXT,
  telefone_suporte TEXT,
  email_suporte TEXT,
  email_gestor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_configuracoes_sistema" ON public.configuracoes_sistema
  FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 2. CORRETORES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.corretores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),          -- conta Supabase Auth do corretor
  admin_id UUID REFERENCES auth.users(id) NOT NULL, -- dono da imobiliária
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  whatsapp TEXT,
  creci TEXT,
  foto_url TEXT,
  cargo TEXT DEFAULT 'corretor',                    -- corretor | senior | gerente | diretor
  perfil TEXT DEFAULT 'corretor',                   -- corretor | gerente | admin
  ativo BOOLEAN DEFAULT true,
  meta_leads_mes INTEGER,
  meta_vendas_mes NUMERIC(12,2),
  meta_alugueis_mes INTEGER,
  slug TEXT UNIQUE,                                  -- para hotsite do corretor
  texto_apresentacao TEXT,
  especialidade TEXT,                               -- vendas | locacao | ambos
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corretores_admin ON public.corretores(admin_id);
CREATE INDEX IF NOT EXISTS idx_corretores_slug ON public.corretores(slug);

ALTER TABLE public.corretores ENABLE ROW LEVEL SECURITY;

-- Admin vê todos os corretores dele; gerente vê todos; corretor vê apenas a si mesmo
CREATE POLICY "corretores_admin_all" ON public.corretores
  FOR ALL USING (auth.uid() = admin_id);

CREATE POLICY "corretores_self_select" ON public.corretores
  FOR SELECT USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 3. IMÓVEIS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.imoveis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,  -- admin da imobiliária
  codigo TEXT,
  titulo TEXT,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'Apartamento',          -- Apartamento | Casa | Terreno | Sala Comercial | Galpão | Cobertura | Studio
  finalidade TEXT NOT NULL DEFAULT 'Venda',          -- Venda | Aluguel | Venda e Aluguel | Temporada
  status TEXT NOT NULL DEFAULT 'disponivel',         -- disponivel | reservado | vendido | alugado | inativo
  valor_venda NUMERIC(15,2),
  valor_aluguel NUMERIC(12,2),
  valor_condominio NUMERIC(10,2),
  valor_iptu NUMERIC(10,2),
  area_total NUMERIC(10,2),
  area_util NUMERIC(10,2),
  quartos INTEGER DEFAULT 0,
  suites INTEGER DEFAULT 0,
  banheiros INTEGER DEFAULT 0,
  vagas INTEGER DEFAULT 0,
  andar INTEGER,
  total_andares INTEGER,
  aceita_financiamento BOOLEAN DEFAULT true,
  aceita_permuta BOOLEAN DEFAULT false,
  mobiliado TEXT DEFAULT 'nao',                      -- sim | nao | semi
  endereco TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  latitude NUMERIC(10,8),
  longitude NUMERIC(11,8),
  caracteristicas TEXT[] DEFAULT '{}',
  fotos TEXT[] DEFAULT '{}',
  foto_destaque TEXT,
  video_url TEXT,
  tour_virtual_url TEXT,
  matricula TEXT,
  cartorio_registro TEXT,
  corretor_responsavel UUID REFERENCES public.corretores(id),
  captado_em TIMESTAMPTZ,
  publicado_zap BOOLEAN DEFAULT false,
  publicado_vivareal BOOLEAN DEFAULT false,
  publicado_olx BOOLEAN DEFAULT false,
  visitas_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imoveis_user ON public.imoveis(user_id);
CREATE INDEX IF NOT EXISTS idx_imoveis_status ON public.imoveis(status);
CREATE INDEX IF NOT EXISTS idx_imoveis_tipo ON public.imoveis(tipo);
CREATE INDEX IF NOT EXISTS idx_imoveis_bairro ON public.imoveis(bairro);
CREATE INDEX IF NOT EXISTS idx_imoveis_corretor ON public.imoveis(corretor_responsavel);

ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "imoveis_user_all" ON public.imoveis
  FOR ALL USING (auth.uid() = user_id);

-- Corretores vinculados ao admin podem ver todos os imóveis
CREATE POLICY "imoveis_corretor_select" ON public.imoveis
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.corretores
      WHERE corretores.user_id = auth.uid()
        AND corretores.admin_id = imoveis.user_id
        AND corretores.ativo = true
    )
  );

-- ----------------------------------------------------------------
-- 4. AGENDA DE VISITAS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agenda_visitas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  data_visita DATE NOT NULL,
  hora_visita TIME NOT NULL,
  duracao_minutos INTEGER DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'agendada',           -- agendada | confirmada | realizada | cancelada | no-show
  tipo TEXT DEFAULT 'presencial',                    -- presencial | virtual
  observacoes TEXT,
  feedback_pos_visita TEXT,
  interesse_apos_visita TEXT,                        -- muito interessado | interessado | pouco interessado | nao gostou
  lembrete_enviado BOOLEAN DEFAULT false,
  confirmacao_enviada BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_user ON public.agenda_visitas(user_id);
CREATE INDEX IF NOT EXISTS idx_agenda_lead ON public.agenda_visitas(lead_id);
CREATE INDEX IF NOT EXISTS idx_agenda_imovel ON public.agenda_visitas(imovel_id);
CREATE INDEX IF NOT EXISTS idx_agenda_corretor ON public.agenda_visitas(corretor_id);
CREATE INDEX IF NOT EXISTS idx_agenda_data ON public.agenda_visitas(data_visita);

ALTER TABLE public.agenda_visitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agenda_admin_all" ON public.agenda_visitas
  FOR ALL USING (auth.uid() = user_id);

-- Corretores veem apenas suas próprias visitas
CREATE POLICY "agenda_corretor_select" ON public.agenda_visitas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.corretores
      WHERE corretores.user_id = auth.uid()
        AND corretores.id = agenda_visitas.corretor_id
    )
  );

CREATE POLICY "agenda_corretor_update" ON public.agenda_visitas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.corretores
      WHERE corretores.user_id = auth.uid()
        AND corretores.id = agenda_visitas.corretor_id
    )
  );

-- ----------------------------------------------------------------
-- 5. COLUNAS IMOBILIÁRIAS NA TABELA LEADS
-- ----------------------------------------------------------------
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tipo_interesse TEXT;           -- Compra | Aluguel | Investimento | Temporada
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tipo_imovel TEXT;             -- Apartamento | Casa | Terreno | etc.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_min NUMERIC(15,2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_max NUMERIC(15,2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bairros_interesse TEXT[] DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS quartos_desejado INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS vagas_desejado INTEGER;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS aceita_financiamento_lead TEXT DEFAULT 'Em análise'; -- Sim | Não | Em análise
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS possui_fgts BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS prazo_decisao TEXT;           -- Imediato | 1 a 3 meses | etc.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS corretor_responsavel UUID REFERENCES public.corretores(id);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS imoveis_interesse UUID[] DEFAULT '{}';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS origem_portal TEXT;           -- site | whatsapp | zap | vivareal | olx | meta | indicacao | manual
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS motivo_perda TEXT;

-- Atualizar a constraint de status para incluir estágios imobiliários
-- Os estágios imobiliários são: novo_lead | contatado | visita_agendada | visita_realizada | proposta_enviada | negociando | contrato_assinado | perdido
-- Mantemos compatibilidade com os valores existentes

CREATE INDEX IF NOT EXISTS idx_leads_corretor ON public.leads(corretor_responsavel);

-- ----------------------------------------------------------------
-- 6. COMISSÕES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comissoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE SET NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'venda',                -- venda | aluguel
  valor_imovel NUMERIC(15,2),
  percentual_comissao NUMERIC(5,2),
  valor_comissao NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'a_receber',          -- a_receber | recebida | cancelada
  data_prevista DATE,
  data_recebimento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comissoes_user ON public.comissoes(user_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_corretor ON public.comissoes(corretor_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_status ON public.comissoes(status);

ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comissoes_user_all" ON public.comissoes
  FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 7. MOVIMENTAÇÕES DE CHAVES
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chaves_movimentacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  imovel_id UUID REFERENCES public.imoveis(id) ON DELETE CASCADE NOT NULL,
  corretor_id UUID REFERENCES public.corretores(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,                                -- retirada | devolucao
  data_hora TIMESTAMPTZ DEFAULT now(),
  motivo TEXT,
  observacoes TEXT,
  alerta_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chaves_imovel ON public.chaves_movimentacoes(imovel_id);
CREATE INDEX IF NOT EXISTS idx_chaves_user ON public.chaves_movimentacoes(user_id);

ALTER TABLE public.chaves_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chaves_user_all" ON public.chaves_movimentacoes
  FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 8. CONFIGURAÇÕES DE DISTRIBUIÇÃO DE LEADS
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config_distribuicao_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL UNIQUE,
  modo TEXT NOT NULL DEFAULT 'manual',               -- round_robin | especialidade | manual
  round_robin_index INTEGER DEFAULT 0,               -- índice atual do round-robin
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.config_distribuicao_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_distribuicao_user" ON public.config_distribuicao_leads
  FOR ALL USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 9. CONFIGURAÇÃO DOS PORTAIS IMOBILIÁRIOS
-- Schema correto criado em 20260210000000_initial_schema.sql
-- (uma linha por portal por usuário). O bloco abaixo é omitido
-- para evitar sobrescrever o schema correto.
-- ----------------------------------------------------------------
-- (config_portais já existe com schema correto — sem alterações)

-- ----------------------------------------------------------------
-- 10. TRIGGERS DE UPDATED_AT
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_configuracoes_sistema_updated_at
  BEFORE UPDATE ON public.configuracoes_sistema
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

CREATE TRIGGER trg_corretores_updated_at
  BEFORE UPDATE ON public.corretores
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

CREATE TRIGGER trg_imoveis_updated_at
  BEFORE UPDATE ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

CREATE TRIGGER trg_agenda_visitas_updated_at
  BEFORE UPDATE ON public.agenda_visitas
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

CREATE TRIGGER trg_comissoes_updated_at
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_updated_at();

-- ----------------------------------------------------------------
-- 11. STORAGE BUCKET PARA FOTOS DE IMÓVEIS
-- (Executar manualmente no Supabase Dashboard se necessário)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('imoveis-fotos', 'imoveis-fotos', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;
-- ----------------------------------------------------------------

-- Adicionar escopo a custos (já existente, adicionando coluna se não existe)
ALTER TABLE public.custos ADD COLUMN IF NOT EXISTS escopo TEXT DEFAULT 'imobiliaria';
