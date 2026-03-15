-- Add categoria field to tarefas for post-sale workflow identification
ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'geral';
CREATE INDEX IF NOT EXISTS tarefas_categoria_idx ON tarefas(categoria);
