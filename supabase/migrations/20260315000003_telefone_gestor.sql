-- Add telefone_gestor to configuracoes_sistema for WhatsApp manager notifications
ALTER TABLE configuracoes_sistema ADD COLUMN IF NOT EXISTS telefone_gestor text;
