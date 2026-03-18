import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, ChevronDown, ChevronUp, TrendingUp, X, Plus, Printer, ArrowLeftRight } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

interface Props {
  valorImovelInicial?: number;
  compact?: boolean;
}

interface Parcela {
  numero: number;
  saldo: number;
  amortizacao: number;
  juros: number;
  prestacao: number;
}

interface ImovelItem {
  id: string;
  titulo: string | null;
  tipo: string;
  valor_venda: number | null;
  bairro: string | null;
}

interface ColComparacao {
  id: string;
  imovelId: string;
  valorStr: string;
  entradaStr: string;
  prazo: string;
  taxa: string;
  sistema: "price" | "sac";
}

// ── Pure calculation helpers ──

function calcSAC(pv: number, n: number, iMensal: number): Parcela[] {
  const amort = pv / n;
  const parcelas: Parcela[] = [];
  let saldo = pv;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * iMensal;
    const prestacao = amort + juros;
    saldo -= amort;
    parcelas.push({ numero: k, saldo: Math.max(saldo, 0), amortizacao: amort, juros, prestacao });
  }
  return parcelas;
}

function calcPrice(pv: number, n: number, iMensal: number): Parcela[] {
  const pmt = iMensal === 0 ? pv / n : (pv * iMensal) / (1 - Math.pow(1 + iMensal, -n));
  const parcelas: Parcela[] = [];
  let saldo = pv;
  for (let k = 1; k <= n; k++) {
    const juros = saldo * iMensal;
    const amort = pmt - juros;
    saldo -= amort;
    parcelas.push({ numero: k, saldo: Math.max(saldo, 0), amortizacao: amort, juros, prestacao: pmt });
  }
  return parcelas;
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

function parseBRL(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

function maskBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valorToMask(valor: number): string {
  return maskBRL(String(Math.round(valor * 100)));
}

function computeResultado(
  valorStr: string,
  entradaStr: string,
  prazo: string,
  taxa: string,
  sistema: "price" | "sac"
) {
  const valorReal = parseBRL(valorStr);
  const entrada = parseBRL(entradaStr);
  const n = parseInt(prazo, 10);
  const taxaAnual = parseFloat(taxa.replace(",", ".")) / 100;
  const iMensal = Math.pow(1 + taxaAnual, 1 / 12) - 1;
  const financiado = Math.max(valorReal - entrada, 0);
  if (!financiado || !n || !taxaAnual) return null;

  const parcelas = sistema === "sac"
    ? calcSAC(financiado, n, iMensal)
    : calcPrice(financiado, n, iMensal);

  const totalPago = parcelas.reduce((s, p) => s + p.prestacao, 0) + entrada;
  const totalJuros = parcelas.reduce((s, p) => s + p.juros, 0);
  const primeira = parcelas[0];
  const ultima = parcelas[parcelas.length - 1];
  const cet = ((totalPago / valorReal) - 1) * 100;
  const percentEntrada = entrada > 0 ? (entrada / valorReal) * 100 : 0;

  return { valorReal, entrada, financiado, n, iMensal, primeira, ultima, totalPago, totalJuros, cet, percentEntrada, parcelas };
}

const LETRAS = ["A", "B", "C"];

// ── Main component ──

export function CalculadoraFinanciamento({ valorImovelInicial, compact = false }: Props) {
  const initialValor = valorImovelInicial ? valorToMask(valorImovelInicial) : "";
  const initialEntrada = valorImovelInicial ? valorToMask(valorImovelInicial * 0.2) : "";

  // Simple mode
  const [valorStr, setValorStr] = useState(initialValor);
  const [entradaStr, setEntradaStr] = useState(initialEntrada);
  const [prazo, setPrazo] = useState("360");
  const [taxa, setTaxa] = useState("10,5");
  const [sistema, setSistema] = useState<"price" | "sac">("price");
  const [showTabela, setShowTabela] = useState(false);

  // Imovel selector
  const [imoveis, setImoveis] = useState<ImovelItem[]>([]);
  const [selectedImovelId, setSelectedImovelId] = useState("");

  // Comparison mode
  const [modoComparacao, setModoComparacao] = useState(false);
  const [colunas, setColunas] = useState<ColComparacao[]>([
    { id: "A", imovelId: "", valorStr: "", entradaStr: "", prazo: "360", taxa: "10,5", sistema: "price" },
    { id: "B", imovelId: "", valorStr: "", entradaStr: "", prazo: "360", taxa: "10,5", sistema: "price" },
  ]);

  useEffect(() => {
    if (compact) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase
        .from("imoveis")
        .select("id, titulo, tipo, valor_venda, bairro")
        .eq("user_id", session.user.id)
        .not("valor_venda", "is", null)
        .order("created_at", { ascending: false })
        .limit(100)
        .then(({ data }) => setImoveis((data as ImovelItem[]) || []));
    });
  }, [compact]);

  const handleSelectImovel = (imovelId: string) => {
    setSelectedImovelId(imovelId);
    if (!imovelId) { setValorStr(""); setEntradaStr(""); return; }
    const imovel = imoveis.find(i => i.id === imovelId);
    if (!imovel?.valor_venda) return;
    setValorStr(valorToMask(imovel.valor_venda));
    setEntradaStr(valorToMask(imovel.valor_venda * 0.2));
  };

  const handleSelectImovelCol = (colId: string, imovelId: string) => {
    const imovel = imoveis.find(i => i.id === imovelId);
    const vStr = imovel?.valor_venda ? valorToMask(imovel.valor_venda) : "";
    const eStr = imovel?.valor_venda ? valorToMask(imovel.valor_venda * 0.2) : "";
    setColunas(prev => prev.map(c => c.id === colId ? { ...c, imovelId, valorStr: vStr, entradaStr: eStr } : c));
  };

  const updateCol = (colId: string, field: Partial<ColComparacao>) =>
    setColunas(prev => prev.map(c => c.id === colId ? { ...c, ...field } : c));

  const addColuna = () => {
    if (colunas.length >= 3) return;
    const letra = LETRAS[colunas.length];
    setColunas(prev => [...prev, { id: letra, imovelId: "", valorStr: "", entradaStr: "", prazo: "360", taxa: "10,5", sistema: "price" }]);
  };

  const removeColuna = (colId: string) =>
    setColunas(prev => prev.filter(c => c.id !== colId));

  const resultado = useMemo(
    () => computeResultado(valorStr, entradaStr, prazo, taxa, sistema),
    [valorStr, entradaStr, prazo, taxa, sistema]
  );

  const resultadosColunas = useMemo(
    () => colunas.map(col => ({ col, resultado: computeResultado(col.valorStr, col.entradaStr, col.prazo, col.taxa, col.sistema) })),
    [colunas]
  );

  const minCustoTotal = useMemo(() => {
    const vals = resultadosColunas.map(r => r.resultado?.totalPago).filter((v): v is number => v != null && v > 0);
    return vals.length > 1 ? Math.min(...vals) : -1;
  }, [resultadosColunas]);

  const minPrimeiraParcela = useMemo(() => {
    const vals = resultadosColunas.map(r => r.resultado?.primeira.prestacao).filter((v): v is number => v != null && v > 0);
    return vals.length > 1 ? Math.min(...vals) : -1;
  }, [resultadosColunas]);

  return (
    <div className="space-y-4">
      {/* Header */}
      {!compact ? (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Calculadora de Financiamento</h4>
          </div>
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            <button
              onClick={() => setModoComparacao(false)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${!modoComparacao ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              Simulação Simples
            </button>
            <button
              onClick={() => setModoComparacao(true)}
              className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${modoComparacao ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ArrowLeftRight className="h-3 w-3" />
              Comparar Imóveis
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Calculadora de Financiamento</h4>
        </div>
      )}

      {/* ══════════════ MODO SIMPLES ══════════════ */}
      {!modoComparacao && (
        <>
          {/* Seletor de imóvel */}
          {!compact && imoveis.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Imóvel (opcional)</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedImovelId || "__none__"}
                  onValueChange={v => handleSelectImovel(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Selecione um imóvel para pré-preencher..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Preenchimento manual</SelectItem>
                    {imoveis.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.titulo || `${i.tipo}${i.bairro ? ` — ${i.bairro}` : ""}`} — {fmtBRL(i.valor_venda!)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedImovelId && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleSelectImovel("")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Valor do Imóvel (R$)</Label>
              <Input className="h-8 text-sm" placeholder="0,00" value={valorStr} onChange={e => setValorStr(maskBRL(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Entrada (R$)</Label>
              <Input className="h-8 text-sm" placeholder="0,00" value={entradaStr} onChange={e => setEntradaStr(maskBRL(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Prazo (meses)</Label>
              <Input className="h-8 text-sm" type="number" min={12} max={420} value={prazo} onChange={e => setPrazo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Taxa de Juros (% a.a.)</Label>
              <Input className="h-8 text-sm" placeholder="10,5" value={taxa} onChange={e => setTaxa(e.target.value)} />
            </div>
          </div>

          {/* Sistema */}
          <Tabs value={sistema} onValueChange={v => setSistema(v as "price" | "sac")}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="price" className="flex-1 text-xs h-7">Tabela Price</TabsTrigger>
              <TabsTrigger value="sac" className="flex-1 text-xs h-7">SAC</TabsTrigger>
            </TabsList>
            <TabsContent value="price" className="mt-1">
              <p className="text-[11px] text-muted-foreground">Parcelas fixas durante todo o período. Juros maiores no início.</p>
            </TabsContent>
            <TabsContent value="sac" className="mt-1">
              <p className="text-[11px] text-muted-foreground">Amortização constante. Parcela maior no início, reduz ao longo do tempo.</p>
            </TabsContent>
          </Tabs>

          {/* Resultado */}
          {resultado ? (
            <div className="space-y-3">
              <Separator />

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-primary/10 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{sistema === "price" ? "Parcela Fixa" : "1ª Parcela"}</p>
                  <p className="text-lg font-bold text-primary">{fmtBRL(resultado.primeira.prestacao)}</p>
                </div>
                {sistema === "sac" ? (
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Última Parcela</p>
                    <p className="text-lg font-bold text-green-500">{fmtBRL(resultado.ultima.prestacao)}</p>
                  </div>
                ) : (
                  <div className="bg-secondary/50 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Valor Financiado</p>
                    <p className="text-lg font-bold">{fmtBRL(resultado.financiado)}</p>
                  </div>
                )}
              </div>

              {/* Detalhes */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Row label="Entrada" value={fmtBRL(resultado.entrada)} sub={`${resultado.percentEntrada.toFixed(0)}% do valor`} />
                <Row label="Prazo" value={`${resultado.n} meses`} sub={`${(resultado.n / 12).toFixed(0)} anos`} />
                <Row label="Total Juros" value={fmtBRL(resultado.totalJuros)} className="text-destructive" />
                <Row label="Total Pago" value={fmtBRL(resultado.totalPago)} />
                <Row label="Custo Efetivo Total" value={`${resultado.cet.toFixed(1)}%`} sub="acima do valor do imóvel" className="text-amber-500" />
                <Row label="Tx. Mensal" value={`${(resultado.iMensal * 100).toFixed(4)}%`} sub="equivalente mensal" />
              </div>

              {/* Gráfico de pizza — full page only */}
              {!compact && (
                <>
                  <Separator />
                  <p className="text-xs font-medium text-muted-foreground">Composição do custo total</p>
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={100} height={100}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Valor do imóvel", value: resultado.valorReal },
                            { name: "Total de juros", value: resultado.totalJuros },
                          ]}
                          cx="50%" cy="50%"
                          innerRadius={24} outerRadius={46}
                          dataKey="value"
                          strokeWidth={2}
                        >
                          <Cell fill="hsl(252 100% 64%)" />
                          <Cell fill="hsl(0 72% 51%)" />
                        </Pie>
                        <RechartsTooltip
                          formatter={(v: unknown) => fmtBRL(v as number)}
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 text-xs flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "hsl(252 100% 64%)" }} />
                          Valor do imóvel
                        </span>
                        <span className="font-semibold">{fmtBRL(resultado.valorReal)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "hsl(0 72% 51%)" }} />
                          Total de juros
                        </span>
                        <span className="font-semibold text-destructive">{fmtBRL(resultado.totalJuros)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1 border-t">
                        <span className="text-muted-foreground">Custo total</span>
                        <span className="font-bold">{fmtBRL(resultado.totalPago)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Linha do tempo — full page only */}
              {!compact && (
                <>
                  <Separator />
                  <p className="text-xs font-medium text-muted-foreground">
                    Linha do tempo — quitação em <span className="text-foreground font-bold">{(resultado.n / 12).toFixed(0)} anos</span>
                  </p>
                  <div className="bg-secondary/30 rounded-lg p-3 space-y-2.5">
                    {([0.25, 0.5, 0.75, 1] as const).map(frac => {
                      const mesIdx = Math.min(Math.round(resultado.n * frac) - 1, resultado.parcelas.length - 1);
                      const saldo = resultado.parcelas[mesIdx]?.saldo ?? 0;
                      const paidOff = Math.min(((resultado.financiado - saldo) / resultado.financiado) * 100, 100);
                      const anos = (frac * resultado.n / 12).toFixed(frac < 1 ? 1 : 0);
                      const isDone = frac === 1;
                      return (
                        <div key={frac} className="space-y-0.5">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>{anos} anos</span>
                            <span className={isDone ? "text-emerald-500 font-semibold" : ""}>
                              {isDone ? "Imóvel quitado!" : `${paidOff.toFixed(0)}% do capital quitado`}
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${frac * 100}%`,
                                background: isDone ? "hsl(142 71% 45%)" : "hsl(252 100% 64%)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Tabela de amortização */}
              <button
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowTabela(!showTabela)}
              >
                {showTabela ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showTabela ? "Ocultar" : "Ver"} tabela de amortização
              </button>

              {showTabela && (
                <ScrollArea className="max-h-52 rounded border">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium">#</th>
                        <th className="px-2 py-1.5 text-right font-medium">Parcela</th>
                        <th className="px-2 py-1.5 text-right font-medium">Amortiz.</th>
                        <th className="px-2 py-1.5 text-right font-medium">Juros</th>
                        <th className="px-2 py-1.5 text-right font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.parcelas.map((p, idx) => (
                        <tr key={p.numero} className={`border-t ${idx % 2 === 0 ? "" : "bg-muted/20"}`}>
                          <td className="px-2 py-1 text-muted-foreground">{p.numero}</td>
                          <td className="px-2 py-1 text-right font-medium">{fmtBRL(p.prestacao)}</td>
                          <td className="px-2 py-1 text-right text-green-600">{fmtBRL(p.amortizacao)}</td>
                          <td className="px-2 py-1 text-right text-destructive/70">{fmtBRL(p.juros)}</td>
                          <td className="px-2 py-1 text-right text-muted-foreground">{fmtBRL(p.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Preencha o valor do imóvel e a entrada para simular o financiamento.
            </div>
          )}
        </>
      )}

      {/* ══════════════ MODO COMPARAÇÃO ══════════════ */}
      {modoComparacao && !compact && (
        <div className="space-y-6">
          {/* Colunas */}
          <div className={`grid gap-4 ${colunas.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}>
            {colunas.map(col => {
              const res = resultadosColunas.find(r => r.col.id === col.id)?.resultado;
              return (
                <Card key={col.id} className="glass-card">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-bold">Imóvel {col.id}</CardTitle>
                      {colunas.length > 2 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeColuna(col.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2.5">
                    {imoveis.length > 0 && (
                      <Select
                        value={col.imovelId || "__none__"}
                        onValueChange={v => handleSelectImovelCol(col.id, v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Selecionar imóvel..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Manual</SelectItem>
                          {imoveis.map(i => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.titulo || i.tipo} — {fmtBRL(i.valor_venda!)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                        <Input className="h-7 text-xs" placeholder="0,00" value={col.valorStr} onChange={e => updateCol(col.id, { valorStr: maskBRL(e.target.value) })} />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[10px] text-muted-foreground">Entrada (R$)</Label>
                        <Input className="h-7 text-xs" placeholder="0,00" value={col.entradaStr} onChange={e => updateCol(col.id, { entradaStr: maskBRL(e.target.value) })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Prazo (meses)</Label>
                        <Input className="h-7 text-xs" type="number" value={col.prazo} onChange={e => updateCol(col.id, { prazo: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Taxa % a.a.</Label>
                        <Input className="h-7 text-xs" value={col.taxa} onChange={e => updateCol(col.id, { taxa: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {(["price", "sac"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => updateCol(col.id, { sistema: s })}
                          className={`flex-1 text-[10px] py-1 rounded border transition-colors ${col.sistema === s ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                        >
                          {s === "price" ? "Price" : "SAC"}
                        </button>
                      ))}
                    </div>
                    {res && (
                      <div className="pt-2 border-t space-y-1.5">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">{col.sistema === "price" ? "Parcela fixa" : "1ª parcela"}</p>
                          <p className="text-base font-bold text-primary">{fmtBRL(res.primeira.prestacao)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                          <span className="text-muted-foreground">Total juros</span>
                          <span className="text-right font-medium text-destructive">{fmtBRL(res.totalJuros)}</span>
                          <span className="text-muted-foreground">Custo total</span>
                          <span className="text-right font-medium">{fmtBRL(res.totalPago)}</span>
                          <span className="text-muted-foreground">CET</span>
                          <span className="text-right text-amber-500">{res.cet.toFixed(1)}%</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {colunas.length < 3 && (
              <div className="flex items-center justify-center border-2 border-dashed border-border rounded-lg min-h-[200px]">
                <button
                  onClick={addColuna}
                  className="flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-xs">Adicionar imóvel</span>
                </button>
              </div>
            )}
          </div>

          {/* Tabela comparativa */}
          {resultadosColunas.some(r => r.resultado) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Comparativo</h4>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" />
                  Exportar PDF
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto">
                <table className="w-full text-xs min-w-[400px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Métrica</th>
                      {colunas.map(col => (
                        <th key={col.id} className="px-3 py-2 text-right font-semibold">
                          Imóvel {col.id}
                          {col.imovelId && (
                            <p className="text-[10px] font-normal text-muted-foreground truncate max-w-[120px] ml-auto">
                              {imoveis.find(i => i.id === col.imovelId)?.titulo ?? ""}
                            </p>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        { label: "Valor do Imóvel",   val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.valorReal) : "—" },
                        { label: "Entrada (20%)",      val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.entrada) : "—" },
                        { label: "Valor Financiado",   val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.financiado) : "—" },
                        { label: "Prazo",              val: (_r: ReturnType<typeof computeResultado>, col?: ColComparacao) => col ? `${col.prazo} meses` : "—", useCol: true },
                        { label: "Sistema",            val: (_r: ReturnType<typeof computeResultado>, col?: ColComparacao) => col ? (col.sistema === "price" ? "Price" : "SAC") : "—", useCol: true },
                        { label: "1ª Parcela",         val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.primeira.prestacao) : "—", minKey: "primeira" as const },
                        { label: "Última Parcela",     val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.ultima.prestacao) : "—" },
                        { label: "Total de Juros",     val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.totalJuros) : "—" },
                        { label: "Custo Total",        val: (r: ReturnType<typeof computeResultado>) => r ? fmtBRL(r.totalPago) : "—", minKey: "total" as const },
                      ] as const
                    ).map((row, ri) => (
                      <tr key={ri} className={`border-t ${ri % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-3 py-2 font-medium text-muted-foreground">{row.label}</td>
                        {resultadosColunas.map(({ col, resultado: r }) => {
                          const display = (row as { useCol?: boolean }).useCol ? row.val(r, col) : row.val(r);
                          const isGreen =
                            (row.minKey === "total" && r?.totalPago === minCustoTotal && minCustoTotal > 0) ||
                            (row.minKey === "primeira" && r?.primeira.prestacao === minPrimeiraParcela && minPrimeiraParcela > 0);
                          return (
                            <td key={col.id} className={`px-3 py-2 text-right font-medium ${isGreen ? "text-emerald-500 font-bold" : ""}`}>
                              {display}
                              {isGreen && <span className="ml-1 text-[9px]">✓</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground">✓ Verde indica o melhor valor na categoria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-semibold ${className || ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
