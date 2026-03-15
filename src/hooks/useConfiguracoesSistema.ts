import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConfiguracoesSistema {
  id?: string;
  user_id?: string;
  nome_plataforma: string;
  logo_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  nome_imobiliaria: string;
  cnpj: string | null;
  telefone_suporte: string | null;
  email_suporte: string | null;
  email_gestor: string | null;
}

const defaults: ConfiguracoesSistema = {
  nome_plataforma: "Vision AI",
  logo_url: null,
  cor_primaria: "#6366f1",
  cor_secundaria: "#8b5cf6",
  nome_imobiliaria: "",
  cnpj: null,
  telefone_suporte: null,
  email_suporte: null,
  email_gestor: null,
};

export function useConfiguracoesSistema() {
  const [config, setConfig] = useState<ConfiguracoesSistema>(defaults);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("configuracoes_sistema")
      .select("*")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (data) {
      setConfig({
        id: data.id,
        user_id: data.user_id,
        nome_plataforma: data.nome_plataforma || defaults.nome_plataforma,
        logo_url: data.logo_url,
        cor_primaria: data.cor_primaria || defaults.cor_primaria,
        cor_secundaria: data.cor_secundaria || defaults.cor_secundaria,
        nome_imobiliaria: data.nome_imobiliaria || "",
        cnpj: data.cnpj,
        telefone_suporte: data.telefone_suporte,
        email_suporte: data.email_suporte,
        email_gestor: data.email_gestor,
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return { config, loading, refetch: fetchConfig };
}
