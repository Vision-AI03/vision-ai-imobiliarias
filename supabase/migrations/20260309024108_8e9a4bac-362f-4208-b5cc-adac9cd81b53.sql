CREATE TABLE IF NOT EXISTS metas_financeiras (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- 'faturamento_mes' | 'mrr'
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tipo)
);

ALTER TABLE metas_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_metas" ON metas_financeiras FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);