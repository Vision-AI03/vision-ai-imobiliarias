import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * pos-venda-automation
 *
 * Handles post-sale relationship automation for imobiliárias.
 *
 * Modes (via body.action):
 *   "criar_tarefas"       – Creates follow-up task sequence when a deal is closed.
 *                           Requires: user_id, lead_id, lead_nome, [corretor_id]
 *   "verificar_aniversarios" – (Cron) Checks all leads with data_nascimento = today,
 *                           sends WhatsApp birthday message.
 *                           Accepts optional: user_id (to run for single user)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Sequence of post-sale follow-up tasks (days after contract signing)
const SEQUENCIA_POS_VENDA = [
  {
    dias: 1,
    titulo: (nome: string) => `Enviar pesquisa de satisfação para ${nome}`,
    descricao: "Entrar em contato para coletar feedback sobre a experiência de compra/aluguel.",
    prioridade: "alta",
  },
  {
    dias: 7,
    titulo: (nome: string) => `Verificar entrega das chaves / documentação — ${nome}`,
    descricao: "Confirmar que chaves foram entregues, documentação assinada e processo encerrado.",
    prioridade: "alta",
  },
  {
    dias: 30,
    titulo: (nome: string) => `Follow-up 30 dias — ${nome}`,
    descricao: "Ligar para verificar adaptação ao imóvel, resolver pendências e reforçar vínculo.",
    prioridade: "media",
  },
  {
    dias: 90,
    titulo: (nome: string) => `Follow-up 90 dias — Solicitar indicação de ${nome}`,
    descricao: "Verificar satisfação e solicitar indicação de amigos/familiares. Oferecer bônus por indicação.",
    prioridade: "media",
  },
  {
    dias: 180,
    titulo: (nome: string) => `Follow-up 6 meses — ${nome}`,
    descricao: "Apresentar novos imóveis em carteira. Verificar necessidades de investimento ou mudança.",
    prioridade: "baixa",
  },
  {
    dias: 365,
    titulo: (nome: string) => `Aniversário de 1 ano do contrato — ${nome}`,
    descricao: "Enviar mensagem de parabéns pelo aniversário do contrato. Reativar relacionamento.",
    prioridade: "media",
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action = "criar_tarefas", user_id, lead_id, lead_nome, corretor_id } = body;

    if (action === "criar_tarefas") {
      return await criarTarefasPosVenda({ user_id, lead_id, lead_nome, corretor_id });
    }

    if (action === "verificar_aniversarios") {
      return await verificarAniversarios(user_id);
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pos-venda-automation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Criar sequência de tarefas pós-venda ─────────────────────────────────────

async function criarTarefasPosVenda({
  user_id,
  lead_id,
  lead_nome,
  corretor_id,
}: {
  user_id: string;
  lead_id: string;
  lead_nome: string;
  corretor_id?: string;
}) {
  if (!user_id || !lead_id) {
    return new Response(
      JSON.stringify({ error: "user_id e lead_id são obrigatórios" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Check if tasks already exist for this lead (prevent duplicates on re-trigger)
  const { data: existing } = await supabase
    .from("tarefas")
    .select("id")
    .eq("user_id", user_id)
    .eq("lead_id", lead_id)
    .eq("categoria", "pos_venda")
    .limit(1);

  if (existing && existing.length > 0) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "Tarefas pós-venda já existem para este lead" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const hoje = new Date();
  const tarefas = SEQUENCIA_POS_VENDA.map((step) => {
    const vencimento = new Date(hoje);
    vencimento.setDate(hoje.getDate() + step.dias);
    return {
      user_id,
      lead_id,
      titulo: step.titulo(lead_nome),
      descricao: step.descricao,
      prioridade: step.prioridade,
      status: "a_fazer",
      concluida: false,
      categoria: "pos_venda",
      data_vencimento: vencimento.toISOString().split("T")[0],
    };
  });

  const { data, error } = await supabase.from("tarefas").insert(tarefas).select("id");
  if (error) throw error;

  // Create notification
  await supabase.from("notificacoes").insert({
    user_id,
    tipo: "contrato_assinado_alerta",
    titulo: `Régua pós-venda criada para ${lead_nome}`,
    descricao: `${tarefas.length} tarefas agendadas (D+1 a D+365)`,
    link: "/tarefas",
    metadata: { lead_id, tarefas_criadas: tarefas.length },
  }).catch(() => {});

  // Trigger WhatsApp to manager
  await supabase.functions.invoke("notify-manager-whatsapp", {
    body: {
      user_id,
      tipo: "contrato_assinado",
      dados: { lead_nome, corretor: corretor_id },
    },
  }).catch(() => {});

  return new Response(
    JSON.stringify({ tarefas_criadas: data?.length || 0, lead_id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// ── Verificar aniversários ────────────────────────────────────────────────────

async function verificarAniversarios(targetUserId?: string) {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  const pattern = `%-${mes}-${dia}`; // matches any year-MM-DD

  let userIds: string[] = [];
  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    const { data: configs } = await supabase
      .from("configuracoes_sistema")
      .select("user_id");
    userIds = (configs || []).map((c: any) => c.user_id);
  }

  const results: Record<string, any> = {};

  for (const userId of userIds) {
    // Find leads with birthday today (data_nascimento matches MM-DD)
    const { data: aniversariantes } = await supabase
      .from("leads")
      .select("id, nome, telefone, data_nascimento")
      .eq("user_id", userId)
      .like("data_nascimento", pattern)
      .not("telefone", "is", null);

    if (!aniversariantes || aniversariantes.length === 0) {
      results[userId] = { enviados: 0 };
      continue;
    }

    // Check if birthday notification already sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data: jaNotificados } = await supabase
      .from("notificacoes")
      .select("metadata")
      .eq("user_id", userId)
      .eq("tipo", "aniversario_cliente")
      .gte("created_at", todayStart.toISOString());

    const jaNotifIds = new Set(
      (jaNotificados || []).map((n: any) => n.metadata?.lead_id).filter(Boolean)
    );

    let enviados = 0;
    for (const lead of aniversariantes) {
      if (jaNotifIds.has(lead.id)) continue;

      // Create notification
      await supabase.from("notificacoes").insert({
        user_id: userId,
        tipo: "aniversario_cliente",
        titulo: `🎂 Aniversário de ${lead.nome} hoje!`,
        descricao: "Envie uma mensagem de parabéns para fortalecer o relacionamento.",
        link: "/crm",
        metadata: { lead_id: lead.id, telefone: lead.telefone },
      }).catch(() => {});

      // Send WhatsApp birthday message
      if (lead.telefone) {
        await enviarParabensWhatsapp(userId, lead.nome, lead.telefone);
      }

      enviados++;
    }

    results[userId] = { enviados, total_aniversariantes: aniversariantes.length };
  }

  return new Response(
    JSON.stringify({ results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function enviarParabensWhatsapp(userId: string, nome: string, telefone: string) {
  const { data: whatsappCfg } = await supabase
    .from("whatsapp_config")
    .select("evolution_url, evolution_api_key, evolution_instance")
    .eq("user_id", userId)
    .maybeSingle();

  if (!whatsappCfg?.evolution_url) return;

  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("nome_imobiliaria")
    .eq("user_id", userId)
    .maybeSingle();

  const nomeImob = config?.nome_imobiliaria || "nós";

  const message =
    `🎂 *Feliz Aniversário, ${nome}!*\n\n` +
    `Que este novo ano seja repleto de realizações e conquistas!\n\n` +
    `Com carinho,\n${nomeImob} 🏠`;

  const rawPhone = telefone.replace(/\D/g, "");
  const phone = rawPhone.startsWith("55") ? rawPhone : `55${rawPhone}`;

  await fetch(
    `${whatsappCfg.evolution_url.replace(/\/$/, "")}/message/sendText/${whatsappCfg.evolution_instance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: whatsappCfg.evolution_api_key,
      },
      body: JSON.stringify({
        number: phone,
        options: { delay: 1200 },
        textMessage: { text: message },
      }),
    }
  ).catch(() => {});
}
