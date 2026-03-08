import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tarefa } from "@/pages/Tarefas";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa: Tarefa | null;
  onSaved: () => void;
}

export function TarefaDialog({ open, onOpenChange, tarefa, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [status, setStatus] = useState("a_fazer");
  const [dataVencimento, setDataVencimento] = useState("");
  const [leadId, setLeadId] = useState("");
  const [contratoId, setContratoId] = useState("");

  const [leads, setLeads] = useState<{ id: string; nome: string }[]>([]);
  const [contratos, setContratos] = useState<{ id: string; cliente_nome: string }[]>([]);

  useEffect(() => {
    if (open) {
      // Fetch leads & contratos for selects
      supabase.from("leads").select("id, nome").order("nome").then(({ data }) => setLeads(data || []));
      supabase.from("contratos").select("id, cliente_nome").order("cliente_nome").then(({ data }) => setContratos(data || []));

      if (tarefa) {
        setTitulo(tarefa.titulo);
        setDescricao(tarefa.descricao || "");
        setPrioridade(tarefa.prioridade);
        setStatus(tarefa.status);
        setDataVencimento(tarefa.data_vencimento || "");
        setLeadId(tarefa.lead_id || "");
        setContratoId(tarefa.contrato_id || "");
      } else {
        setTitulo("");
        setDescricao("");
        setPrioridade("media");
        setStatus("a_fazer");
        setDataVencimento("");
        setLeadId("");
        setContratoId("");
      }
    }
  }, [open, tarefa]);

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    const payload = {
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      prioridade,
      status,
      concluida: status === "feito",
      data_vencimento: dataVencimento || null,
      lead_id: leadId || null,
      contrato_id: contratoId || null,
      user_id: user.user.id,
    };

    if (tarefa) {
      await supabase.from("tarefas").update(payload).eq("id", tarefa.id);
      toast({ title: "Tarefa atualizada" });
    } else {
      await supabase.from("tarefas").insert(payload);
      toast({ title: "Tarefa criada" });
    }

    setSaving(false);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tarefa ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Enviar proposta para cliente" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da tarefa..." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_fazer">A Fazer</SelectItem>
                  <SelectItem value="fazendo">Fazendo</SelectItem>
                  <SelectItem value="feito">Feito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Data de Vencimento</Label>
            <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vincular a Lead</Label>
              <Select value={leadId || "none"} onValueChange={(v) => setLeadId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Vincular a Contrato</Label>
              <Select value={contratoId || "none"} onValueChange={(v) => setContratoId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {contratos.map(c => <SelectItem key={c.id} value={c.id}>{c.cliente_nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Salvando..." : tarefa ? "Atualizar" : "Criar Tarefa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
