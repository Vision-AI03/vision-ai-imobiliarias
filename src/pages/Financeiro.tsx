import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { DollarSign, TrendingUp, TrendingDown, Plus, Trash2, BarChart3, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Contrato = Tables<"contratos">;
type Parcela = Tables<"parcelas">;
type Recorrencia = Tables<"recorrencias">;
type Custo = Tables<"custos">;

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const CATEGORIA_LABELS: Record<string, string> = {
  vps: "VPS", api: "API", token: "Token", ferramenta: "Ferramenta", outro: "Outro",
};

export default function Financeiro() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [custos, setCustos] = useState<Custo[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoCustoOpen, setNovoCustoOpen] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [mrrData, setMrrData] = useState<any[]>([]);
  const { toast } = useToast();

  // Cost form
  const [custoNome, setCustoNome] = useState("");
  const [custoCategoria, setCustoCategoria] = useState("outro");
  const [custoValor, setCustoValor] = useState("");
  const [custoRenovacao, setCustoRenovacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [cRes, pRes, rRes, custRes] = await Promise.all([
      supabase.from("contratos").select("*").order("criado_em", { ascending: false }),
      supabase.from("parcelas").select("*, contratos(cliente_nome)").order("data_vencimento"),
      supabase.from("recorrencias").select("*, contratos(cliente_nome)"),
      supabase.from("custos").select("*").order("criado_em", { ascending: false }),
    ]);
    setContratos(cRes.data || []);
    setParcelas(pRes.data || []);
    setRecorrencias(rRes.data || []);
    setCustos(custRes.data || []);

    // Build 6-month chart data
    await buildChartData(pRes.data || [], rRes.data || [], custRes.data || []);
    setLoading(false);
  }

  async function buildChartData(allParcelas: any[], allRecorrencias: any[], allCustos: Custo[]) {
    const now = new Date();
    const mrrAtivo = allRecorrencias.filter((r: Recorrencia) => r.ativo).reduce((s: number, r: Recorrencia) => s + Number(r.valor_mensal), 0);
    const totalCustos = allCustos.filter(c => c.ativo).reduce((s, c) => s + Number(c.valor_mensal), 0);

    const monthly: any[] = [];
    const mrr: any[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const mStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const mEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
      const label = format(monthDate, "MMM yy", { locale: ptBR });

      const devPagas = allParcelas.filter((p: Parcela) =>
        p.status === "pago" && p.data_pagamento && p.data_pagamento >= mStart && p.data_pagamento <= mEnd
      );
      const dev = devPagas.reduce((s: number, p: Parcela) => s + Number(p.valor), 0);

      monthly.push({
        mes: label,
        desenvolvimento: dev,
        recorrente: mrrAtivo,
        custos: totalCustos,
        margem: dev + mrrAtivo - totalCustos,
      });

      mrr.push({ mes: label, mrr: mrrAtivo });
    }

    setMonthlyData(monthly);
    setMrrData(mrr);
  }

  async function handleSalvarCusto() {
    if (!custoNome || !custoValor) {
      toast({ title: "Preencha nome e valor", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("custos").insert({
      nome: custoNome.trim(),
      categoria: custoCategoria,
      valor_mensal: parseFloat(custoValor),
      data_renovacao: custoRenovacao || null,
      ativo: true,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Custo cadastrado!" });
      setNovoCustoOpen(false);
      setCustoNome(""); setCustoValor(""); setCustoRenovacao(""); setCustoCategoria("outro");
      fetchAll();
    }
    setSaving(false);
  }

  async function toggleCusto(id: string, ativo: boolean) {
    await supabase.from("custos").update({ ativo }).eq("id", id);
    fetchAll();
  }

  // Calculations
  const now = new Date();
  const mesAtualStart = format(startOfMonth(now), "yyyy-MM-dd");
  const mesAtualEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const parcelasPagasMes = parcelas.filter((p: any) => p.status === "pago" && p.data_pagamento && p.data_pagamento >= mesAtualStart && p.data_pagamento <= mesAtualEnd);
  const receitaDev = parcelasPagasMes.reduce((s, p) => s + Number(p.valor), 0);
  const mrrAtual = recorrencias.filter(r => r.ativo).reduce((s, r) => s + Number(r.valor_mensal), 0);
  const totalCustosMes = custos.filter(c => c.ativo).reduce((s, c) => s + Number(c.valor_mensal), 0);
  const receitaTotal = receitaDev + mrrAtual;
  const margemLiquida = receitaTotal - totalCustosMes;
  const margemPct = receitaTotal > 0 ? Math.round((margemLiquida / receitaTotal) * 100) : 0;

  // Dev projects with payment progress
  const projetosDev = contratos.map(c => {
    const parcelasContrato = parcelas.filter((p: any) => p.contrato_id === c.id);
    const recebido = parcelasContrato.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
    const pendente = parcelasContrato.filter((p: any) => p.status !== "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
    return { ...c, recebido, pendente };
  });

  const contratosChurn = contratos.filter(c => c.status === "encerrado").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Financeiro</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<DollarSign className="h-5 w-5" />} title="Receita Total" value={formatCurrency(receitaTotal)} subtitle={`Dev: ${formatCurrency(receitaDev)} + MRR: ${formatCurrency(mrrAtual)}`} accent="text-primary" />
        <SummaryCard icon={<TrendingDown className="h-5 w-5" />} title="Custos do Mês" value={formatCurrency(totalCustosMes)} subtitle={`${custos.filter(c => c.ativo).length} custos ativos`} accent="text-destructive" />
        <SummaryCard icon={margemLiquida >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />} title="Margem Líquida" value={formatCurrency(margemLiquida)} subtitle={`${margemPct}% da receita`} accent={margemLiquida >= 0 ? "text-success" : "text-destructive"} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5" />} title="MRR Atual" value={formatCurrency(mrrAtual)} subtitle={`${recorrencias.filter(r => r.ativo).length} contratos ativos`} accent="text-accent" />
      </div>

      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="resumo" className="gap-1.5"><BarChart3 className="h-4 w-4" />Resumo</TabsTrigger>
          <TabsTrigger value="desenvolvimento" className="gap-1.5"><DollarSign className="h-4 w-4" />Desenvolvimento</TabsTrigger>
          <TabsTrigger value="mrr" className="gap-1.5"><TrendingUp className="h-4 w-4" />MRR</TabsTrigger>
          <TabsTrigger value="custos" className="gap-1.5"><TrendingDown className="h-4 w-4" />Custos Fixos</TabsTrigger>
        </TabsList>

        {/* RESUMO TAB */}
        <TabsContent value="resumo" className="space-y-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm">Comparativo — Últimos 6 Meses</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ color: "hsl(0 0% 55%)" }} />
                  <Bar dataKey="desenvolvimento" name="Desenvolvimento" fill="hsl(252 100% 64%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="recorrente" name="Recorrente" fill="hsl(187 100% 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="custos" name="Custos" fill="hsl(0 72% 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm">Margem Líquida — Últimos 6 Meses</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="margem" name="Margem" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 71% 45%)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DESENVOLVIMENTO TAB */}
        <TabsContent value="desenvolvimento" className="space-y-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm">Receita de Desenvolvimento por Mês</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="desenvolvimento" name="Desenvolvimento" fill="url(#gradDev)" radius={[4, 4, 0, 0]} />
                  <defs>
                    <linearGradient id="gradDev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(252 100% 64%)" />
                      <stop offset="100%" stopColor="hsl(187 100% 50%)" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {projetosDev.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum projeto cadastrado.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {projetosDev.map(p => (
                <Card key={p.id} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">{p.cliente_nome}</p>
                      <span className="text-sm font-bold">{formatCurrency(Number(p.valor_total))}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2 mb-2">
                      <div
                        className="h-2 rounded-full gradient-primary transition-all"
                        style={{ width: `${Number(p.valor_total) > 0 ? Math.min((p.recebido / Number(p.valor_total)) * 100, 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Recebido: {formatCurrency(p.recebido)}</span>
                      <span>Pendente: {formatCurrency(p.pendente)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* MRR TAB */}
        <TabsContent value="mrr" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">MRR Atual</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-accent">{formatCurrency(mrrAtual)}</p></CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Contratos Ativos</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{recorrencias.filter(r => r.ativo).length}</p></CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Churn</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-destructive">{contratosChurn}</p></CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm">Evolução do MRR</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mrrData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 14%)" />
                  <XAxis dataKey="mes" tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(0 0% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", borderRadius: "8px", color: "hsl(0 0% 95%)" }} formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="mrr" name="MRR" stroke="hsl(187 100% 50%)" strokeWidth={2} dot={{ fill: "hsl(187 100% 50%)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {recorrencias.length > 0 && (
            <div className="grid gap-3">
              {recorrencias.map((r: any) => (
                <Card key={r.id} className="glass-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{r.contratos?.cliente_nome || "—"}</p>
                      <p className="text-xs text-muted-foreground">Dia {r.dia_vencimento} — {formatCurrency(Number(r.valor_mensal))}/mês</p>
                    </div>
                    <Badge className={r.ativo ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}>
                      {r.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CUSTOS TAB */}
        <TabsContent value="custos" className="space-y-4">
          <div className="flex items-center justify-between">
            <Card className="glass-card flex-1 mr-4">
              <CardContent className="p-4 flex items-center gap-3">
                <TrendingDown className="h-6 w-6 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground">Total de Custos Mensais</p>
                  <p className="text-xl font-bold text-destructive">{formatCurrency(totalCustosMes)}</p>
                </div>
              </CardContent>
            </Card>
            <Dialog open={novoCustoOpen} onOpenChange={setNovoCustoOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Custo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card border-border">
                <DialogHeader><DialogTitle>Novo Custo Fixo</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome *</Label>
                    <Input value={custoNome} onChange={e => setCustoNome(e.target.value)} placeholder="Ex: Servidor VPS" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={custoCategoria} onValueChange={setCustoCategoria}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vps">VPS</SelectItem>
                          <SelectItem value="api">API</SelectItem>
                          <SelectItem value="token">Token</SelectItem>
                          <SelectItem value="ferramenta">Ferramenta</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Mensal *</Label>
                      <Input type="number" value={custoValor} onChange={e => setCustoValor(e.target.value)} placeholder="99.90" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data de Renovação</Label>
                    <Input type="date" value={custoRenovacao} onChange={e => setCustoRenovacao(e.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setNovoCustoOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSalvarCusto} disabled={saving} className="gradient-primary text-primary-foreground">
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {custos.length === 0 ? (
            <Card className="glass-card"><CardContent className="py-8 text-center text-muted-foreground text-sm">Nenhum custo cadastrado.</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {custos.map(c => (
                <Card key={c.id} className="glass-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch checked={c.ativo} onCheckedChange={v => toggleCusto(c.id, v)} />
                      <div>
                        <p className={`font-semibold ${!c.ativo ? "line-through text-muted-foreground" : ""}`}>{c.nome}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">{CATEGORIA_LABELS[c.categoria] || c.categoria}</Badge>
                          {c.data_renovacao && <span>Renova: {format(new Date(c.data_renovacao + "T00:00:00"), "dd/MM/yyyy")}</span>}
                        </div>
                      </div>
                    </div>
                    <p className={`font-bold ${c.ativo ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatCurrency(Number(c.valor_mensal))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ icon, title, value, subtitle, accent }: { icon: React.ReactNode; title: string; value: string; subtitle: string; accent: string }) {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={accent}>{icon}</span>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
        <p className={`text-xl font-bold ${accent}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  );
}
