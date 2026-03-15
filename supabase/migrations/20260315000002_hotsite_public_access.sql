-- Public read access for corretor hotsite pages
-- These policies allow anonymous visitors to view corretor profiles and their available properties

-- Allow public to read active corretores by slug (for hotsite)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'corretores' AND policyname = 'public_read_corretores_by_slug'
  ) THEN
    CREATE POLICY "public_read_corretores_by_slug"
      ON public.corretores FOR SELECT
      TO anon
      USING (ativo = true);
  END IF;
END $$;

-- Allow public to read available imoveis linked to a corretor (for hotsite)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imoveis' AND policyname = 'public_read_imoveis_disponiveis'
  ) THEN
    CREATE POLICY "public_read_imoveis_disponiveis"
      ON public.imoveis FOR SELECT
      TO anon
      USING (status = 'disponivel');
  END IF;
END $$;

-- Allow public to read imobiliária config (for hotsite branding)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'configuracoes_sistema' AND policyname = 'public_read_configuracoes_sistema'
  ) THEN
    CREATE POLICY "public_read_configuracoes_sistema"
      ON public.configuracoes_sistema FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

-- Allow anonymous lead creation (from hotsite contact form)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'leads' AND policyname = 'public_insert_leads_hotsite'
  ) THEN
    CREATE POLICY "public_insert_leads_hotsite"
      ON public.leads FOR INSERT
      TO anon
      WITH CHECK (origem_portal = 'hotsite');
  END IF;
END $$;
