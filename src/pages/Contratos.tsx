import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Plus, FileText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import ContratoDrawer from "@/components/contratos/ContratoDrawer";
import type { Tables } from "@/integrations/supabase/types";

type Contrato = Tables<"contratos">;

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ativo": return "bg-success/20 text-success";
    case "encerrado": return "bg-muted text-muted-foreground";
    case "pendente_assinatura": return "bg-warning/20 text-warning";
    default: return "bg-muted text-muted-foreground";
  }
}

const TIPO_SERVICO_LABELS: Record<string, string> = {
  agente_ia: "Agente IA",
  automacao: "Automação",
  sistema: "Sistema",
  manutencao: "Manutenção",
};

export default function Contratos() {
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoOpen, setNovoOpen] = useState(false);
  const [drawerContrato, setDrawerContrato] = useState<Contrato | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();

  // Form state
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [tipoServico, setTipoServico] = useState("agente_ia");
  const [valorTotal, setValorTotal] = useState("");
  const [numParcelas, setNumParcelas] = useState("1");
  const [valorEntrada, setValorEntrada] = useState("");
  const [valorRecorrencia, setValorRecorrencia] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchContratos();
  }, []);

  async function fetchContratos() {
    setLoading(true);
    const { data } = await supabase.from("contratos").select("*").order("criado_em", { ascending: false });
    setContratos(data || []);
    setLoading(false);
  }

  function resetForm() {
    setClienteNome(""); setClienteEmail(""); setClienteTelefone("");
    setTipoServico("agente_ia"); setValorTotal(""); setNumParcelas("1");
    setValorEntrada(""); setValorRecorrencia(""); setDiaVencimento("10");
    setPdfFile(null);
  }

  async function handleSalvar() {
    if (!clienteNome || !valorTotal) {
      toast({ title: "Preencha nome do cliente e valor total", variant: "destructive" });
      return;
    }
    setSaving(true);

    let pdfUrl: string | null = null;

    // Upload PDF if provided
    if (pdfFile) {
      const fileName = `${Date.now()}_${pdfFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("contratos-pdf")
        .upload(fileName, pdfFile);
      if (uploadError) {
        toast({ title: "Erro ao enviar PDF", description: uploadError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
      pdfUrl = fileName;
    }

    // Create contract
    const { data: contrato, error } = await supabase.from("contratos").insert({
      cliente_nome: clienteNome.trim(),
      cliente_email: clienteEmail.trim() || null,
      cliente_telefone: clienteTelefone.trim() || null,
      tipo_servico: tipoServico,
      valor_total: parseFloat(valorTotal),
      status: "pendente_assinatura",
      pdf_url: pdfUrl,
    }).select().maybeSingle();

    if (error || !contrato) {
      toast({ title: "Erro ao criar contrato", description: error?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Generate parcelas
    const total = parseFloat(valorTotal);
    const entrada = parseFloat(valorEntrada) || 0;
    const parcelas = parseInt(numParcelas) || 1;
    const valorRestante = total - entrada;
    const valorParcela = parcelas > 0 ? valorRestante / parcelas : 0;

    const parcelasInsert = [];

    if (entrada > 0) {
      parcelasInsert.push({
        contrato_id: contrato.id,
        descricao: "Entrada",
        valor: entrada,
        data_vencimento: format(new Date(), "yyyy-MM-dd"),
        status: "pendente",
      });
    }

    for (let i = 0; i < parcelas; i++) {
      parcelasInsert.push({
        contrato_id: contrato.id,
        descricao: `Parcela ${i + 1}/${parcelas}`,
        valor: Math.round(valorParcela * 100) / 100,
        data_vencimento: format(addMonths(new Date(), i + 1), "yyyy-MM-dd"),
        status: "pendente",
      });
    }

    if (parcelasInsert.length > 0) {
      await supabase.from("parcelas").insert(parcelasInsert);
    }

    // Create recorrencia if specified
    const recorrencia = parseFloat(valorRecorrencia);
    if (recorrencia > 0) {
      await supabase.from("recorrencias").insert({
        contrato_id: contrato.id,
        valor_mensal: recorrencia,
        dia_vencimento: parseInt(diaVencimento) || 10,
        ativo: true,
      });
    }

    toast({ title: "Contrato criado com sucesso!" });
    setNovoOpen(false);
    resetForm();
    fetchContratos();
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contratos</h1>
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground gap-1.5">
              <Plus className="h-4 w-4" /> Novo Contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Contrato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* PDF Upload */}
              <div className="space-y-2">
                <Label>PDF do Contrato (opcional)</Label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-4 hover:border-primary/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {pdfFile ? pdfFile.name : "Clique para enviar PDF"}
                      </span>
                    </div>
                    <input type="file" accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <Separator />

              {/* Client info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Cliente *</Label>
                  <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)} placeholder="email@cliente.com" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={clienteTelefone} onChange={e => setClienteTelefone(e.target.value)} placeholder="(11) 99999-0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo de Serviço</Label>
                  <Select value={tipoServico} onValueChange={setTipoServico}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agente_ia">Agente IA</SelectItem>
                      <SelectItem value="automacao">Automação</SelectItem>
                      <SelectItem value="sistema">Sistema</SelectItem>
                      <SelectItem value="manutencao">Manutenção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Financial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor Total *</Label>
                  <Input type="number" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="5000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor da Entrada</Label>
                  <Input type="number" value={valorEntrada} onChange={e => setValorEntrada(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Número de Parcelas</Label>
                  <Input type="number" value={numParcelas} onChange={e => setNumParcelas(e.target.value)} placeholder="3" min="1" />
                </div>
              </div>

              <Separator />

              {/* Recurrence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Recorrência Mensal (R$)</Label>
                  <Input type="number" value={valorRecorrencia} onChange={e => setValorRecorrencia(e.target.value)} placeholder="0 = sem recorrência" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Dia do Vencimento</Label>
                  <Input type="number" value={diaVencimento} onChange={e => setDiaVencimento(e.target.value)} placeholder="10" min="1" max="31" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
                <Button onClick={handleSalvar} disabled={saving} className="gradient-primary text-primary-foreground">
                  {saving ? "Salvando..." : "Salvar Contrato"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contracts list */}
      {contratos.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nenhum contrato cadastrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Contrato" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {contratos.map(c => (
            <Card
              key={c.id}
              className="glass-card cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => { setDrawerContrato(c); setDrawerOpen(true); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold truncate">{c.cliente_nome}</p>
                      <Badge className={`text-[10px] ${getStatusBadge(c.status)}`}>
                        {c.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{TIPO_SERVICO_LABELS[c.tipo_servico] || c.tipo_servico}</span>
                      <span>{formatCurrency(Number(c.valor_total))}</span>
                      <span>{format(new Date(c.criado_em), "dd/MM/yyyy")}</span>
                    </div>
                  </div>
                  {c.pdf_url && <FileText className="h-4 w-4 text-primary flex-shrink-0" />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ContratoDrawer
        contrato={drawerContrato}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdate={fetchContratos}
      />
    </div>
  );
}
