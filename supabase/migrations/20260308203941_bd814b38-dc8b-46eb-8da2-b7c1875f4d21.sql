
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'a_fazer',
  prioridade TEXT NOT NULL DEFAULT 'media',
  data_vencimento DATE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  concluida BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_tarefas" ON public.tarefas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
