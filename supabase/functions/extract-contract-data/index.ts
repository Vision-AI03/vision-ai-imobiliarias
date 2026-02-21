import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { pdf_base64, file_name } = await req.json();
    if (!pdf_base64) {
      return new Response(JSON.stringify({ error: "Missing pdf_base64" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Gemini with tool calling to extract structured data
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente especializado em extrair dados de contratos de prestação de serviços de tecnologia, automação e IA. 
Analise o PDF do contrato e extraia as informações relevantes. 
Se algum campo não estiver presente no documento, retorne null para ele.
Valores monetários devem ser números (sem formatação).
O tipo_servico deve ser um de: agente_ia, automacao, sistema, manutencao.
Para num_parcelas, conte quantas parcelas de pagamento existem (excluindo entrada/sinal).
O valor_entrada é um pagamento inicial/sinal, se houver.
O valor_recorrencia é um valor mensal recorrente (mensalidade), se houver.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extraia os dados deste contrato (arquivo: ${file_name || "contrato.pdf"}):`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdf_base64}`,
                },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_contract_data",
              description: "Extrair dados estruturados de um contrato",
              parameters: {
                type: "object",
                properties: {
                  cliente_nome: { type: "string", description: "Nome completo do cliente/contratante" },
                  cliente_email: { type: ["string", "null"], description: "Email do cliente" },
                  cliente_telefone: { type: ["string", "null"], description: "Telefone do cliente" },
                  tipo_servico: {
                    type: "string",
                    enum: ["agente_ia", "automacao", "sistema", "manutencao"],
                    description: "Tipo de serviço contratado",
                  },
                  valor_total: { type: ["number", "null"], description: "Valor total do contrato em reais" },
                  num_parcelas: { type: ["number", "null"], description: "Número de parcelas do pagamento" },
                  valor_entrada: { type: ["number", "null"], description: "Valor da entrada/sinal" },
                  valor_recorrencia: { type: ["number", "null"], description: "Valor da recorrência mensal" },
                  dia_vencimento: { type: ["number", "null"], description: "Dia do mês para vencimento" },
                },
                required: ["cliente_nome", "tipo_servico"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_contract_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao processar PDF com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "IA não conseguiu extrair dados do PDF" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ success: true, data: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-contract-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
