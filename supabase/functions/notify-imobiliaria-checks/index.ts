import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * notify-imobiliaria-checks
 *
 * Runs real estate–specific alert checks for all active imobiliária accounts.
 * Designed to be called via cron (e.g. every 30 minutes) or manually.
 *
 * Checks performed:
 *  1. Visita em 2h         – upcoming visits within 2 hours
 *  2. Lead sem contato     – new_lead untouched for 4+ hours
 *  3. Lead prioritário parado – proposta/negociando with no update for 3+ days
 *  4. Meta atingida        – corretor reached their monthly lead/sales goal
 *  5. Contrato assinado    – notify manager when pipeline reaches contrato_assinado
 */

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  let targetUserId: string | null = null;
  try {
    const body = await req.json();
    targetUserId = body?.user_id || null;
  } catch { /* cron or no-body POST */ }

  let userIds: string[] = [];
  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    const { data: configs } = await supabase
      .from("configuracoes_sistema")
      .select("user_id");
    userIds = (configs || []).map((c: any) => c.user_id);
  }

  const summary: Record<string, any> = {};

  for (const userId of userIds) {
    try {
      const result = await runChecksForUser(userId);
      summary[userId] = result;
    } catch (err) {
      summary[userId] = { error: String(err) };
    }
  }

  return new Response(JSON.stringify({ summary }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function runChecksForUser(userId: string) {
  const now = new Date();
  const today = toDateStr(now);
  const notifications: any[] = [];

  // ── Dedup helper: suppress if same tipo+metadata key seen in last 6h ──────
  const sixHoursAgo = new Date(now.getTime() - 6 * 3600_000).toISOString();
  const { data: recentNotifs } = await supabase
    .from("notificacoes")
    .select("tipo, metadata")
    .eq("user_id", userId)
    .gte("created_at", sixHoursAgo);

  const recentKeys = new Set(
    (recentNotifs || []).map((n: any) => {
      const meta = n.metadata || {};
      const key = meta.lead_id || meta.visita_id || meta.corretor_id || meta.titulo_key || "";
      return `${n.tipo}::${key}`;
    })
  );

  function isDup(tipo: string, key: string) {
    return recentKeys.has(`${tipo}::${key}`);
  }

  // ── 1. Visita em 2h ────────────────────────────────────────────────────────
  const twoHoursLater = new Date(now.getTime() + 2 * 3600_000);
  const windowStart = new Date(now.getTime() + 90 * 60_000); // +1.5h
  const windowEnd = new Date(now.getTime() + 150 * 60_000);  // +2.5h

  const { data: visitas } = await supabase
    .from("agenda_visitas")
    .select("id, data_visita, hora_visita, lead_id, imovel_id, corretor_id, leads(nome), imoveis(tipo, bairro)")
    .eq("user_id", userId)
    .eq("data_visita", today)
    .in("status", ["agendada", "confirmada"]);

  for (const v of visitas || []) {
    if (!v.hora_visita) continue;
    const [h, m] = (v.hora_visita as string).split(":").map(Number);
    const visitaDt = new Date(today);
    visitaDt.setHours(h, m, 0, 0);
    if (visitaDt >= windowStart && visitaDt <= windowEnd) {
      if (!isDup("visita_proxima", v.id)) {
        const leadNome = (v.leads as any)?.nome || "Lead";
        const imovelDesc = (v.imoveis as any)
          ? `${(v.imoveis as any).tipo} em ${(v.imoveis as any).bairro || "—"}`
          : "Imóvel";
        notifications.push({
          user_id: userId,
          tipo: "visita_proxima",
          titulo: `Visita em ~2h com ${leadNome}`,
          descricao: `${imovelDesc} · às ${v.hora_visita}`,
          link: "/agenda",
          metadata: { visita_id: v.id, lead_id: v.lead_id },
        });
      }
    }
  }

  // ── 2. Lead sem contato > 4h ───────────────────────────────────────────────
  const fourHoursAgo = new Date(now.getTime() - 4 * 3600_000).toISOString();
  const { data: leadsNovos } = await supabase
    .from("leads")
    .select("id, nome, origem_portal, created_at")
    .eq("user_id", userId)
    .eq("status", "novo_lead")
    .lt("created_at", fourHoursAgo);

  for (const l of leadsNovos || []) {
    if (!isDup("lead_sem_contato", l.id)) {
      const horasAtras = Math.round(
        (now.getTime() - new Date(l.created_at).getTime()) / 3600_000
      );
      notifications.push({
        user_id: userId,
        tipo: "lead_sem_contato",
        titulo: `${l.nome} aguarda contato há ${horasAtras}h`,
        descricao: `Lead recebido${l.origem_portal ? ` via ${l.origem_portal}` : ""} sem resposta`,
        link: "/crm",
        metadata: { lead_id: l.id },
      });
    }
  }

  // ── 3. Lead prioritário parado > 3 dias ───────────────────────────────────
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400_000).toISOString();
  const { data: leadsParados } = await supabase
    .from("leads")
    .select("id, nome, status, updated_at")
    .eq("user_id", userId)
    .in("status", ["proposta_enviada", "negociando", "visita_realizada"])
    .lt("updated_at", threeDaysAgo);

  for (const l of leadsParados || []) {
    if (!isDup("lead_prioritario_parado", l.id)) {
      const diasAtras = Math.round(
        (now.getTime() - new Date(l.updated_at).getTime()) / 86400_000
      );
      const statusLabel: Record<string, string> = {
        proposta_enviada: "Proposta Enviada",
        negociando: "Negociando",
        visita_realizada: "Visita Realizada",
      };
      notifications.push({
        user_id: userId,
        tipo: "lead_prioritario_parado",
        titulo: `${l.nome} parado em "${statusLabel[l.status] || l.status}" há ${diasAtras} dias`,
        descricao: "Retome o contato para avançar no pipeline",
        link: "/crm",
        metadata: { lead_id: l.id },
      });
    }
  }

  // ── 4. Meta atingida (por corretor) ───────────────────────────────────────
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: corretores } = await supabase
    .from("corretores")
    .select("id, nome, meta_leads_mes, meta_vendas_mes")
    .eq("admin_id", userId)
    .eq("ativo", true);

  for (const c of corretores || []) {
    // Count leads this month
    if (c.meta_leads_mes) {
      const { count: leadsCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("corretor_responsavel", c.id)
        .gte("created_at", firstOfMonth);

      if ((leadsCount || 0) >= c.meta_leads_mes) {
        const deupKey = `${c.id}-leads-${now.getFullYear()}-${now.getMonth()}`;
        if (!isDup("meta_atingida", deupKey)) {
          notifications.push({
            user_id: userId,
            tipo: "meta_atingida",
            titulo: `🎯 ${c.nome} atingiu a meta de leads!`,
            descricao: `${leadsCount} leads captados · meta: ${c.meta_leads_mes}`,
            link: "/corretores",
            metadata: { corretor_id: c.id, tipo_meta: "leads", titulo_key: deupKey },
          });
        }
      }
    }

    // Count closed deals (contrato_assinado) this month
    if (c.meta_vendas_mes) {
      const { count: vendasCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("corretor_responsavel", c.id)
        .eq("status", "contrato_assinado")
        .gte("updated_at", firstOfMonth);

      if ((vendasCount || 0) >= c.meta_vendas_mes) {
        const deupKey = `${c.id}-vendas-${now.getFullYear()}-${now.getMonth()}`;
        if (!isDup("meta_atingida", deupKey)) {
          notifications.push({
            user_id: userId,
            tipo: "meta_atingida",
            titulo: `🏆 ${c.nome} atingiu a meta de vendas!`,
            descricao: `${vendasCount} negócios fechados · meta: ${c.meta_vendas_mes}`,
            link: "/corretores",
            metadata: { corretor_id: c.id, tipo_meta: "vendas", titulo_key: deupKey },
          });
        }
      }
    }
  }

  // ── 5. Contrato assinado (notificar gestor) ────────────────────────────────
  const oneDayAgo = new Date(now.getTime() - 86400_000).toISOString();
  const { data: contratos } = await supabase
    .from("leads")
    .select("id, nome, updated_at")
    .eq("user_id", userId)
    .eq("status", "contrato_assinado")
    .gte("updated_at", oneDayAgo);

  for (const c of contratos || []) {
    if (!isDup("contrato_assinado_alerta", c.id)) {
      notifications.push({
        user_id: userId,
        tipo: "contrato_assinado_alerta",
        titulo: `Contrato assinado com ${c.nome}!`,
        descricao: "Parabéns! Verifique as comissões e próximos passos.",
        link: "/crm",
        metadata: { lead_id: c.id },
      });

      // Also trigger WhatsApp to manager (non-blocking)
      supabase.functions.invoke("notify-manager-whatsapp", {
        body: {
          user_id: userId,
          tipo: "contrato_assinado",
          dados: { lead_nome: c.nome },
        },
      }).catch(() => {});
    }
  }

  // ── 6. Prazo de decisão em 5 dias ─────────────────────────────────────────
  // Find leads with prazo_decisao as a date string within next 5 days
  const fiveDaysLater = new Date(now.getTime() + 5 * 86400_000);
  const fiveDaysLaterStr = toDateStr(fiveDaysLater);
  const todayStr = toDateStr(now);

  const { data: leadsComPrazo } = await supabase
    .from("leads")
    .select("id, nome, status, prazo_decisao")
    .eq("user_id", userId)
    .not("prazo_decisao", "is", null)
    .not("status", "in", "(contrato_assinado,perdido)")
    .gte("prazo_decisao", todayStr)
    .lte("prazo_decisao", fiveDaysLaterStr);

  for (const l of leadsComPrazo || []) {
    if (!isDup("prazo_decisao_alerta", l.id)) {
      const prazoDate = new Date(l.prazo_decisao);
      const diasRestantes = Math.ceil(
        (prazoDate.getTime() - now.getTime()) / 86400_000
      );
      const urgencia = diasRestantes <= 1 ? "URGENTE — " : diasRestantes <= 2 ? "ATENÇÃO — " : "";
      notifications.push({
        user_id: userId,
        tipo: "prazo_decisao_alerta",
        titulo: `${urgencia}Prazo de decisão de ${l.nome} em ${diasRestantes} dia${diasRestantes !== 1 ? "s" : ""}`,
        descricao: `Lead em "${l.status?.replace(/_/g, " ")}". Entre em contato para fechar o negócio.`,
        link: "/crm",
        metadata: { lead_id: l.id, prazo_decisao: l.prazo_decisao },
      });
    }
  }

  // ── Insert new notifications ───────────────────────────────────────────────
  if (notifications.length > 0) {
    await supabase.from("notificacoes").insert(notifications);
  }

  return {
    generated: notifications.length,
    checks: {
      visitas_proximas: notifications.filter(n => n.tipo === "visita_proxima").length,
      leads_sem_contato: notifications.filter(n => n.tipo === "lead_sem_contato").length,
      leads_parados: notifications.filter(n => n.tipo === "lead_prioritario_parado").length,
      metas_atingidas: notifications.filter(n => n.tipo === "meta_atingida").length,
      contratos: notifications.filter(n => n.tipo === "contrato_assinado_alerta").length,
      prazos_decisao: notifications.filter(n => n.tipo === "prazo_decisao_alerta").length,
    },
  };
}
