import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart2, TrendingUp, TrendingDown, Minus, Loader2,
  ChevronLeft, Sparkles, Users, Home, CalendarCheck,
  FileSignature, DollarSign, MapPin,
} from "lucide-react";
import { format, subMonths, startOfMonth, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface Relatorio {
  id: string;
  semana_inicio: string;
  semana_fim: string;
  resumo_executivo: string;
  total_leads_abordados: number;
  total_avancaram: number;
  total_perdidos: number;
  taxa_conversao: number;
  relatorio_completo: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

function TrendBadge({ valor, anterior }: { valor: number; anterior?: number }) {
  if (anterior === undefined) return null;
  const diff = valor - anterior;
  if (diff > 0) return <span className="text-xs text-green-500 flex items-center gap-0.5"><TrendingUp className="h-3 w-3" />+{diff}</span>;
  if (diff < 0) return <span className="text-xs text-destructive flex items-center gap-0.5"><TrendingDown className="h-3 w-3" />{diff}</span>;
  return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />0</span>;
}

function fmtBRL(n: number) {
  if (!n) return "R$ 0";
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

export default function Relatorios() {
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Relatorio | null>(null);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRelatorios();
  }, []);

  async function fetchRelatorios() {
    setLoading(true);
    const { data } = await supabase
      .from("relatorios_semanais")
      .select("*")
      .order("semana_inicio", { ascending: false })
      .limit(20);
    setRelatorios(data || []);
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.functions.invoke("generate-weekly-report", {
        body: { user_id: user?.id },
      });
      if (error) throw error;
      toast({ title: "Relatório gerado com sucesso!" });
      await fetchRelatorios();
    } catch (err: any) {
      toast({ title: "Erro ao gerar relatório", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  function formatSemana(inicio: string, fim: string) {
    const i = new Date(inicio + "T12:00:00");
    const f = new Date(fim + "T12:00:00");
    return `${format(i, "dd/MM", { locale: ptBR })} — ${format(f, "dd/MM/yyyy", { locale: ptBR })}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // --- Detail view ---
  if (selected) {
    const m = selected.metadata || {};
    const kpis = [
      { icon: Users, label: "Novos Leads", value: selected.total_leads_abordados, sub: m.variacao_leads !== undefined ? `${m.variacao_leads > 0 ? "+" : ""}${m.variacao_leads}% vs semana ant.` : undefined, alert: false },
      { icon: CalendarCheck, label: "Visitas Realizadas", value: m.visitas_realizadas ?? selected.total_avancaram ?? 0, sub: undefined, alert: false },
      { icon: FileSignature, label: "Contratos Assinados", value: m.contratos_assinados ?? 0, sub: undefined, alert: false },
      { icon: DollarSign, label: "Comissão Estimada", value: fmtBRL(m.comissao_estimada ?? 0), sub: `${fmtBRL(m.vgv_fechado ?? 0)} recebida`, alert: false },
      { icon: Home, label: "Imóveis Disponíveis", value: m.imoveis_disponiveis ?? 0, sub: undefined, alert: false },
      { icon: BarChart2, label: "Lead → Visita", value: `${m.taxa_visita ?? 0}%`, sub: undefined, alert: false },
      { icon: TrendingUp, label: "Visita → Proposta", value: `${m.taxa_proposta ?? 0}%`, sub: undefined, alert: false },
      { icon: MapPin, label: "Proposta → Fechamento", value: `${m.taxa_fechamento ?? selected.taxa_conversao ?? 0}%`, sub: undefined, alert: false },
    ];

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Semana {formatSemana(selected.semana_inicio, selected.semana_fim)}</h1>
            <p className="text-xs text-muted-foreground">
              Gerado em {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ icon: Icon, label, value, sub }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="p-4 space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" /> {label}
                </p>
                <p className="text-2xl font-bold">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Top Bairros & Tipos */}
        {(m.top_bairros || m.top_tipos) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {m.top_bairros && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bairros Mais Procurados</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-foreground">{m.top_bairros}</p>
                </CardContent>
              </Card>
            )}
            {m.top_tipos && (
              <Card className="bg-card border-border">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipos Mais Procurados</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-foreground">{m.top_tipos}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Full Report */}
        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <ScrollArea className="max-h-[calc(100vh-480px)]">
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="text-base font-bold mt-5 mb-2 text-foreground">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>,
                    p: ({ children }) => <p className="text-sm text-foreground/90 mb-2 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-foreground/90">{children}</ul>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-sm text-foreground/70 italic">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {selected.relatorio_completo}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- List view ---
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios Semanais</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance imobiliária gerada por IA — performance, demanda e scripts
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Gerando..." : "Gerar Relatório"}
        </Button>
      </div>

      <ConversaoVisitas />

      {relatorios.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-10 text-center">
            <BarChart2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum relatório gerado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clique em "Gerar Relatório" ou aguarde o envio automático de domingo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {relatorios.map((r, idx) => {
            const anterior = relatorios[idx + 1];
            const m = r.metadata || {};
            const varLeads = m.variacao_leads;
            return (
              <Card
                key={r.id}
                className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelected(r)}
              >
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">
                      Semana {formatSemana(r.semana_inicio, r.semana_fim)}
                    </CardTitle>
                    {varLeads !== undefined ? (
                      varLeads > 0
                        ? <Badge className="bg-green-500/20 text-green-600 border-green-500/20 text-[10px]">
                            <TrendingUp className="h-2.5 w-2.5 mr-1" />+{varLeads}% leads
                          </Badge>
                        : varLeads < 0
                        ? <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-[10px]">
                            <TrendingDown className="h-2.5 w-2.5 mr-1" />{varLeads}% leads
                          </Badge>
                        : <Badge variant="outline" className="text-[10px]">Estável</Badge>
                    ) : anterior ? (
                      r.total_leads_abordados > anterior.total_leads_abordados
                        ? <Badge className="bg-green-500/20 text-green-600 border-green-500/20 text-[10px]">
                            <TrendingUp className="h-2.5 w-2.5 mr-1" />Melhora
                          </Badge>
                        : r.total_leads_abordados < anterior.total_leads_abordados
                        ? <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-[10px]">
                            <TrendingDown className="h-2.5 w-2.5 mr-1" />Queda
                          </Badge>
                        : <Badge variant="outline" className="text-[10px]">Estável</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground line-clamp-2">{r.resumo_executivo}</p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{r.total_leads_abordados}</span> leads
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{m.visitas_realizadas ?? r.total_avancaram ?? 0}</span> visitas
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{m.contratos_assinados ?? 0}</span> contratos
                    </span>
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-green-500">{fmtBRL(m.comissao_estimada ?? 0)}</span> comissão
                    </span>
                    {m.top_bairros && (
                      <span className="text-muted-foreground hidden sm:inline">
                        <MapPin className="h-3 w-3 inline mr-0.5" />{m.top_bairros.split(",")[0]}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConversaoVisitas — standalone section shown in the list view
// ---------------------------------------------------------------------------

type FiltroCV = "mes" | "3meses" | "ano" | "tudo";

interface VisitaRow {
  id: string;
  lead_id: string | null;
  corretor_id: string | null;
  corretor_nome?: string | null;
  data_visita: string;
}

interface ContratoRow {
  id: string;
  lead_id: string | null;
}

interface CorretorStat {
  nome: string;
  visitas: number;
  contratos: number;
  taxa: number;
}

const PIE_COLORS = ["#22c55e", "#ef4444"];

function ConversaoVisitas() {
  const [filtro, setFiltro] = useState<FiltroCV>("mes");
  const [loading, setLoading] = useState(true);
  const [totalVisitas, setTotalVisitas] = useState(0);
  const [visitasComContrato, setVisitasComContrato] = useState(0);
  const [corretores, setCorretores] = useState<CorretorStat[]>([]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      let dataInicio: string | null = null;
      if (filtro === "mes") {
        dataInicio = format(startOfMonth(now), "yyyy-MM-dd");
      } else if (filtro === "3meses") {
        dataInicio = format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd");
      } else if (filtro === "ano") {
        dataInicio = format(startOfYear(now), "yyyy-MM-dd");
      }

      // Fetch visitas realizadas
      let visitasQuery = supabase
        .from("agenda_visitas")
        .select("id, lead_id, corretor_id, corretor_nome, data_visita")
        .eq("user_id", user.id)
        .eq("status", "realizada");
      if (dataInicio) visitasQuery = visitasQuery.gte("data_visita", dataInicio);
      const { data: visitasData } = await visitasQuery;
      const visitas: VisitaRow[] = visitasData || [];

      // Fetch contratos
      let contratosQuery = supabase
        .from("contratos")
        .select("id, lead_id")
        .eq("user_id", user.id);
      if (dataInicio) contratosQuery = contratosQuery.gte("created_at", dataInicio);
      const { data: contratosData } = await contratosQuery;
      const contratos: ContratoRow[] = contratosData || [];

      const contratoLeadIds = new Set(
        contratos.map((c) => c.lead_id).filter(Boolean) as string[]
      );

      // KPIs
      const comContrato = visitas.filter(
        (v) => v.lead_id && contratoLeadIds.has(v.lead_id)
      ).length;
      setTotalVisitas(visitas.length);
      setVisitasComContrato(comContrato);

      // Ranking por corretor
      const map = new Map<string, { nome: string; visitas: number; contratos: number }>();
      for (const v of visitas) {
        const key = v.corretor_id ?? "sem_corretor";
        const nome = v.corretor_nome ?? v.corretor_id ?? "Sem corretor";
        if (!map.has(key)) map.set(key, { nome, visitas: 0, contratos: 0 });
        const entry = map.get(key)!;
        entry.visitas += 1;
        if (v.lead_id && contratoLeadIds.has(v.lead_id)) entry.contratos += 1;
      }
      const ranking: CorretorStat[] = Array.from(map.values())
        .map((e) => ({
          nome: e.nome,
          visitas: e.visitas,
          contratos: e.contratos,
          taxa: e.visitas > 0 ? parseFloat(((e.contratos / e.visitas) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.taxa - a.taxa);
      setCorretores(ranking);
    } finally {
      setLoading(false);
    }
  }

  const visitasSemContrato = totalVisitas - visitasComContrato;
  const taxaConversao = totalVisitas > 0
    ? ((visitasComContrato / totalVisitas) * 100).toFixed(1)
    : "0.0";

  const pieData = [
    { name: "Convertidas", value: visitasComContrato },
    { name: "Não Convertidas", value: visitasSemContrato },
  ];

  const filtros: { key: FiltroCV; label: string }[] = [
    { key: "mes", label: "Este Mês" },
    { key: "3meses", label: "3 Meses" },
    { key: "ano", label: "Este Ano" },
    { key: "tudo", label: "Tudo" },
  ];

  const kpis = [
    { label: "Total Visitas Realizadas", value: totalVisitas, color: "text-foreground" },
    { label: "Geraram Contrato", value: visitasComContrato, color: "text-green-500" },
    { label: "Não Converteram", value: visitasSemContrato, color: "text-destructive" },
    { label: "Taxa de Conversão", value: `${taxaConversao}%`, color: "text-primary" },
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Conversão de Visitas
          </CardTitle>
          <div className="flex gap-1">
            {filtros.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filtro === f.key ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setFiltro(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {kpis.map(({ label, value, color }) => (
                <Card key={label} className="bg-muted/30 border-border">
                  <CardContent className="p-3 space-y-0.5">
                    <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Chart + Table */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pie chart */}
              <div className="flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Distribuição</p>
                {totalVisitas === 0 ? (
                  <p className="text-xs text-muted-foreground py-6">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <RechartsPie>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value, "Visitas"]} />
                    </RechartsPie>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Ranking table */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Ranking por Corretor</p>
                {corretores.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6">Sem dados no período</p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left pb-1.5 font-medium">Corretor</th>
                          <th className="text-right pb-1.5 font-medium">Visitas</th>
                          <th className="text-right pb-1.5 font-medium">Contratos</th>
                          <th className="text-right pb-1.5 font-medium">Taxa %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {corretores.map((c) => (
                          <tr key={c.nome} className="border-b border-border/40 last:border-0">
                            <td className="py-1.5 font-medium truncate max-w-[100px]">{c.nome}</td>
                            <td className="py-1.5 text-right">{c.visitas}</td>
                            <td className="py-1.5 text-right text-green-500">{c.contratos}</td>
                            <td className="py-1.5 text-right font-semibold text-primary">{c.taxa}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
