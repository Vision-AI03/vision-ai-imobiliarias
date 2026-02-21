
-- Create storage bucket for contract PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('contratos-pdf', 'contratos-pdf', false);

-- Allow authenticated users to upload PDFs
CREATE POLICY "Autenticados podem fazer upload de PDFs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contratos-pdf' AND auth.role() = 'authenticated');

-- Allow authenticated users to read PDFs
CREATE POLICY "Autenticados podem ler PDFs"
ON storage.objects FOR SELECT
USING (bucket_id = 'contratos-pdf' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete PDFs
CREATE POLICY "Autenticados podem deletar PDFs"
ON storage.objects FOR DELETE
USING (bucket_id = 'contratos-pdf' AND auth.role() = 'authenticated');
