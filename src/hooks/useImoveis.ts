import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Imovel {
  id: string;
  user_id: string;
  codigo: string | null;
  titulo: string | null;
  descricao: string | null;
  tipo: string;
  finalidade: string;
  status: string;
  valor_venda: number | null;
  valor_aluguel: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  area_total: number | null;
  area_util: number | null;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  andar: number | null;
  total_andares: number | null;
  aceita_financiamento: boolean;
  aceita_permuta: boolean;
  mobiliado: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  caracteristicas: string[];
  fotos: string[];
  foto_destaque: string | null;
  video_url: string | null;
  tour_virtual_url: string | null;
  matricula: string | null;
  cartorio_registro: string | null;
  corretor_responsavel: string | null;
  captado_em: string | null;
  publicado_zap: boolean;
  publicado_vivareal: boolean;
  publicado_olx: boolean;
  visitas_count: number;
  created_at: string;
  updated_at: string;
  // join
  corretor?: { nome: string; telefone: string | null } | null;
}

export interface ImovelFilters {
  tipo?: string;
  finalidade?: string;
  status?: string;
  bairro?: string;
  quartos?: number;
  valor_min?: number;
  valor_max?: number;
  busca?: string;
}

async function fetchImoveis(filters?: ImovelFilters): Promise<Imovel[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  let query = supabase
    .from("imoveis")
    .select("*, corretor:corretores(nome, telefone)")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false });

  if (filters?.tipo) query = query.eq("tipo", filters.tipo);
  if (filters?.finalidade) query = query.eq("finalidade", filters.finalidade);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.bairro) query = query.ilike("bairro", `%${filters.bairro}%`);
  if (filters?.quartos) query = query.gte("quartos", filters.quartos);
  if (filters?.valor_min) query = query.gte("valor_venda", filters.valor_min);
  if (filters?.valor_max) query = query.lte("valor_venda", filters.valor_max);
  if (filters?.busca) {
    query = query.or(
      `titulo.ilike.%${filters.busca}%,endereco.ilike.%${filters.busca}%,bairro.ilike.%${filters.busca}%,codigo.ilike.%${filters.busca}%`
    );
  }

  const { data } = await query;
  return (data as unknown as Imovel[]) || [];
}

export function useImoveis(filters?: ImovelFilters) {
  const queryClient = useQueryClient();
  const filterKey = JSON.stringify(filters || {});

  const { data, isLoading } = useQuery({
    queryKey: ["imoveis", filterKey],
    queryFn: () => fetchImoveis(filters),
    staleTime: 3 * 60 * 1000, // 3 minutes
  });

  return {
    imoveis: data || [],
    loading: isLoading,
    refetch: () => queryClient.invalidateQueries({ queryKey: ["imoveis"] }),
  };
}
