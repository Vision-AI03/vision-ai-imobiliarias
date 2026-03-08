import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Eye, Trash2 } from "lucide-react";
import { format } from "date-fns";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  assinado: "Assinado",
  ativo: "Ativo",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviado: "bg-warning/20 text-warning",
  assinado: "bg-success/20 text-success",
  ativo: "bg-primary/20 text-primary",
  cancelado: "bg-destructive/20 text-destructive",
};

interface ContratoGerado {
  id: string;
  nome_cliente: string;
  email_cliente: string | null;
  cnpj_cpf: string | null;
  conteudo_final: string;
  valor_total: number | null;
  numero_parcelas: number | null;
  tipo_pagamento: string | null;
  valor_recorrente: number | null;
  status: string;
  created_at: string;
  template_id: string | null;
}

interface Template {
  id: string;
  nome: string;
}

interface ContratosGeradosTabProps {
  contratos: ContratoGerado[];
  templates: Template[];
  onRefresh: () => void;
}

export default function ContratosGeradosTab({ contratos, templates, onRefresh }: ContratosGeradosTabProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [viewContrato, setViewContrato] = useState<ContratoGerado | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const templateMap = Object.fromEntries(templates.map(t => [t.id, t.nome]));

  const filtered = contratos.filter(c => {
    const matchSearch = !search.trim() || c.nome_cliente.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "todos" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("contratos_gerados").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Contrato excluído" });
      onRefresh();
    }
    setDeleteId(null);
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("contratos_gerados").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Status atualizado para ${STATUS_LABELS[status]}` });
      onRefresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="assinado">Assinado</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-40" />
            <p>Nenhum contrato gerado encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div>
                        {c.nome_cliente}
                        {c.cnpj_cpf && <span className="text-xs text-muted-foreground block">{c.cnpj_cpf}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.template_id ? templateMap[c.template_id] || "—" : "—"}
                    </TableCell>
                    <TableCell>
                      {c.valor_total ? formatCurrency(Number(c.valor_total)) : "—"}
                      {c.valor_recorrente && (
                        <span className="text-xs text-muted-foreground block">+{formatCurrency(Number(c.valor_recorrente))}/mês</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                        <SelectTrigger className="h-7 w-28 border-0 p-0">
                          <Badge className={STATUS_COLORS[c.status] || "bg-muted"}>
                            {STATUS_LABELS[c.status] || c.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{format(new Date(c.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewContrato(c)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* View dialog */}
      <Dialog open={!!viewContrato} onOpenChange={(open) => { if (!open) setViewContrato(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Contrato — {viewContrato?.nome_cliente}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh]">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed p-4">{viewContrato?.conteudo_final}</pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
