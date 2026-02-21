import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Mail, MessageSquare, DollarSign, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, isWithinInterval, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KpiData {
  leadsDoMes: number;
  reunioesAgendadas: number;
  taxaRespostaEmail: number;
  taxaRespostaWhatsapp: number;
  faturamentoMes: number;
  margemLiquida: number;
  custosMes: number;
}

interface LeadRecente {
  id: string;
  nome: string;
  empresa: string | null;
  score: number | null;
  status: string | null;
  criado_em: string | null;
}

interface PagamentoProximo {
  id: string;
  cliente_nome: string;
  valor: number;
  data_vencimento: string;
  status: string;
}

interface WeeklyLeads {
  semana: string;
  leads: number;
}

interface MonthlyRevenue {
  mes: string;
  desenvolvimento: number;
  recorrente: number;
}

function getScoreColor(score: number | null) {
  if (!score) return "bg-muted text-muted-foreground";
  if (score >= 71) return "bg-success/20 text-success";
  if (score >= 41) return "bg-warning/20 text-warning";
  return "bg-destructive/20 text-destructive";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function Dashboard() {
  const [kpis, setKpis] = useState<KpiData>({
    leadsDoMes: 0, reunioesAgendadas: 0, taxaRespostaEmail: 0,
    taxaRespostaWhatsapp: 0, faturamentoMes: 0, margemLiquida: 0, custosMes: 0,
  });
  const [leadsRecentes, setLeadsRecentes] = useState<LeadRecente[]>([]);
  const [pagamentosProximos, setPagamentosProximos] = useState<PagamentoProximo[]>([]);
  const [weeklyLeadsData, setWeeklyLeadsData] = useState<WeeklyLeads[]>([]);
  const [monthlyRevenueData, setMonthlyRevenueData] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const now = new Date();
    const mesAtualInicio = startOfMonth(now).toISOString();
    const mesAtualFim = endOfMonth(now).toISOString();

    // Parallel fetch
    const [
      leadsRes, leadsRecentesRes, parcelasRes, recorrenciasRes, custosRes, allLeadsRes,
    ] = await Promise.all([
      supabase.from("leads").select("*").gte("criado_em", mesAtualInicio).lte("criado_em", mesAtualFim),
      supabase.from("leads").select("id, nome, empresa, score, status, criado_em").order("criado_em", { ascending: false }).limit(5),
      supabase.from("parcelas").select("id, valor, data_vencimento, status, contrato_id, contratos(cliente_nome)").gte("data_vencimento", format(now, "yyyy-MM-dd")).lte("data_vencimento", format(addDays(now, 7), "yyyy-MM-dd")).eq("status", "pendente").order("data_vencimento", { ascending: true }).limit(10),
      supabase.from("recorrencias").select("valor_mensal").eq("ativo", true),
      supabase.from("custos").select("valor_mensal").eq("ativo", true),
      supabase.from("leads").select("criado_em").gte("criado_em", subDays(now, 30).toISOString()),
    ]);

    // KPIs
    const leadsMes = leadsRes.data || [];
    const totalLeads = leadsMes.length;
    const reunioes = leadsMes.filter(l => l.reuniao_agendada).length;

    const emailEnviados = leadsMes.filter(l => l.email_enviado).length;
    const emailRespondidos = leadsMes.filter(l => l.email_respondido).length;
    const taxaEmail = emailEnviados > 0 ? Math.round((emailRespondidos / emailEnviados) * 100) : 0;

    const whatsEnviados = leadsMes.filter(l => l.whatsapp_enviado).length;
    const whatsRespondidos = leadsMes.filter(l => l.whatsapp_respondido).length;
    const taxaWhatsapp = whatsEnviados > 0 ? Math.round((whatsRespondidos / whatsEnviados) * 100) : 0;

    // Revenue: parcelas pagas este mês + recorrências ativas
    const { data: parcelasPagas } = await supabase
      .from("parcelas")
      .select("valor")
      .eq("status", "pago")
      .gte("data_pagamento", format(startOfMonth(now), "yyyy-MM-dd"))
      .lte("data_pagamento", format(endOfMonth(now), "yyyy-MM-dd"));

    const receitaDev = (parcelasPagas || []).reduce((sum, p) => sum + Number(p.valor), 0);
    const receitaRecorrente = (recorrenciasRes.data || []).reduce((sum, r) => sum + Number(r.valor_mensal), 0);
    const faturamento = receitaDev + receitaRecorrente;
    const totalCustos = (custosRes.data || []).reduce((sum, c) => sum + Number(c.valor_mensal), 0);
    const margem = faturamento - totalCustos;

    setKpis({
      leadsDoMes: totalLeads,
      reunioesAgendadas: reunioes,
      taxaRespostaEmail: taxaEmail,
      taxaRespostaWhatsapp: taxaWhatsapp,
      faturamentoMes: faturamento,
      margemLiquida: margem,
      custosMes: totalCustos,
    });

    // Recent leads
    setLeadsRecentes(leadsRecentesRes.data || []);

    // Upcoming payments
    const pagamentos: PagamentoProximo[] = (parcelasRes.data || []).map((p: any) => ({
      id: p.id,
      cliente_nome: p.contratos?.cliente_nome || "—",
      valor: Number(p.valor),
      data_vencimento: p.data_vencimento,
      status: p.status,
    }));
    setPagamentosProximos(pagamentos);

    // Weekly leads chart (last 4 weeks)
    const allLeads = allLeadsRes.data || [];
    const weeks: WeeklyLeads[] = [];
    for (let i = 3; i >= 0; i--) {
      const refDate = subDays(now, i * 7);
      const weekStart = startOfWeek(refDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(refDate, { weekStartsOn: 1 });
      const count = allLeads.filter(l => {
        if (!l.criado_em) return false;
        const d = new Date(l.criado_em);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      }).length;
      weeks.push({ semana: format(weekStart, "dd/MM", { locale: ptBR }), leads: count });
    }
    setWeeklyLeadsData(weeks);

    // Monthly revenue chart (last 6 months)
    const monthlyData: MonthlyRevenue[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

      const { data: mParcelas } = await supabase
        .from("parcelas")
        .select("valor")
        .eq("status", "pago")
        .gte("data_pagamento", mStart)
        .lte("data_pagamento", mEnd);

      const dev = (mParcelas || []).reduce((s, p) => s + Number(p.valor), 0);
      monthlyData.push({
        mes: format(monthDate, "MMM", { locale: ptBR }),
        desenvolvimento: dev,
        recorrente: receitaRecorrente,
      });
    }
    setMonthlyRevenueData(monthlyData);

    setLoading(false);
  }

  const kpiCards = [
    { title: "Leads do Mês", value: String(kpis.leadsDoMes), icon: Users },
    { title: "Reuniões Agendadas", value: String(kpis.reunioesAgendadas), icon: Calendar },
    { title: "Taxa Resposta Email", value: `${kpis.taxaRespostaEmail}%`, icon: Mail },
    { title: "Taxa Resposta WhatsApp", value: `${kpis.taxaRespostaWhatsapp}%`, icon: MessageSquare },
    { title: "Faturamento do Mês", value: formatCurrency(kpis.faturamentoMes), icon: DollarSign },
    { title: "Margem Líquida", value: formatCurrency(kpis.margemLiquida), icon: TrendingUp, subtitle: kpis.faturamentoMes > 0 ? `${Math.round((kpis.margemLiquida / kpis.faturamentoMes) * 100)}%` : "0%" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{kpi.value}</div>
              {"subtitle" in kpi && kpi.subtitle && (
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">Leads por Semana</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyLeadsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis dataKey="semana" tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} />
                <Bar dataKey="leads" fill="url(#gradientBar)" radius={[4, 4, 0, 0]} />
                <defs>
                  <linearGradient id="gradientBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(252 100% 64%)" />
                    <stop offset="100%" stopColor="hsl(187 100% 50%)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">Faturamento — Últimos 6 Meses</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                <XAxis dataKey="mes" tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} formatter={(value: number) => formatCurrency(value)} />
                <Legend wrapperStyle={{ color: "hsl(0 0% 55%)" }} />
                <Bar dataKey="desenvolvimento" name="Desenvolvimento" fill="hsl(252 100% 64%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recorrente" name="Recorrente" fill="hsl(187 100% 50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">Leads Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {leadsRecentes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum lead cadastrado ainda.</p>
            ) : (
              <div className="space-y-3">
                {leadsRecentes.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground">{lead.empresa || "Sem empresa"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs ${getScoreColor(lead.score)}`}>
                        {lead.score ?? 0}
                      </Badge>
                      <Badge variant="outline" className="text-xs capitalize">
                        {lead.status || "novo"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm">Pagamentos Próximos (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {pagamentosProximos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento pendente nos próximos 7 dias.</p>
            ) : (
              <div className="space-y-3">
                {pagamentosProximos.map((pag) => (
                  <div key={pag.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{pag.cliente_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence em {format(new Date(pag.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-warning">{formatCurrency(pag.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
