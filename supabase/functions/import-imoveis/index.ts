import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
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
    const { content_text, pdf_base64, file_name } = await req.json();

    if (!content_text && !pdf_base64) {
      return new Response(JSON.stringify({ error: "content_text ou pdf_base64 é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em dados imobiliários.
Analise o documento e extraia todos os imóveis encontrados.

Para cada imóvel, retorne um JSON array com os campos:
- titulo (string) — nome ou descrição do imóvel
- tipo (string) — um de: Apartamento, Casa, Terreno, Sala Comercial, Galpão, Cobertura, Studio
- finalidade (string) — um de: Venda, Aluguel, Venda e Aluguel
- status (string) — sempre "disponivel"
- valor_venda (number ou null) — em reais, sem formatação
- valor_aluguel (number ou null) — em reais, sem formatação
- area_total (number ou null) — em m²
- quartos (number ou null)
- banheiros (number ou null)
- vagas (number ou null)
- endereco (string ou null)
- bairro (string ou null)
- cidade (string ou null)
- estado (string ou null)
- cep (string ou null)
- descricao (string ou null)
- caracteristicas (array de strings ou [])

Retorne APENAS o JSON array, sem texto adicional, sem markdown, sem explicações.
Se não encontrar imóveis, retorne [].`;

    let messages: object[];

    if (pdf_base64) {
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extraia todos os imóveis deste documento (arquivo: ${file_name || "documento.pdf"}):`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdf_base64}`,
              },
            },
          ],
        },
      ];
    } else {
      const truncated = (content_text as string).substring(0, 20000);
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Extraia todos os imóveis do seguinte conteúdo:\n\n${truncated}`,
        },
      ];
    }

    const aiRes = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        temperature: 0.1,
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit — tente novamente em alguns segundos" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA insuficientes" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ success: true, imoveis: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imoveis = JSON.parse(jsonMatch[0]);
    return new Response(JSON.stringify({ success: true, imoveis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("import-imoveis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
