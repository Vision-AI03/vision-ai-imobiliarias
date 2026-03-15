import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * notify-manager-whatsapp
 *
 * Sends a WhatsApp message to the imobiliária manager/owner via Evolution API.
 * Called internally by other Edge Functions (non-blocking).
 *
 * Supported tipos:
 *  - novo_lead          – new lead arrived from portal/hotsite
 *  - contrato_assinado  – deal closed
 *  - visita_agendada    – visit scheduled
 *  - relatorio_semanal  – weekly report available
 *  - meta_atingida      – corretor reached goal
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, tipo, dados = {} } = await req.json();
    if (!user_id || !tipo) {
      return new Response(JSON.stringify({ error: "user_id e tipo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch imobiliária config
    const { data: config } = await supabase
      .from("configuracoes_sistema")
      .select("nome_imobiliaria, telefone_gestor, telefone_suporte")
      .eq("user_id", user_id)
      .maybeSingle();

    const gestorPhone = config?.telefone_gestor || config?.telefone_suporte;
    if (!gestorPhone) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Nenhum telefone do gestor configurado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Evolution API credentials
    const { data: whatsappCfg } = await supabase
      .from("whatsapp_config")
      .select("evolution_url, evolution_api_key, evolution_instance")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!whatsappCfg?.evolution_url || !whatsappCfg?.evolution_api_key || !whatsappCfg?.evolution_instance) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Evolution API não configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nomeImob = config?.nome_imobiliaria || "Imobiliária";
    const message = buildMessage(tipo, dados, nomeImob);
    if (!message) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "Tipo não mapeado" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean phone: keep only digits, add country code if missing
    const rawPhone = gestorPhone.replace(/\D/g, "");
    const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

    const evoUrl = `${whatsappCfg.evolution_url.replace(/\/$/, "")}/message/sendText/${whatsappCfg.evolution_instance}`;
    const evoRes = await fetch(evoUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: whatsappCfg.evolution_api_key,
      },
      body: JSON.stringify({
        number: phone,
        options: { delay: 1200, presence: "composing" },
        textMessage: { text: message },
      }),
    });

    const evoData = await evoRes.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ sent: evoRes.ok, status: evoRes.status, evo: evoData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-manager-whatsapp error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildMessage(tipo: string, dados: Record<string, any>, nomeImob: string): string {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  switch (tipo) {
    case "novo_lead":
      return (
        `🏠 *Novo Lead — ${nomeImob}*\n\n` +
        `👤 Nome: ${dados.lead_nome || "—"}\n` +
        `📞 Telefone: ${dados.lead_telefone || "—"}\n` +
        `🔗 Origem: ${dados.origem || "—"}\n` +
        (dados.tipo_interesse ? `🎯 Interesse: ${dados.tipo_interesse}\n` : "") +
        `\n⏰ ${now}`
      );

    case "contrato_assinado":
      return (
        `🏆 *Contrato Assinado — ${nomeImob}*\n\n` +
        `🎉 Parabéns! Negócio fechado com *${dados.lead_nome || "cliente"}*.\n` +
        (dados.imovel ? `🏠 Imóvel: ${dados.imovel}\n` : "") +
        (dados.corretor ? `👔 Corretor: ${dados.corretor}\n` : "") +
        (dados.valor ? `💰 Valor: ${dados.valor}\n` : "") +
        `\n⏰ ${now}`
      );

    case "visita_agendada":
      return (
        `📅 *Visita Agendada — ${nomeImob}*\n\n` +
        `👤 Cliente: ${dados.lead_nome || "—"}\n` +
        `🏠 Imóvel: ${dados.imovel || "—"}\n` +
        `📆 Data: ${dados.data || "—"} às ${dados.hora || "—"}\n` +
        (dados.corretor ? `👔 Corretor: ${dados.corretor}\n` : "") +
        `\n⏰ ${now}`
      );

    case "relatorio_semanal":
      return (
        `📊 *Relatório Semanal — ${nomeImob}*\n\n` +
        `Seu relatório de performance da semana está disponível na plataforma.\n\n` +
        (dados.total_leads ? `📥 Leads: ${dados.total_leads}\n` : "") +
        (dados.visitas_realizadas ? `🏠 Visitas: ${dados.visitas_realizadas}\n` : "") +
        (dados.contratos_assinados ? `✅ Contratos: ${dados.contratos_assinados}\n` : "") +
        (dados.comissao ? `💰 Comissão: ${dados.comissao}\n` : "") +
        `\n⏰ ${now}`
      );

    case "meta_atingida":
      return (
        `🎯 *Meta Atingida — ${nomeImob}*\n\n` +
        `🏅 *${dados.corretor_nome || "Corretor"}* atingiu a meta de ${dados.tipo_meta || "leads"} este mês!\n` +
        (dados.valor_atingido ? `📈 Resultado: ${dados.valor_atingido}\n` : "") +
        `\n⏰ ${now}`
      );

    case "lead_sem_contato":
      return (
        `⚠️ *Lead sem contato — ${nomeImob}*\n\n` +
        `👤 ${dados.lead_nome || "Lead"} aguarda retorno há ${dados.horas || "4"}h.\n` +
        `📞 Telefone: ${dados.telefone || "—"}\n` +
        `\nAcesse a plataforma para entrar em contato.\n\n⏰ ${now}`
      );

    default:
      return "";
  }
}
