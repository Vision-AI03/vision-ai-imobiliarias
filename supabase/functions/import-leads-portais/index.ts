import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadData {
  nome: string;
  telefone?: string;
  email?: string;
  mensagem?: string;
  tipo_imovel?: string;
  bairro?: string;
  cidade?: string;
  valor_min?: number;
  valor_max?: number;
  quartos?: number;
  referencia_imovel?: string; // código do imóvel no portal
}

// ─── XML helpers ────────────────────────────────────────────────────────────

function xmlText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
}

function splitBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
  let m;
  while ((m = re.exec(xml)) !== null) blocks.push(m[0]);
  return blocks;
}

// ─── Portal parsers ──────────────────────────────────────────────────────────

/**
 * ZAP Imóveis / Viva Real use a very similar XML lead format.
 * Sample:
 * <lead>
 *   <cliente><nome>João Silva</nome><email>j@ex.com</email><telefone>11999990000</telefone></cliente>
 *   <imovel><codigo>AP-123</codigo><tipo>Apartamento</tipo></imovel>
 *   <mensagem>Tenho interesse...</mensagem>
 * </lead>
 */
function parseZapVivareal(xml: string): LeadData[] {
  const blocks = splitBlocks(xml, "lead");
  return blocks.map(block => ({
    nome: xmlText(block, "nome") || "Lead sem nome",
    email: xmlText(block, "email") || undefined,
    telefone: xmlText(block, "telefone") || xmlText(block, "celular") || undefined,
    mensagem: xmlText(block, "mensagem") || xmlText(block, "observacao") || undefined,
    tipo_imovel: xmlText(block, "tipo") || undefined,
    bairro: xmlText(block, "bairro") || undefined,
    cidade: xmlText(block, "cidade") || undefined,
    referencia_imovel: xmlText(block, "codigo") || xmlText(block, "referencia") || undefined,
  }));
}

/**
 * OLX Pro uses a contact/inquiry format.
 * <contato>
 *   <anunciante>...</anunciante>
 *   <comprador><nome>Ana</nome><email>a@ex.com</email><telefone>...</telefone></comprador>
 *   <anuncio><id>123</id><titulo>Apto 2 quartos Moema</titulo></anuncio>
 *   <mensagem>Quero mais info</mensagem>
 * </contato>
 */
function parseOlx(xml: string): LeadData[] {
  const blocks = splitBlocks(xml, "contato");
  if (blocks.length > 0) {
    return blocks.map(block => ({
      nome: xmlText(block, "nome") || "Lead OLX",
      email: xmlText(block, "email") || undefined,
      telefone: xmlText(block, "telefone") || undefined,
      mensagem: xmlText(block, "mensagem") || xmlText(block, "titulo") || undefined,
      referencia_imovel: xmlText(block, "id") || undefined,
    }));
  }
  // Fallback: try generic <lead> blocks
  return parseZapVivareal(xml);
}

/**
 * ImovelWeb / 123I / Generic — tries common field names.
 */
function parseGeneric(xml: string): LeadData[] {
  // Try <lead>, <leads>, <contato>, <contatos>, <interesse>
  for (const tag of ["lead", "contato", "interesse", "item"]) {
    const blocks = splitBlocks(xml, tag);
    if (blocks.length > 0) {
      return blocks.map(block => ({
        nome: xmlText(block, "nome") || xmlText(block, "name") || xmlText(block, "cliente") || "Lead",
        email: xmlText(block, "email") || undefined,
        telefone:
          xmlText(block, "telefone") ||
          xmlText(block, "celular") ||
          xmlText(block, "phone") ||
          xmlText(block, "fone") ||
          undefined,
        mensagem:
          xmlText(block, "mensagem") ||
          xmlText(block, "message") ||
          xmlText(block, "observacao") ||
          xmlText(block, "descricao") ||
          undefined,
        tipo_imovel: xmlText(block, "tipo") || xmlText(block, "type") || undefined,
        bairro: xmlText(block, "bairro") || xmlText(block, "neighborhood") || undefined,
        cidade: xmlText(block, "cidade") || xmlText(block, "city") || undefined,
        referencia_imovel:
          xmlText(block, "codigo") ||
          xmlText(block, "referencia") ||
          xmlText(block, "id_imovel") ||
          xmlText(block, "ref") ||
          undefined,
      }));
    }
  }
  return [];
}

/**
 * Webhook JSON lead (portals posting JSON directly).
 */
function parseJson(body: Record<string, any>, portal: string): LeadData[] {
  // ZAP/Viva Real JSON webhook format
  if (body.name || body.nome || body.client_name) {
    return [{
      nome: body.name || body.nome || body.client_name || "Lead",
      email: body.email || body.client_email || undefined,
      telefone: body.phone || body.telefone || body.client_phone || undefined,
      mensagem: body.message || body.mensagem || body.description || undefined,
      tipo_imovel: body.property_type || body.tipo_imovel || body.tipo || undefined,
      bairro: body.neighborhood || body.bairro || undefined,
      cidade: body.city || body.cidade || undefined,
      referencia_imovel: body.reference || body.codigo || body.property_id || undefined,
    }];
  }

  // Wrapped in leads/data array
  const arr: any[] = body.leads || body.data || body.contacts || body.items || [];
  if (Array.isArray(arr) && arr.length > 0) {
    return arr.map(item => ({
      nome: item.name || item.nome || item.client_name || "Lead",
      email: item.email || item.client_email || undefined,
      telefone: item.phone || item.telefone || item.client_phone || undefined,
      mensagem: item.message || item.mensagem || undefined,
      tipo_imovel: item.property_type || item.tipo || undefined,
      bairro: item.neighborhood || item.bairro || undefined,
      cidade: item.city || item.cidade || undefined,
      referencia_imovel: item.reference || item.property_id || item.codigo || undefined,
    }));
  }

  return [];
}

// ─── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const portalParam = url.searchParams.get("portal") || "";
  const userParam = url.searchParams.get("user") || "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    let portal = portalParam;
    let userId = userParam;
    let leadsData: LeadData[] = [];

    const contentType = req.headers.get("content-type") || "";
    const isWebhook = req.method === "POST" && !contentType.includes("application/json") || false;

    if (contentType.includes("application/json")) {
      // Called from frontend OR JSON webhook from portal
      const body = await req.json();
      portal = body.portal || portal;
      userId = body.user_id || userId;

      if (body.xml) {
        // Manual XML import pasted by user
        leadsData = parseXml(body.xml, portal);
      } else if (body.feed_url) {
        // Fetch XML feed from URL
        const feedRes = await fetch(body.feed_url);
        if (!feedRes.ok) throw new Error(`Erro ao buscar feed: ${feedRes.status}`);
        const xmlText2 = await feedRes.text();
        leadsData = parseXml(xmlText2, portal);
      } else {
        // JSON payload (from frontend passing a JSON lead, or portal webhook JSON body)
        leadsData = parseJson(body, portal);
      }
    } else if (contentType.includes("xml") || contentType.includes("text/plain")) {
      // Portal posting raw XML webhook
      const raw = await req.text();
      leadsData = parseXml(raw, portal);
    } else if (req.method === "POST") {
      // Try to read as text and parse
      const raw = await req.text();
      if (raw.trim().startsWith("<")) {
        leadsData = parseXml(raw, portal);
      } else {
        try {
          const jsonBody = JSON.parse(raw);
          portal = jsonBody.portal || portal;
          userId = jsonBody.user_id || userId;
          leadsData = parseJson(jsonBody, portal);
        } catch {
          leadsData = [];
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id não informado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (leadsData.length === 0) {
      return new Response(
        JSON.stringify({ leads_importados: 0, message: "Nenhum lead encontrado no payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert leads (skip duplicates by telefone+user_id)
    let importados = 0;
    for (const lead of leadsData) {
      if (!lead.nome && !lead.telefone && !lead.email) continue;

      // Check duplicate by telefone
      if (lead.telefone) {
        const { data: existing } = await supabase
          .from("leads")
          .select("id")
          .eq("user_id", userId)
          .eq("telefone", lead.telefone)
          .maybeSingle();
        if (existing) continue; // skip duplicate
      }

      const insertPayload: Record<string, any> = {
        user_id: userId,
        nome: lead.nome || "Lead sem nome",
        telefone: lead.telefone || null,
        email: lead.email || null,
        status: "novo_lead",
        origem_portal: portal,
        mensagem_original: lead.mensagem || null,
        tipo_imovel: lead.tipo_imovel || null,
        bairros_interesse: lead.bairro ? [lead.bairro] : null,
      };

      if (lead.referencia_imovel) {
        // Try to find imovel by codigo
        const { data: imovel } = await supabase
          .from("imoveis")
          .select("id")
          .eq("user_id", userId)
          .eq("codigo", lead.referencia_imovel)
          .maybeSingle();
        if (imovel) {
          insertPayload.imoveis_interesse = [imovel.id];
        }
      }

      const { error } = await supabase.from("leads").insert(insertPayload);
      if (!error) importados++;
    }

    // Update config_portais stats
    const now = new Date().toISOString();
    const { data: configRow } = await supabase
      .from("config_portais")
      .select("id, total_leads_importados")
      .eq("user_id", userId)
      .eq("portal", portal)
      .maybeSingle();

    if (configRow) {
      await supabase
        .from("config_portais")
        .update({
          total_leads_importados: (configRow.total_leads_importados || 0) + importados,
          ultima_sincronizacao: now,
        })
        .eq("id", configRow.id);
    } else {
      await supabase.from("config_portais").insert({
        user_id: userId,
        portal,
        ativo: true,
        total_leads_importados: importados,
        ultima_sincronizacao: now,
      });
    }

    // Create notification
    if (importados > 0) {
      await supabase.from("notificacoes").insert({
        user_id: userId,
        tipo: "novo_lead",
        titulo: `${importados} lead(s) importado(s) — ${portal}`,
        descricao: `${importados} novo(s) lead(s) recebido(s) pelo portal ${portal}.`,
        link: "/crm",
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ leads_importados: importados, total_recebidos: leadsData.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("import-leads-portais error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseXml(xml: string, portal: string): LeadData[] {
  switch (portal) {
    case "zap":
    case "vivareal":
      return parseZapVivareal(xml);
    case "olx":
      return parseOlx(xml);
    default:
      return parseGeneric(xml);
  }
}
