
ALTER TABLE custos ADD COLUMN IF NOT EXISTS escopo VARCHAR(20) DEFAULT 'empresa';

CREATE TABLE IF NOT EXISTS transacoes_pessoais (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  tipo VARCHAR(20) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  descricao VARCHAR(300) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  recorrente BOOLEAN DEFAULT false,
  dia_recorrencia INTEGER,
  metodo_pagamento VARCHAR(50),
  comprovante_url TEXT,
  tags JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transacoes_pessoais ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transacoes_pessoais' AND policyname = 'user_transacoes') THEN
    CREATE POLICY "user_transacoes" ON transacoes_pessoais FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
