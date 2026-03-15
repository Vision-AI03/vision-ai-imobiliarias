import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Corretor {
  id: string;
  user_id: string | null;
  admin_id: string;
  nome: string;
  email: string;
  telefone: string | null;
  whatsapp: string | null;
  creci: string | null;
  foto_url: string | null;
  cargo: string;
  perfil: string;
  ativo: boolean;
  meta_leads_mes: number | null;
  meta_vendas_mes: number | null;
  meta_alugueis_mes: number | null;
  slug: string | null;
  texto_apresentacao: string | null;
  especialidade: string | null;
  created_at: string;
}

async function fetchCorretores(): Promise<Corretor[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data } = await supabase
    .from("corretores")
    .select("*")
    .eq("admin_id", userData.user.id)
    .order("nome");
  return (data as Corretor[]) || [];
}

export function useCorretores() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["corretores"],
    queryFn: fetchCorretores,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    corretores: data || [],
    loading: isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["corretores"] }),
  };
}
