-- ============================================================
-- MIGRAÇÃO INICIAL — Tabelas base necessárias antes de todas
-- as outras migrações.
-- Deve ser executada PRIMEIRO (timestamp 20260210).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. FUNÇÕES UTILITÁRIAS
-- ──────────────────────────────────────────────────────────────

-- Atualiza o campo atualizado_em automaticamente (usado por triggers)
CREATE OR REPLACE FUNCTION public.fn_update_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias usado por migration 20260315000001
CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ──────────────────────────────────────────────────────────────
-- 2. TABELA LEADS
-- Tabela raiz do sistema — todos os outros módulos dependem dela.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                  UUID        REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Dados básicos
  nome                     TEXT        NOT NULL,
  email                    TEXT,
  telefone                 TEXT,
  empresa                  TEXT,

  -- Enriquecimento via IA / LinkedIn / Site
  linkedin_url             TEXT,
  linkedin_cargo           TEXT,
  site_empresa             TEXT,
  site_titulo              TEXT,
  site_descricao           TEXT,
  resumo_empresa           TEXT,
  dores_identificadas      TEXT,
  oportunidades            TEXT,
  segmento                 TEXT,
  porte_empresa            TEXT,
  nivel_maturidade_digital TEXT,
  prioridade_contato       TEXT,
  score                    INTEGER     DEFAULT 0,
  motivo_score             TEXT,

  -- Pipeline CRM
  status                   TEXT        NOT NULL DEFAULT 'novo_lead',
  origem                   TEXT,
  mensagem_original        TEXT,

  -- Rastreio de interações
  email_enviado            BOOLEAN     NOT NULL DEFAULT false,
  email_respondido         BOOLEAN     NOT NULL DEFAULT false,
  data_email_enviado       TIMESTAMPTZ,
  data_email_respondido    TIMESTAMPTZ,
  whatsapp_enviado         BOOLEAN     NOT NULL DEFAULT false,
  whatsapp_respondido      BOOLEAN     NOT NULL DEFAULT false,
  data_whatsapp_enviado    TIMESTAMPTZ,
  data_whatsapp_respondido TIMESTAMPTZ,
  reuniao_agendada         BOOLEAN     NOT NULL DEFAULT false,
  data_reuniao             TIMESTAMPTZ,

  -- Timestamps
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id  ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_status   ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_criado   ON public.leads(criado_em DESC);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_select_own"
  ON public.leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "leads_insert_own"
  ON public.leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads_update_own"
  ON public.leads FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar atualizado_em
CREATE TRIGGER trg_leads_atualizado_em
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_atualizado_em();

-- ──────────────────────────────────────────────────────────────
-- 3. TABELA CONFIG_PORTAIS
-- Uma linha por portal por usuário (zap, vivareal, olx, etc.)
-- A migration 20260315000001 recria com schema errado (por usuário
-- único), mas como esta migração roda ANTES, o IF NOT EXISTS a
-- ignorará preservando o schema correto.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.config_portais (
  id                    UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portal                TEXT        NOT NULL,   -- 'zap' | 'vivareal' | 'olx' | 'imovelweb' | '123i'
  ativo                 BOOLEAN     NOT NULL DEFAULT false,
  webhook_url           TEXT,
  feed_url              TEXT,
  total_leads_importados INTEGER    NOT NULL DEFAULT 0,
  ultima_sincronizacao  TIMESTAMPTZ,
  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, portal)
);

CREATE INDEX IF NOT EXISTS idx_config_portais_user ON public.config_portais(user_id);

ALTER TABLE public.config_portais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_portais_user"
  ON public.config_portais FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
