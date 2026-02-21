import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Check, Clock, AlertTriangle, FileText, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Contrato = Tables<"contratos">;
type Parcela = Tables<"parcelas">;
type Recorrencia = Tables<"recorrencias">;

function getStatusBadge(status: string) {
  switch (status) {
    case "ativo": return "bg-success/20 text-success";
    case "encerrado": return "bg-muted text-muted-foreground";
    case "pendente_assinatura": return "bg-warning/20 text-warning";
    default: return "bg-muted text-muted-foreground";
  }
}

function getParcelaIcon(status: string) {
  switch (status) {
    case "pago": return <Check className="h-4 w-4 text-success" />;
    case "vencido": return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default: return <Clock className="h-4 w-4 text-warning" />;
  }
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const TIPO_SERVICO_LABELS: Record<string, string> = {
  agente_ia: "Agente IA",
  automacao: "Automação",
  sistema: "Sistema",
  manutencao: "Manutenção",
};

interface ContratoDrawerProps {
  contrato: Contrato | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ContratoDrawer({ contrato, open, onClose, onUpdate }: ContratoDrawerProps) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (contrato) fetchDetails(contrato.id);
  }, [contrato]);

  async function fetchDetails(contratoId: string) {
    setLoading(true);
    const [pRes, rRes] = await Promise.all([
      supabase.from("parcelas").select("*").eq("contrato_id", contratoId).order("data_vencimento"),
      supabase.from("recorrencias").select("*").eq("contrato_id", contratoId),
    ]);
    setParcelas(pRes.data || []);
    setRecorrencias(rRes.data || []);
    setLoading(false);
  }

  async function confirmarPagamento(parcelaId: string) {
    await supabase.from("parcelas").update({
      status: "pago",
      data_pagamento: format(new Date(), "yyyy-MM-dd"),
    }).eq("id", parcelaId);
    toast({ title: "Pagamento confirmado!" });
    if (contrato) fetchDetails(contrato.id);
    onUpdate();
  }

  if (!contrato) return null;

  const totalPago = parcelas.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);
  const totalPendente = parcelas.filter(p => p.status !== "pago").reduce((s, p) => s + Number(p.valor), 0);
  const mrrAtivo = recorrencias.filter(r => r.ativo).reduce((s, r) => s + Number(r.valor_mensal), 0);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-5">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-lg">{contrato.cliente_nome}</SheetTitle>
                <Badge className={getStatusBadge(contrato.status)}>{contrato.status.replace("_", " ")}</Badge>
              </div>
            </SheetHeader>

            {/* Contract info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dados do Contrato</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-secondary/30 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">Tipo de Serviço</p>
                  <p className="font-medium">{TIPO_SERVICO_LABELS[contrato.tipo_servico] || contrato.tipo_servico}</p>
                </div>
                <div className="bg-secondary/30 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">Valor Total</p>
                  <p className="font-medium">{formatCurrency(Number(contrato.valor_total))}</p>
                </div>
                <div className="bg-secondary/30 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">Email</p>
                  <p className="font-medium truncate">{contrato.cliente_email || "—"}</p>
                </div>
                <div className="bg-secondary/30 rounded p-2">
                  <p className="text-[10px] text-muted-foreground">Telefone</p>
                  <p className="font-medium">{contrato.cliente_telefone || "—"}</p>
                </div>
              </div>
            </div>

            {/* Financial summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-success/10 rounded-lg p-3 text-center">
                <DollarSign className="h-4 w-4 text-success mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Recebido</p>
                <p className="text-sm font-bold text-success">{formatCurrency(totalPago)}</p>
              </div>
              <div className="bg-warning/10 rounded-lg p-3 text-center">
                <Clock className="h-4 w-4 text-warning mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">Pendente</p>
                <p className="text-sm font-bold text-warning">{formatCurrency(totalPendente)}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <FileText className="h-4 w-4 text-primary mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">MRR</p>
                <p className="text-sm font-bold text-primary">{formatCurrency(mrrAtivo)}</p>
              </div>
            </div>

            <Separator />

            {/* Payment timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Timeline de Pagamentos</h4>
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : parcelas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma parcela cadastrada.</p>
              ) : (
                <div className="space-y-2">
                  {parcelas.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-secondary/20 rounded-lg p-3">
                      {getParcelaIcon(p.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{formatCurrency(Number(p.valor))}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Vence: {format(new Date(p.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}
                          {p.data_pagamento && ` — Pago: ${format(new Date(p.data_pagamento + "T00:00:00"), "dd/MM/yyyy")}`}
                        </p>
                        {p.descricao && <p className="text-[10px] text-muted-foreground">{p.descricao}</p>}
                      </div>
                      {p.status === "pendente" && (
                        <Button size="sm" variant="outline" className="text-xs border-success/30 text-success hover:bg-success/10" onClick={() => confirmarPagamento(p.id)}>
                          Confirmar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {recorrencias.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Recorrências</h4>
                  {recorrencias.map(r => (
                    <div key={r.id} className="flex items-center justify-between bg-secondary/20 rounded-lg p-3 text-sm">
                      <div>
                        <p className="font-medium">{formatCurrency(Number(r.valor_mensal))}/mês</p>
                        <p className="text-[10px] text-muted-foreground">Dia de vencimento: {r.dia_vencimento}</p>
                      </div>
                      <Badge className={r.ativo ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}>
                        {r.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
