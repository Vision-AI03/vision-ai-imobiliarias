import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function getWeekBounds(date: Date) {
  const day = date.getDay(); // 0=Sun
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMon);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function getPrevWeekBounds(date: Date) {
  const prev = new Date(date);
  prev.setDate(date.getDate() - 7);
  return getWeekBounds(prev);
}

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0];
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

Deno.serve(async (req) => {
  let targetUserId: string | null = null;
  try {
    const body = await req.json();
    targetUserId = body?.user_id || null;
  } catch { /* cron call with empty body */ }

  let userIds: string[] = [];
  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    // All users that have imobiliária config (for cron)
    const { data: configs } = await supabase
      .from("configuracoes_sistema")
      .select("user_id");
    userIds = (configs || []).map((c: any) => c.user_id);
  }

  const results: any[] = [];
  for (const userId of userIds) {
    try {
      const result = await generateForUser(userId);
      results.push({ user_id: userId, ...result });
    } catch (err) {
      results.push({ user_id: userId, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function generateForUser(userId: string) {
  const now = new Date();
  const { monday, sunday } = getWeekBounds(now);
  const { monday: prevMon, sunday: prevSun } = getPrevWeekBounds(now);
  const weekStart = toDateStr(monday);
  const weekEnd = toDateStr(sunday);
  const prevStart = toDateStr(prevMon);
  const prevEnd = toDateStr(prevSun);

  // --- Fetch config ---
  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("nome_imobiliaria, cnpj, email_gestor")
    .eq("user_id", userId)
    .maybeSingle();

  const nomeImob = config?.nome_imobiliaria || "Imobiliária";

  // --- Fetch corretores ---
  const { data: corretoresAll } = await supabase
    .from("corretores")
    .select("id, nome, perfil_acesso")
    .eq("admin_id", userId)
    .eq("ativo", true);
  const corretores = corretoresAll || [];

  // --- Current week data ---
  const [
    leadsRes,
    visitasRes,
    comissoesRes,
    imoveisRes,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, nome, status, origem_portal, corretor_responsavel, tipo_interesse, tipo_imovel, valor_min, valor_max, bairros_interesse, prazo_decisao, created_at, motivo_perda")
      .eq("user_id", userId)
      .gte("created_at", monday.toISOString())
      .lte("created_at", sunday.toISOString()),
    supabase
      .from("agenda_visitas")
      .select("id, lead_id, imovel_id, corretor_id, status, interesse_apos_visita, feedback_pos_visita, data_visita")
      .eq("user_id", userId)
      .gte("data_visita", weekStart)
      .lte("data_visita", weekEnd),
    supabase
      .from("comissoes")
      .select("id, corretor_id, valor_comissao, status, tipo_transacao")
      .eq("user_id", userId)
      .gte("created_at", monday.toISOString())
      .lte("created_at", sunday.toISOString()),
    supabase
      .from("imoveis")
      .select("id, tipo, finalidade, bairro, cidade, valor_venda, valor_aluguel, status")
      .eq("user_id", userId)
      .eq("status", "disponivel"),
  ]);

  // --- Previous week leads (for comparison) ---
  const { data: prevLeadsData } = await supabase
    .from("leads")
    .select("id, status")
    .eq("user_id", userId)
    .gte("created_at", prevMon.toISOString())
    .lte("created_at", prevSun.toISOString());

  const leads = leadsRes.data || [];
  const visitas = visitasRes.data || [];
  const comissoes = comissoesRes.data || [];
  const imoveis = imoveisRes.data || [];
  const prevLeads = prevLeadsData || [];

  // --- All leads for pipeline status counts ---
  const { data: allLeadsData } = await supabase
    .from("leads")
    .select("id, nome, status, origem_portal, corretor_responsavel, tipo_imovel, bairros_interesse, prazo_decisao, updated_at")
    .eq("user_id", userId);
  const allLeads = allLeadsData || [];

  // --- Metrics ---
  const totalLeadsSemana = leads.length;
  const totalPrevLeads = prevLeads.length;
  const visitasRealizadas = visitas.filter(v => v.status === "realizada").length;
  const visitasAgendadas = visitas.filter(v => v.status === "agendada" || v.status === "confirmada").length;
  const propostasEnviadas = allLeads.filter(l => l.status === "proposta_enviada").length;
  const contratosAssinados = allLeads.filter(l => l.status === "contrato_assinado").length;
  const perdidosSemana = leads.filter(l => l.status === "perdido").length;

  const vgvFechado = comissoes
    .filter(c => c.status === "recebida")
    .reduce((sum, c) => sum + (c.valor_comissao || 0), 0);
  const comissaoEstimadaSemana = comissoes.reduce((sum, c) => sum + (c.valor_comissao || 0), 0);

  const taxaVisita = totalLeadsSemana > 0 ? Math.round((visitasRealizadas / totalLeadsSemana) * 100) : 0;
  const taxaProposta = visitasRealizadas > 0 ? Math.round((propostasEnviadas / visitasRealizadas) * 100) : 0;
  const taxaFechamento = propostasEnviadas > 0 ? Math.round((contratosAssinados / propostasEnviadas) * 100) : 0;
  const variacaoLeads = totalPrevLeads > 0 ? Math.round(((totalLeadsSemana - totalPrevLeads) / totalPrevLeads) * 100) : 0;

  // --- Performance por corretor ---
  const corretorMap: Record<string, { nome: string; leads: number; visitas: number; contratos: number; comissao: number }> = {};
  for (const c of corretores) {
    corretorMap[c.id] = { nome: c.nome, leads: 0, visitas: 0, contratos: 0, comissao: 0 };
  }
  for (const l of leads) {
    if (l.corretor_responsavel && corretorMap[l.corretor_responsavel]) {
      corretorMap[l.corretor_responsavel].leads++;
    }
  }
  for (const v of visitas) {
    if (v.corretor_id && corretorMap[v.corretor_id]) {
      corretorMap[v.corretor_id].visitas++;
    }
  }
  for (const com of comissoes) {
    if (com.corretor_id && corretorMap[com.corretor_id]) {
      corretorMap[com.corretor_id].comissao += com.valor_comissao || 0;
      if (com.status === "recebida") corretorMap[com.corretor_id].contratos++;
    }
  }

  const rankingCorretores = Object.values(corretorMap)
    .sort((a, b) => b.contratos - a.contratos || b.leads - a.leads)
    .map(c => `- ${c.nome}: ${c.leads} leads | ${c.visitas} visitas | ${c.contratos} fechamentos | ${fmtBRL(c.comissao)} comissão`)
    .join("\n") || "Nenhum corretor com atividade registrada.";

  // --- Imóveis mais procurados ---
  const tipoCount: Record<string, number> = {};
  const bairroCount: Record<string, number> = {};
  for (const l of allLeads) {
    if (l.tipo_imovel) tipoCount[l.tipo_imovel] = (tipoCount[l.tipo_imovel] || 0) + 1;
    if (l.bairros_interesse) {
      for (const b of l.bairros_interesse) {
        bairroCount[b] = (bairroCount[b] || 0) + 1;
      }
    }
  }
  const topTipos = Object.entries(tipoCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${t} (${n} interessados)`)
    .join(", ") || "N/A";
  const topBairros = Object.entries(bairroCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([b, n]) => `${b} (${n})`)
    .join(", ") || "N/A";

  // --- Leads prioritários (proposta/negociando sem update recente) ---
  const DIAS_SEM_CONTATO = 3;
  const limiteData = new Date(now);
  limiteData.setDate(now.getDate() - DIAS_SEM_CONTATO);
  const leadsPrioritarios = allLeads
    .filter(l =>
      ["proposta_enviada", "negociando", "visita_realizada"].includes(l.status) &&
      (!l.updated_at || new Date(l.updated_at) < limiteData)
    )
    .slice(0, 8)
    .map(l => `- ${l.nome} (status: ${l.status}${l.prazo_decisao ? `, prazo: ${l.prazo_decisao}` : ""})`)
    .join("\n") || "Nenhum lead prioritário identificado.";

  // --- Feedbacks de visitas ---
  const feedbackPositivo = visitas.filter(v => ["muito_interessado", "interessado"].includes(v.interesse_apos_visita || "")).length;
  const feedbackNegativo = visitas.filter(v => ["nao_gostou", "desistiu"].includes(v.interesse_apos_visita || "")).length;
  const feedbackDetalhes = visitas
    .filter(v => v.feedback_pos_visita)
    .slice(0, 5)
    .map(v => `- Interesse: ${v.interesse_apos_visita || "N/I"} — "${v.feedback_pos_visita}"`)
    .join("\n") || "Sem feedbacks registrados.";

  // --- Origens ---
  const origensCount: Record<string, number> = {};
  for (const l of leads) {
    const o = l.origem_portal || "direto";
    origensCount[o] = (origensCount[o] || 0) + 1;
  }
  const origensStr = Object.entries(origensCount)
    .sort((a, b) => b[1] - a[1])
    .map(([o, n]) => `${o}: ${n}`)
    .join(", ") || "N/A";

  const prompt = `Você é um consultor de performance especializado em imobiliárias brasileiras.

Analise os dados da semana da imobiliária "${nomeImob}" e gere um relatório executivo detalhado e acionável.
Use tom profissional, direto e construtivo. Escreva em português brasileiro.

═══════════════════════════════════════
MÉTRICAS DA SEMANA (${weekStart} a ${weekEnd})
═══════════════════════════════════════

CAPTAÇÃO:
- Novos leads: ${totalLeadsSemana} (semana anterior: ${totalPrevLeads}, variação: ${variacaoLeads > 0 ? "+" : ""}${variacaoLeads}%)
- Origens: ${origensStr}
- Leads perdidos: ${perdidosSemana}

VISITAS:
- Visitas realizadas: ${visitasRealizadas}
- Visitas agendadas: ${visitasAgendadas}
- Feedbacks positivos: ${feedbackPositivo}
- Feedbacks negativos: ${feedbackNegativo}

PIPELINE:
- Propostas enviadas (total pipeline): ${propostasEnviadas}
- Contratos assinados: ${contratosAssinados}

FINANCEIRO:
- Comissões estimadas na semana: ${fmtBRL(comissaoEstimadaSemana)}
- Comissões recebidas: ${fmtBRL(vgvFechado)}

TAXAS DE CONVERSÃO:
- Lead → Visita: ${taxaVisita}%
- Visita → Proposta: ${taxaProposta}%
- Proposta → Fechamento: ${taxaFechamento}%

ESTOQUE DISPONÍVEL: ${imoveis.length} imóveis

═══════════════════════════════════════
RANKING DE CORRETORES
═══════════════════════════════════════
${rankingCorretores}

═══════════════════════════════════════
FEEDBACKS DE VISITAS
═══════════════════════════════════════
${feedbackDetalhes}

═══════════════════════════════════════
DEMANDA DE MERCADO
═══════════════════════════════════════
Tipos mais procurados: ${topTipos}
Bairros mais procurados: ${topBairros}

═══════════════════════════════════════
LEADS PRIORITÁRIOS (sem atualização há +${DIAS_SEM_CONTATO} dias)
═══════════════════════════════════════
${leadsPrioritarios}

---

Gere o relatório com exatamente estas seções em Markdown:

## 📊 Resumo Executivo
(3-4 frases resumindo a semana, destacando o ponto mais relevante positivo e a principal oportunidade de melhoria. Mencione o VGV/comissão se relevante.)

## 🏆 Performance por Corretor
(Analise o ranking, destaque o melhor desempenho, identifique quem precisa de apoio e sugira ações específicas por corretor.)

## 🏠 Imóveis Mais Procurados
(Analise tipos e bairros com maior demanda. Identifique gaps no estoque. Sugira captações prioritárias.)

## 📞 Análise de Abordagem
(Avalie a qualidade das visitas com base nos feedbacks. Identifique o que está gerando interesse e o que afasta clientes.)

## 💬 Scripts e Pitchs Recomendados
(Forneça 2-3 scripts prontos para usar: abordagem inicial, follow-up pós-visita, reativação de lead frio. Use linguagem natural e eficaz.)

## 💡 Sugestões de Melhoria
(Máximo 5 sugestões acionáveis e específicas para a próxima semana, com exemplo prático cada.)

## 🎯 Leads Prioritários para Esta Semana
(Para cada lead prioritário listado acima, sugira a ação exata que o corretor deve tomar e o melhor argumento para avançar.)

## 📈 Comparativo Semana Anterior
(Compare os principais indicadores com a semana anterior. Destaque evolução positiva e alertas.)

Responda APENAS com o relatório em Markdown, sem texto adicional antes ou depois.`;

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) throw new Error("LOVABLE_API_KEY não configurada");

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5000,
    }),
  });
  const aiData = await aiRes.json();
  const relatorioMarkdown = aiData.choices?.[0]?.message?.content || "Relatório não disponível.";

  // Extract sections
  const extract = (pattern: RegExp) => relatorioMarkdown.match(pattern)?.[1]?.trim() || "";
  const resumo = extract(/## 📊 Resumo Executivo\n([\s\S]*?)(?=\n##|$)/);
  const perfCorretor = extract(/## 🏆 Performance por Corretor\n([\s\S]*?)(?=\n##|$)/);
  const imoveisMaisProcurados = extract(/## 🏠 Imóveis Mais Procurados\n([\s\S]*?)(?=\n##|$)/);
  const analiseAbordagem = extract(/## 📞 Análise de Abordagem\n([\s\S]*?)(?=\n##|$)/);
  const sugestoes = extract(/## 💡 Sugestões de Melhoria\n([\s\S]*?)(?=\n##|$)/);
  const leadsPrioritariosSection = extract(/## 🎯 Leads Prioritários para Esta Semana\n([\s\S]*?)(?=\n##|$)/);
  const comparativo = extract(/## 📈 Comparativo Semana Anterior\n([\s\S]*?)(?=\n##|$)/);

  // Save report
  const { data: relatorio } = await supabase.from("relatorios_semanais").insert({
    user_id: userId,
    semana_inicio: weekStart,
    semana_fim: weekEnd,
    resumo_executivo: resumo || relatorioMarkdown.slice(0, 500),
    total_leads_abordados: totalLeadsSemana,
    total_avancaram: visitasRealizadas,
    total_perdidos: perdidosSemana,
    taxa_conversao: taxaFechamento,
    analise_funcionou: analiseAbordagem,
    analise_nao_funcionou: "",
    sugestoes_melhoria: sugestoes,
    previsao_proxima_semana: leadsPrioritariosSection,
    relatorio_completo: relatorioMarkdown,
    metadata: {
      taxa_visita: taxaVisita,
      taxa_proposta: taxaProposta,
      taxa_fechamento: taxaFechamento,
      visitas_realizadas: visitasRealizadas,
      contratos_assinados: contratosAssinados,
      comissao_estimada: comissaoEstimadaSemana,
      vgv_fechado: vgvFechado,
      imoveis_disponiveis: imoveis.length,
      ranking_corretores: rankingCorretores,
      top_tipos: topTipos,
      top_bairros: topBairros,
      perf_corretor: perfCorretor,
      imoveis_procurados: imoveisMaisProcurados,
      comparativo: comparativo,
      semana_anterior: { total_leads: totalPrevLeads },
      variacao_leads: variacaoLeads,
    },
  }).select("id").single();

  // Notification
  await supabase.from("notificacoes").insert({
    user_id: userId,
    tipo: "relatorio_semanal",
    titulo: `Relatório Semanal — ${weekStart} a ${weekEnd}`,
    descricao: (resumo || relatorioMarkdown).slice(0, 200),
    link: "/relatorios",
    metadata: { relatorio_id: relatorio?.id },
  }).catch(() => {});

  // Email to gestor (if email_gestor configured)
  const emailGestor = config?.email_gestor;
  if (emailGestor) {
    await supabase.functions.invoke("send-email", {
      body: {
        to: emailGestor,
        subject: `[${nomeImob}] Relatório Semanal — ${weekStart} a ${weekEnd}`,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${relatorioMarkdown}</pre>`,
      },
    }).catch(() => {}); // non-fatal if send-email not deployed
  }

  return {
    relatorio_id: relatorio?.id,
    semana: `${weekStart} a ${weekEnd}`,
    metricas: {
      total_leads: totalLeadsSemana,
      visitas_realizadas: visitasRealizadas,
      contratos_assinados: contratosAssinados,
      comissao_estimada: comissaoEstimadaSemana,
    },
  };
}
