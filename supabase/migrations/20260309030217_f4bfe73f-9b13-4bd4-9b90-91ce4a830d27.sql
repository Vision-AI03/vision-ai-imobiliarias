
CREATE TABLE notificacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  titulo VARCHAR(300) NOT NULL,
  descricao TEXT,
  link VARCHAR(300),
  lida BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notificacoes_user ON notificacoes(user_id, lida, created_at DESC);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_notificacoes" ON notificacoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
