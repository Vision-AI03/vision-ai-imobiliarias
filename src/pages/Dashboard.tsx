import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Calendar, DollarSign, TrendingUp, CheckSquare, AlertTriangle,
  Clock, Plus, FileText, Home, BarChart2, ArrowRight, User, MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import {
  format, startOfMonth, endOfMonth, startOfWeek, addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

interface KpiImob {
  leadsDoMes: number;
  visitasAgendadasSemana: number;
  visitasRealizadasMes: number;
  propostasEnviadasMes: number;
  vgvFechadoMes: number;
  comissaoEstimada: number;
  txLeadVisita: number;
  txVisitaProposta: number;
  txPropostaFechamento: number;
  imoveisDisponiveis: number;
  leadsSemContato4h: number;
}

interface VisitaHoje {
  id: string;
  hora_visita: string;
  lead_nome: string;
  imovel_endereco: string;
  status: string;
}

interface LeadRecente {
  id: string;
  nome: string;
  status: string;
  origem_portal: string | null;
  criado_em: string;
}

interface TarefaHoje {
  id: string;
  titulo: string;
  prioridade: string;
  concluida: boolean;
}

const ORIGEM_ICONS: Record<string, string> = {
  zap: "🏠",
  vivareal: "🏠",
  olx: "🏠",
  meta: "📱",
  whatsapp: "💬",
  site: "🌐",
  indicacao: "👤",
  manual: "✋",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [kpis, setKpis] = useState<KpiImob>({
    leadsDoMes: 0, visitasAgendadasSemana: 0, visitasRealizadasMes: 0,
    propostasEnviadasMes: 0, vgvFechadoMes: 0, comissaoEstimada: 0,
    txLeadVisita: 0, txVisitaProposta: 0, txPropostaFechamento: 0,
    imoveisDisponiveis: 0, leadsSemContato4h: 0,
  });
  const [visitasHoje, setVisitasHoje] = useState<VisitaHoje[]>([]);
  const [leadsRecentes, setLeadsRecentes] = useState<LeadRecente[]>([]);
  const [tarefasHoje, setTarefasHoje] = useState<TarefaHoje[]>([]);
  const [weeklyLeadsData, setWeeklyLeadsData] = useState<{ semana: string; leads: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDashboard() {
    setLoading(true);
    try {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const mesInicio = startOfMonth(now).toISOString();
    const mesFim = endOfMonth(now).toISOString();
    const semanaInicio = startOfWeek(now, { weekStartsOn: 0 });
    const semanaFim = addDays(semanaInicio, 6);
    const h4agoIso = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

    const [
      leadsRes,
      visitasSemanRes,
      visitasMesRes,
      imoveisRes,
      visitasHojeRes,
      leadsRecentesRes,
      tarefasRes,
    ] = await Promise.all([
      supabase.from("leads").select("id, status, criado_em, atualizado_em").gte("criado_em", mesInicio).lte("criado_em", mesFim),
      supabase.from("agenda_visitas").select("id, status").gte("data_visita", format(semanaInicio, "yyyy-MM-dd")).lte("data_visita", format(semanaFim, "yyyy-MM-dd")).in("status", ["agendada", "confirmada"]),
      supabase.from("agenda_visitas").select("id, status").gte("data_visita", format(startOfMonth(now), "yyyy-MM-dd")).lte("data_visita", format(endOfMonth(now), "yyyy-MM-dd")).eq("status", "realizada"),
      supabase.from("imoveis").select("id, valor_venda, valor_aluguel").eq("status", "disponivel"),
      supabase.from("agenda_visitas").select("id, hora_visita, status, lead:leads(nome), imovel:imoveis(endereco, bairro)").eq("data_visita", today).order("hora_visita"),
      supabase.from("leads").select("id, nome, status, origem_portal, criado_em").order("criado_em", { ascending: false }).limit(6),
      supabase.from("tarefas").select("id, titulo, prioridade, concluida").eq("concluida", false).or(`data_vencimento.lte.${today},data_vencimento.is.null`).order("prioridade").limit(5),
    ]);

    const leads = leadsRes.data || [];
    const totalLeads = leads.length;
    const visitasAgendadasSemana = visitasSemanRes.data?.length || 0;
    const visitasRealizadasMes = visitasMesRes.data?.length || 0;
    const propostasEnviadas = leads.filter(l => l.status === "proposta_enviada" || l.status === "negociando" || l.status === "contrato_assinado").length;
    const contratosAssinados = leads.filter(l => l.status === "contrato_assinado");

    // VGV estimado (leads contrato_assinado × ticket médio dos imóveis disponíveis)
    const imoveis = imoveisRes.data || [];
    const ticketMedio = imoveis.length > 0
      ? imoveis.reduce((acc, i) => acc + (i.valor_venda || i.valor_aluguel || 0), 0) / imoveis.length
      : 0;
    const vgvFechado = contratosAssinados.length * ticketMedio;
    const comissaoEstimada = vgvFechado * 0.05; // 5% estimado

    // Taxas de conversão
    const visitasTotal = visitasRealizadasMes;
    const txLeadVisita = totalLeads > 0 ? Math.round((visitasTotal / totalLeads) * 100) : 0;
    const txVisitaProposta = visitasTotal > 0 ? Math.round((propostasEnviadas / visitasTotal) * 100) : 0;
    const txPropostaFechamento = propostasEnviadas > 0 ? Math.round((contratosAssinados.length / propostasEnviadas) * 100) : 0;

    // Leads sem contato há 4h (leads no estágio novo_lead atualizados há mais de 4h)
    const leadsSemContato = leads.filter(l => l.status === "novo_lead" && l.atualizado_em && l.atualizado_em < h4agoIso).length;

    setKpis({
      leadsDoMes: totalLeads,
      visitasAgendadasSemana,
      visitasRealizadasMes,
      propostasEnviadasMes: propostasEnviadas,
      vgvFechadoMes: vgvFechado,
      comissaoEstimada,
      txLeadVisita,
      txVisitaProposta,
      txPropostaFechamento,
      imoveisDisponiveis: imoveis.length,
      leadsSemContato4h: leadsSemContato,
    });

    // Visitas de hoje
    const vh = (visitasHojeRes.data || []).map((v: any) => ({
      id: v.id,
      hora_visita: v.hora_visita,
      status: v.status,
      lead_nome: v.lead?.nome || "Lead não vinculado",
      imovel_endereco: v.imovel
        ? `${v.imovel.endereco || ""}${v.imovel.bairro ? `, ${v.imovel.bairro}` : ""}`
        : "Imóvel não vinculado",
    }));
    setVisitasHoje(vh);

    setLeadsRecentes((leadsRecentesRes.data as LeadRecente[]) || []);
    setTarefasHoje((tarefasRes.data as TarefaHoje[]) || []);

    // Gráfico — leads por semana (últimas 8 semanas) — queries em paralelo
    const semanaRanges = Array.from({ length: 8 }, (_, idx) => {
      const i = 7 - idx;
      const semanaIdx = addDays(startOfWeek(now, { weekStartsOn: 1 }), -i * 7);
      return { semanaIdx, fimSemana: addDays(semanaIdx, 6) };
    });

    const semanaCounts = await Promise.all(
      semanaRanges.map(({ semanaIdx, fimSemana }) =>
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .gte("criado_em", semanaIdx.toISOString())
          .lte("criado_em", fimSemana.toISOString())
      )
    );

    const semanas = semanaRanges.map(({ semanaIdx }, idx) => ({
      semana: format(semanaIdx, "dd/MM", { locale: ptBR }),
      leads: semanaCounts[idx].count || 0,
    }));
    setWeeklyLeadsData(semanas);

    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
      toast({ title: "Erro ao carregar dashboard", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleTarefa(id: string) {
    const { error } = await supabase.from("tarefas").update({ concluida: true, status: "feito" }).eq("id", id);
    if (error) {
      toast({ title: "Erro ao concluir tarefa", variant: "destructive" });
      return;
    }
    setTarefasHoje(prev => prev.filter(t => t.id !== id));
    toast({ title: "Tarefa concluída!" });
  }

  const KpiCard = ({
    title, value, subtitle, icon: Icon, color = "text-primary", alert = false, onClick,
  }: {
    title: string; value: string | number; subtitle?: string;
    icon: any; color?: string; alert?: boolean; onClick?: () => void;
  }) => (
    <Card
      className={`transition-all ${alert ? "border-destructive/50 bg-destructive/5" : ""} ${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/40" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold mt-0.5 ${alert ? "text-destructive" : color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`p-2.5 rounded-xl ${alert ? "bg-destructive/10" : "bg-primary/10"}`}>
            <Icon className={`h-5 w-5 ${alert ? "text-destructive" : color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={() => navigate("/crm")}>
            <Users className="h-4 w-4 mr-1" /> Novo Lead
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/imoveis")}>
            <Home className="h-4 w-4 mr-1" /> Cadastrar Imóvel
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/contratos")}>
            <FileText className="h-4 w-4 mr-1" /> Gerar Contrato
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/agenda")}>
            <Calendar className="h-4 w-4 mr-1" /> Nova Visita
          </Button>
        </div>
      </div>

      {/* Alerta: leads sem contato */}
      {kpis.leadsSemContato4h > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">
                {kpis.leadsSemContato4h} lead{kpis.leadsSemContato4h > 1 ? "s" : ""} sem contato há mais de 4 horas
              </p>
              <p className="text-xs text-muted-foreground">Ação rápida pode evitar perda de oportunidade.</p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => navigate("/crm")}>
              Ver no CRM
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Leads do Mês" value={kpis.leadsDoMes} icon={Users} onClick={() => navigate("/crm")} />
        <KpiCard title="Visitas esta Semana" value={kpis.visitasAgendadasSemana} subtitle="Agendadas/confirmadas" icon={Calendar} onClick={() => navigate("/agenda")} />
        <KpiCard title="Visitas Realizadas" value={kpis.visitasRealizadasMes} subtitle="Neste mês" icon={CheckSquare} onClick={() => navigate("/agenda")} />
        <KpiCard title="Propostas Enviadas" value={kpis.propostasEnviadasMes} subtitle="Mês atual" icon={FileText} onClick={() => navigate("/crm")} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="VGV Fechado no Mês"
          value={formatCurrency(kpis.vgvFechadoMes)}
          subtitle="Valor Geral de Vendas"
          icon={DollarSign}
          color="text-emerald-500"
          onClick={() => navigate("/relatorios")}
        />
        <KpiCard
          title="Comissão Estimada"
          value={formatCurrency(kpis.comissaoEstimada)}
          subtitle="5% sobre VGV"
          icon={TrendingUp}
          color="text-emerald-500"
          onClick={() => navigate("/relatorios")}
        />
        <KpiCard
          title="Imóveis em Carteira"
          value={kpis.imoveisDisponiveis}
          subtitle="Disponíveis"
          icon={Home}
          onClick={() => navigate("/imoveis")}
        />
        <KpiCard
          title="Leads Sem Resposta"
          value={kpis.leadsSemContato4h}
          subtitle="> 4 horas"
          icon={AlertTriangle}
          alert={kpis.leadsSemContato4h > 0}
          onClick={() => navigate("/crm")}
        />
      </div>

      {/* Taxas de conversão */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-primary" />
            Taxas de Conversão do Funil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Lead → Visita", value: kpis.txLeadVisita },
              { label: "Visita → Proposta", value: kpis.txVisitaProposta },
              { label: "Proposta → Fechamento", value: kpis.txPropostaFechamento },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className={`text-2xl font-bold ${value >= 30 ? "text-emerald-500" : value >= 15 ? "text-yellow-500" : "text-destructive"}`}>
                  {value}%
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${value >= 30 ? "bg-emerald-500" : value >= 15 ? "bg-yellow-500" : "bg-destructive"}`}
                    style={{ width: `${Math.min(value, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfico de leads semanais */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Leads por Semana (últimas 8 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyLeadsData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`${v} leads`, "Leads"]}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Leads recentes */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Leads Recentes</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/crm")}>
                Ver todos <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {leadsRecentes.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum lead neste mês.</p>
            ) : (
              leadsRecentes.map(lead => (
                <div
                  key={lead.id}
                  className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/60 transition-colors"
                  onClick={() => navigate("/crm")}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs truncate">{lead.nome}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {ORIGEM_ICONS[lead.origem_portal || "manual"] || "✋"} {lead.status?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {format(new Date(lead.criado_em), "dd/MM")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visitas de Hoje */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Visitas de Hoje
                {visitasHoje.length > 0 && (
                  <Badge className="text-xs">{visitasHoje.length}</Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/agenda")}>
                Ver agenda <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {visitasHoje.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma visita agendada para hoje.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {visitasHoje.map(v => (
                  <div key={v.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/50 cursor-pointer hover:border-primary/40 hover:bg-muted/50 transition-all" onClick={() => navigate("/agenda")}>
                    <div className="text-center min-w-[42px]">
                      <span className="text-sm font-bold">{v.hora_visita.slice(0, 5)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.lead_nome}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {v.imovel_endereco}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${v.status === "realizada" ? "bg-green-500/15 text-green-600 border-green-500/30" : "bg-blue-500/15 text-blue-600 border-blue-500/30"}`}
                    >
                      {v.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tarefas do dia */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                Tarefas Pendentes
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate("/tarefas")}>
                Ver todas <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {tarefasHoje.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma tarefa pendente.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tarefasHoje.map(t => (
                  <div key={t.id} className="flex items-center gap-2.5 cursor-pointer rounded-md px-1 py-0.5 -mx-1 hover:bg-muted/60 transition-colors" onClick={() => navigate("/tarefas")}>
                    <Checkbox
                      checked={t.concluida}
                      onCheckedChange={(checked) => { if (checked) handleToggleTarefa(t.id); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{t.titulo}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${
                        t.prioridade === "alta"
                          ? "bg-red-500/10 text-red-500 border-red-500/30"
                          : t.prioridade === "media"
                          ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t.prioridade}
                    </Badge>
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
