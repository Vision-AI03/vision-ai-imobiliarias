import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart2, TrendingUp, TrendingDown, Loader2, ChevronLeft,
  Sparkles, Users, Home, CalendarCheck, DollarSign, Copy, Printer,
} from "lucide-react";
import { format, subMonths, startOfMonth, subWeeks, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

type Periodo = "semana" | "mes" | "3meses";

interface KPIData {
  totalLeads: number;
  visitasRealizadas: number;
  contratosFechados: number;
  comissaoTotal: number;
  comissaoRecebida: number;
}

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

function fmtBRL(n: number) {
  if (!n) return "R$ 0";
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(0)}K`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

function getPeriodoRange(periodo: Periodo): { inicio: string; label: string } {
  const now = new Date();
  if (periodo === "semana") {
    const d = startOfWeek(now, { weekStartsOn: 1 });
    return { inicio: format(d, "yyyy-MM-dd"), label: "Esta semana" };
  }
  if (periodo === "mes") {
    return { inicio: format(startOfMonth(now), "yyyy-MM-dd"), label: "Este mês" };
  }
  return {
    inicio: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"),
    label: "Últimos 3 meses",
  };
}

function formatSemana(inicio: string, fim: string) {
  const i = new Date(inicio + "T12:00:00");
  const f = new Date(fim + "T12:00:00");
  return `${format(i, "dd/MM", { locale: ptBR })} — ${format(f, "dd/MM/yyyy", { locale: ptBR })}`;
}

export default function Relatorios() {
  const { toast } = useToast();

  // KPI state
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  // Report state
  const [relatorios, setRelatorios] = useState<Relatorio[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selected, setSelected] = useState<Relatorio | null>(null);
  const [generating, setGenerating] = useState(false);

  const fetchKPIs = useCallback(async () => {
    setKpiLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) { setKpiLoading(false); return; }
    const userId = session.user.id;
    const { inicio } = getPeriodoRange(periodo);

    const [leadsRes, visitasRes, comissoesRes, contratosRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("criado_em", inicio),
      supabase
        .from("agenda_visitas")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "realizada")
        .gte("data_visita", inicio),
      supabase
        .from("comissoes")
        .select("valor_comissao, status")
        .eq("user_id", userId)
        .gte("created_at", inicio),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "contrato_assinado")
        .gte("atualizado_em", inicio),
    ]);

    const comissoes = comissoesRes.data || [];
    const comissaoTotal = comissoes.reduce((s, c) => s + (c.valor_comissao || 0), 0);
    const comissaoRecebida = comissoes
      .filter(c => c.status === "recebida")
      .reduce((s, c) => s + (c.valor_comissao || 0), 0);

    setKpi({
      totalLeads: leadsRes.count ?? 0,
      visitasRealizadas: visitasRes.count ?? 0,
      contratosFechados: contratosRes.count ?? 0,
      comissaoTotal,
      comissaoRecebida,
    });
    setKpiLoading(false);
  }, [periodo]);

  const fetchRelatorios = useCallback(async () => {
    setListLoading(true);
    const { data } = await supabase
      .from("relatorios_semanais")
      .select("*")
      .order("semana_inicio", { ascending: false })
      .limit(20);
    setRelatorios((data as Relatorio[]) || []);
    setListLoading(false);
  }, []);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);
  useEffect(() => { fetchRelatorios(); }, [fetchRelatorios]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("generate-weekly-report", {
        body: { user_id: session?.user?.id, periodo },
      });
      if (error) throw error;
      toast({ title: "Relatório gerado com sucesso!" });
      const newId = data?.results?.[0]?.relatorio_id;
      await fetchRelatorios();
      if (newId) {
        const { data: novo } = await supabase
          .from("relatorios_semanais")
          .select("*")
          .eq("id", newId)
          .maybeSingle();
        if (novo) setSelected(novo as Relatorio);
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar relatório", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  function handleCopiar(text: string) {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copiado!" }));
  }

  function handleExportarPDF(r: Relatorio) {
    const w = window.open("", "_blank");
    if (!w) { toast({ title: "Permita popups para exportar PDF", variant: "destructive" }); return; }
    const semana = formatSemana(r.semana_inicio, r.semana_fim);
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Relatório ${semana}</title><style>body{font-family:Arial,sans-serif;padding:40px;font-size:12pt;line-height:1.6;}h2{font-size:14pt;margin-top:24px;}</style></head><body><h1>Relatório — ${semana}</h1><pre style="white-space:pre-wrap;font-family:inherit">${r.relatorio_completo.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
    w.document.close();
    w.print();
  }

  // --- Detail view ---
  if (selected) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold">
              Relatório — {formatSemana(selected.semana_inicio, selected.semana_fim)}
            </h1>
            <p className="text-xs text-muted-foreground">
              Gerado em {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleCopiar(selected.relatorio_completo)}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleExportarPDF(selected)}>
              <Printer className="h-3.5 w-3.5" /> Exportar PDF
            </Button>
          </div>
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-5">
            <ScrollArea className="max-h-[calc(100vh-280px)]">
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="text-base font-bold mt-5 mb-2 text-foreground border-b border-border pb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mt-4 mb-1.5 text-foreground">{children}</h3>,
                    p: ({ children }) => <p className="text-sm text-foreground/90 mb-2 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-foreground/90">{children}</ul>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
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
  const periodoLabel = getPeriodoRange(periodo).label;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          KPIs em tempo real e relatórios gerados por IA
        </p>
      </div>

      {/* ── SEÇÃO 1: Resumo do Período ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Resumo do Período</h2>
          <div className="flex gap-1">
            {(["semana", "mes", "3meses"] as Periodo[]).map(p => (
              <Button
                key={p}
                size="sm"
                variant={periodo === p ? "secondary" : "ghost"}
                className="text-xs h-7"
                onClick={() => setPeriodo(p)}
              >
                {p === "semana" ? "Esta semana" : p === "mes" ? "Este mês" : "3 meses"}
              </Button>
            ))}
          </div>
        </div>

        {kpiLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-card border-border animate-pulse">
                <CardContent className="p-4 h-16" />
              </Card>
            ))}
          </div>
        ) : kpi ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Novos Leads
                </p>
                <p className="text-2xl font-bold">{kpi.totalLeads}</p>
                <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarCheck className="h-3.5 w-3.5" /> Visitas Realizadas
                </p>
                <p className="text-2xl font-bold">{kpi.visitasRealizadas}</p>
                <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Home className="h-3.5 w-3.5" /> Contratos Fechados
                </p>
                <p className="text-2xl font-bold">{kpi.contratosFechados}</p>
                <p className="text-[10px] text-muted-foreground">{periodoLabel}</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4 space-y-0.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" /> Comissões
                </p>
                <p className="text-2xl font-bold text-emerald-500">{fmtBRL(kpi.comissaoRecebida)}</p>
                <p className="text-[10px] text-muted-foreground">{fmtBRL(kpi.comissaoTotal)} estimado</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      {/* ── SEÇÃO 2: Relatório Gerado por IA ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Relatório Gerado por IA</h2>
          <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? "Gerando..." : "Gerar Relatório"}
          </Button>
        </div>

        {listLoading ? (
          <Card className="bg-card border-border animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ) : relatorios.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-10 text-center">
              <BarChart2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum relatório gerado ainda.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique em "Gerar Relatório" para criar o primeiro relatório com IA.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
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
                  <CardHeader className="pb-1 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">
                        {formatSemana(r.semana_inicio, r.semana_fim)}
                      </CardTitle>
                      {varLeads !== undefined ? (
                        varLeads > 0
                          ? <Badge className="bg-green-500/20 text-green-600 border-green-500/20 text-[10px]"><TrendingUp className="h-2.5 w-2.5 mr-1" />+{varLeads}% leads</Badge>
                          : varLeads < 0
                          ? <Badge className="bg-destructive/20 text-destructive border-destructive/20 text-[10px]"><TrendingDown className="h-2.5 w-2.5 mr-1" />{varLeads}% leads</Badge>
                          : <Badge variant="outline" className="text-[10px]">Estável</Badge>
                      ) : anterior ? (
                        r.total_leads_abordados > anterior.total_leads_abordados
                          ? <Badge className="bg-green-500/20 text-green-600 border-green-500/20 text-[10px]"><TrendingUp className="h-2.5 w-2.5 mr-1" />Melhora</Badge>
                          : <Badge variant="outline" className="text-[10px]">Estável</Badge>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-3 space-y-2">
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.resumo_executivo}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span><span className="font-semibold text-foreground">{r.total_leads_abordados}</span> leads</span>
                      <span><span className="font-semibold text-foreground">{m.visitas_realizadas ?? r.total_avancaram ?? 0}</span> visitas</span>
                      <span><span className="font-semibold text-foreground">{m.contratos_assinados ?? 0}</span> contratos</span>
                      <span><span className="font-semibold text-green-500">{fmtBRL(m.comissao_estimada ?? 0)}</span> comissão</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
