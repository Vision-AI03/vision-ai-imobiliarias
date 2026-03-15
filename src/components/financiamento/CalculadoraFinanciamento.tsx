import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calculator, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";

interface Props {
  valorImovelInicial?: number;
  compact?: boolean; // modo compacto para drawer
}

interface Parcela {
  numero: number;
  saldo: number;
  amortizacao: number;
  juros: number;
  prestacao: number;
}

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

export function CalculadoraFinanciamento({ valorImovelInicial, compact = false }: Props) {
  const initialValor = valorImovelInicial
    ? (valorImovelInicial / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    : "";

  const [valorStr, setValorStr] = useState(initialValor);
  const [entradaStr, setEntradaStr] = useState("");
  const [prazo, setPrazo] = useState("360");
  const [taxa, setTaxa] = useState("10,5");
  const [sistema, setSistema] = useState<"price" | "sac">("price");
  const [showTabela, setShowTabela] = useState(false);

  const resultado = useMemo(() => {
    const valorImovel = parseBRL(valorStr) * 100; // stored as cents internally? No — just parse as float
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

    return {
      valorReal,
      entrada,
      financiado,
      n,
      iMensal,
      primeira,
      ultima,
      totalPago,
      totalJuros,
      cet,
      percentEntrada,
      parcelas,
    };
  }, [valorStr, entradaStr, prazo, taxa, sistema]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Calculadora de Financiamento</h4>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Valor do Imóvel (R$)</Label>
          <Input
            className="h-8 text-sm"
            placeholder="0,00"
            value={valorStr}
            onChange={e => setValorStr(maskBRL(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Entrada (R$)</Label>
          <Input
            className="h-8 text-sm"
            placeholder="0,00"
            value={entradaStr}
            onChange={e => setEntradaStr(maskBRL(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Prazo (meses)</Label>
          <Input
            className="h-8 text-sm"
            type="number"
            min={12}
            max={420}
            value={prazo}
            onChange={e => setPrazo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Taxa de Juros (% a.a.)</Label>
          <Input
            className="h-8 text-sm"
            placeholder="10,5"
            value={taxa}
            onChange={e => setTaxa(e.target.value)}
          />
        </div>
      </div>

      {/* Sistema tabs */}
      <Tabs value={sistema} onValueChange={v => setSistema(v as "price" | "sac")}>
        <TabsList className="w-full h-8">
          <TabsTrigger value="price" className="flex-1 text-xs h-7">Tabela Price</TabsTrigger>
          <TabsTrigger value="sac" className="flex-1 text-xs h-7">SAC</TabsTrigger>
        </TabsList>
        <TabsContent value="price" className="mt-1">
          <p className="text-[11px] text-muted-foreground">
            Parcelas fixas durante todo o período. Juros maiores no início.
          </p>
        </TabsContent>
        <TabsContent value="sac" className="mt-1">
          <p className="text-[11px] text-muted-foreground">
            Amortização constante. Parcela maior no início, reduz ao longo do tempo.
          </p>
        </TabsContent>
      </Tabs>

      {/* Resultado */}
      {resultado && (
        <div className="space-y-3">
          <Separator />

          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-0.5">
                {sistema === "price" ? "Parcela Fixa" : "1ª Parcela"}
              </p>
              <p className="text-lg font-bold text-primary">
                {fmtBRL(resultado.primeira.prestacao)}
              </p>
            </div>
            {sistema === "sac" && (
              <div className="bg-green-500/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Última Parcela</p>
                <p className="text-lg font-bold text-green-500">
                  {fmtBRL(resultado.ultima.prestacao)}
                </p>
              </div>
            )}
            {sistema === "price" && (
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-muted-foreground mb-0.5">Valor Financiado</p>
                <p className="text-lg font-bold">
                  {fmtBRL(resultado.financiado)}
                </p>
              </div>
            )}
          </div>

          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Row label="Entrada" value={fmtBRL(resultado.entrada)} sub={`${resultado.percentEntrada.toFixed(0)}% do valor`} />
            <Row label="Prazo" value={`${resultado.n} meses`} sub={`${(resultado.n / 12).toFixed(0)} anos`} />
            <Row label="Total Juros" value={fmtBRL(resultado.totalJuros)} className="text-destructive" />
            <Row label="Total Pago" value={fmtBRL(resultado.totalPago)} />
            <Row
              label="Custo Efetivo Total"
              value={`${resultado.cet.toFixed(1)}%`}
              sub="acima do valor do imóvel"
              className="text-amber-500"
            />
            <Row
              label="Tx. Mensal"
              value={`${(resultado.iMensal * 100).toFixed(4)}%`}
              sub="equivalente mensal"
            />
          </div>

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
                    <tr
                      key={p.numero}
                      className={`border-t ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                    >
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
      )}

      {!resultado && (
        <div className="text-center py-6 text-muted-foreground text-xs">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Preencha o valor do imóvel e a entrada para simular o financiamento.
        </div>
      )}
    </div>
  );
}

function Row({
  label, value, sub, className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={`font-semibold ${className || ""}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
