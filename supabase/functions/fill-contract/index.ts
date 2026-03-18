import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract readable text from a standard (digitally-created) PDF binary
function extractTextFromPDF(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder("latin1").decode(bytes);
  const parts: string[] = [];

  const btEtBlocks = text.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btEtBlocks) {
    // (text) Tj
    const tjMatches = block.match(/\(([^)]*)\)\s*Tj/g) || [];
    for (const m of tjMatches) {
      const str = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "").trim();
      if (str && /[a-zA-ZÀ-ú0-9]/.test(str)) parts.push(str);
    }
    // [(text)...] TJ
    const tjArrMatches = block.match(/\[([^\]]*)\]\s*TJ/g) || [];
    for (const m of tjArrMatches) {
      const inner = m.replace(/\[/, "").replace(/\]\s*TJ$/, "");
      const strParts = inner.match(/\(([^)]*)\)/g) || [];
      for (const sp of strParts) {
        const str = sp.replace(/^\(/, "").replace(/\)$/, "").trim();
        if (str && /[a-zA-ZÀ-ú0-9]/.test(str)) parts.push(str);
      }
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, template_content, pdf_url, action } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let resolvedContent = template_content as string;

    // If this is a PDF template and the stored content is just a placeholder,
    // download the file and extract text server-side
    if (
      action === "fill_contract" &&
      pdf_url &&
      (!resolvedContent || resolvedContent.startsWith("["))
    ) {
      try {
        const fileRes = await fetch(pdf_url);
        if (fileRes.ok) {
          const buffer = await fileRes.arrayBuffer();
          const extracted = extractTextFromPDF(buffer);
          if (extracted.length > 50) {
            resolvedContent = extracted;
          }
        }
      } catch (fetchErr) {
        console.warn("Could not fetch PDF for text extraction:", fetchErr);
      }
    }

    let systemPrompt = "";

    if (action === "fill_contract") {
      systemPrompt = `Você é um assistente jurídico especializado em contratos imobiliários brasileiros.

Seu papel: receber o texto de um modelo de contrato (extraído de PDF ou DOCX) junto com dados do imóvel, cliente e imobiliária, e retornar o contrato com todos os campos em branco devidamente preenchidos.

MODELO DO CONTRATO:
${resolvedContent}

REGRAS:
- Preencha TODOS os campos em branco com os dados fornecidos. Campos em branco incluem: {{placeholders}}, espaços ___, [CAMPO], (campo), linhas de assinatura, etc.
- Para campos sem dados disponíveis, mantenha o espaço original (não invente dados)
- Formate valores monetários no padrão brasileiro: R$ 1.000,00
- Formate datas no padrão dd/MM/yyyy
- Responda SEMPRE em português brasileiro
- Retorne SOMENTE o contrato preenchido entre as tags <contrato> e </contrato>
- Não adicione nenhum texto, explicação ou comentário fora das tags <contrato>`;
    } else if (action === "extract_data") {
      systemPrompt = `Você é um assistente que extrai dados estruturados de mensagens sobre contratos. Extraia todos os dados possíveis da mensagem do usuário e retorne usando a função extract_contract_data. Responda em português brasileiro.`;
    }

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    };

    if (action === "extract_data") {
      body.tools = [
        {
          type: "function",
          function: {
            name: "extract_contract_data",
            description: "Extrai dados estruturados de uma mensagem sobre contrato",
            parameters: {
              type: "object",
              properties: {
                nome_cliente: { type: "string", description: "Nome completo do cliente" },
                cnpj_cpf: { type: "string", description: "CNPJ ou CPF do cliente" },
                email_cliente: { type: "string", description: "Email do cliente" },
                telefone_cliente: { type: "string", description: "Telefone do cliente" },
                empresa: { type: "string", description: "Nome da empresa do cliente" },
                endereco: { type: "string", description: "Endereço do cliente" },
                valor_total: { type: "number", description: "Valor total do contrato" },
                numero_parcelas: { type: "integer", description: "Número de parcelas" },
                valor_parcela: { type: "number", description: "Valor de cada parcela" },
                valor_recorrente: { type: "number", description: "Valor da mensalidade recorrente" },
                tipo_pagamento: { type: "string", enum: ["avista", "parcelado", "recorrente"] },
                descricao_servico: { type: "string", description: "Descrição do serviço contratado" },
                data_inicio: { type: "string", description: "Data de início do contrato" },
                prazo_meses: { type: "integer", description: "Prazo do contrato em meses" },
              },
              required: ["nome_cliente"],
              additionalProperties: false,
            },
          },
        },
      ];
      body.tool_choice = { type: "function", function: { name: "extract_contract_data" } };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();

    if (action === "extract_data") {
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall) {
        const extractedData = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify({ data: extractedData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const content = result.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fill-contract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
