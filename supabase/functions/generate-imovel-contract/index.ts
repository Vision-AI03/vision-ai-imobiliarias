import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const {
      tipo_contrato,
      template_id,
      imovel_id,
      lead_id,
      dados_comprador,
      dados_vendedor,
      condicoes_financeiras,
      clausulas_especiais,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Buscar dados do imóvel
    let imovelContext = "";
    if (imovel_id) {
      const { data: imovel } = await supabase
        .from("imoveis")
        .select("*, corretor:corretores(nome, creci)")
        .eq("id", imovel_id)
        .maybeSingle();

      if (imovel) {
        imovelContext = `
DADOS DO IMÓVEL:
- Tipo: ${imovel.tipo}
- Endereço: ${imovel.endereco || "Não informado"}${imovel.bairro ? `, ${imovel.bairro}` : ""}${imovel.cidade ? `, ${imovel.cidade}/${imovel.estado}` : ""}
- Matrícula: ${imovel.matricula || "Não informada"}
- Cartório: ${imovel.cartorio_registro || "Não informado"}
- Valor de venda: ${imovel.valor_venda ? `R$ ${imovel.valor_venda.toLocaleString("pt-BR")}` : "A negociar"}
- Valor de aluguel: ${imovel.valor_aluguel ? `R$ ${imovel.valor_aluguel.toLocaleString("pt-BR")}/mês` : "N/A"}
- Corretor: ${imovel.corretor?.nome || "Não informado"}${imovel.corretor?.creci ? ` (CRECI: ${imovel.corretor.creci})` : ""}`;
      }
    }

    // Buscar template
    let templateContent = "";
    if (template_id) {
      const { data: template } = await supabase
        .from("contrato_templates")
        .select("conteudo_template")
        .eq("id", template_id)
        .maybeSingle();
      if (template) templateContent = template.conteudo_template;
    }

    // Buscar configurações da imobiliária
    const { data: config } = await supabase
      .from("configuracoes_sistema")
      .select("nome_imobiliaria, cnpj")
      .eq("user_id", user.id)
      .maybeSingle();

    const systemPrompt = `Você é um assistente jurídico especializado em contratos imobiliários brasileiros.

IMOBILIÁRIA: ${config?.nome_imobiliaria || "Imobiliária"}
CNPJ: ${config?.cnpj || "Não informado"}

${imovelContext}

Seu papel é preencher o template do contrato abaixo com todos os dados fornecidos.

REGRAS:
1. Substitua TODOS os placeholders ({{nome_vendedor}}, {{endereco_imovel}}, etc.) com os dados fornecidos
2. Formate valores em Real: R$ 1.000,00
3. Formate datas: dd/MM/yyyy
4. Use linguagem jurídica formal
5. Se dados estiverem faltando, informe quais campos ficaram sem preencher
6. Envolva o contrato final em <contrato> e </contrato>

TEMPLATE:
${templateContent}`;

    const userMessage = `
TIPO DE CONTRATO: ${tipo_contrato}

DADOS DO COMPRADOR/LOCATÁRIO:
${dados_comprador}

DADOS DO VENDEDOR/PROPRIETÁRIO:
${dados_vendedor}

CONDIÇÕES FINANCEIRAS:
${condicoes_financeiras}

CLÁUSULAS ESPECIAIS:
${clausulas_especiais || "Nenhuma"}

Por favor, preencha o contrato com esses dados e retorne o documento completo.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI error ${response.status}: ${t}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    const match = content.match(/<contrato>([\s\S]*?)<\/contrato>/);
    const contrato_preenchido = match ? match[1].trim() : content;

    return new Response(
      JSON.stringify({ contrato_preenchido, content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-imovel-contract error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
