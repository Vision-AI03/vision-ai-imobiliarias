
CREATE TABLE public.credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(100) NOT NULL,
  servico VARCHAR(100) NOT NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'api_key',
  valor TEXT NOT NULL,
  url_servico TEXT,
  notas TEXT,
  ultimo_uso TIMESTAMPTZ,
  expira_em TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê apenas suas credenciais"
  ON public.credentials
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
