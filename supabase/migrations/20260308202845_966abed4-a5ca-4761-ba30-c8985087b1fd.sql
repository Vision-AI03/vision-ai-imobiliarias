
-- Allow authenticated users to delete contratos
CREATE POLICY "Autenticados podem excluir contratos"
ON contratos FOR DELETE
USING (auth.role() = 'authenticated'::text);

-- Allow authenticated users to delete parcelas
CREATE POLICY "Autenticados podem excluir parcelas"
ON parcelas FOR DELETE
USING (auth.role() = 'authenticated'::text);

-- Allow authenticated users to delete recorrencias
CREATE POLICY "Autenticados podem excluir recorrencias"
ON recorrencias FOR DELETE
USING (auth.role() = 'authenticated'::text);
