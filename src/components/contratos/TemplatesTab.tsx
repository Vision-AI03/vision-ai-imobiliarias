import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Pencil, Trash2, FileCode } from "lucide-react";
import { format } from "date-fns";

const TIPOS_TEMPLATE = [
  { value: "venda_sistema", label: "Venda de Sistema" },
  { value: "assinatura_agentes", label: "Assinatura + Setup de Agentes IA" },
  { value: "consultoria", label: "Consultoria" },
  { value: "outro", label: "Outro" },
];

const DEFAULT_TEMPLATES = [
  {
    nome: "Contrato de Venda de Sistema",
    tipo: "venda_sistema",
    conteudo_template: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE DESENVOLVIMENTO DE SISTEMA

CONTRATANTE: {{nome_cliente}}
CNPJ/CPF: {{cnpj}}
Endereço: {{endereco}}
Email: {{email_cliente}}
Telefone: {{telefone_cliente}}

CONTRATADA: Vision AI Tecnologia LTDA

1. OBJETO
A CONTRATADA se compromete a desenvolver e entregar o seguinte sistema:
{{descricao_servico}}

2. VALOR E PAGAMENTO
Valor total: {{valor_total}}
Forma de pagamento: {{parcelas}}
{{detalhes_pagamento}}

3. PRAZO
Data de início: {{data_inicio}}
Prazo de entrega: {{prazo_entrega}}

4. GARANTIA E SUPORTE
A CONTRATADA oferece garantia de {{prazo_garantia}} meses após a entrega, incluindo correção de bugs e ajustes menores.

5. PROPRIEDADE INTELECTUAL
O código-fonte e a propriedade intelectual do sistema serão transferidos ao CONTRATANTE após a quitação total do contrato.

6. RESCISÃO
Em caso de rescisão antecipada por qualquer das partes, deverá haver comunicação prévia de 30 dias, sendo devidos os valores proporcionais aos serviços já realizados.

{{clausulas_adicionais}}

Local e data: _____________, {{data_assinatura}}

___________________________
CONTRATANTE: {{nome_cliente}}

___________________________
CONTRATADA: Vision AI Tecnologia LTDA`,
    placeholders: ["nome_cliente", "cnpj", "endereco", "email_cliente", "telefone_cliente", "descricao_servico", "valor_total", "parcelas", "detalhes_pagamento", "data_inicio", "prazo_entrega", "prazo_garantia", "clausulas_adicionais", "data_assinatura"],
  },
  {
    nome: "Contrato de Assinatura + Setup de Agentes IA",
    tipo: "assinatura_agentes",
    conteudo_template: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE IA COM ASSINATURA MENSAL

CONTRATANTE: {{nome_cliente}}
CNPJ/CPF: {{cnpj}}
Endereço: {{endereco}}
Email: {{email_cliente}}
Telefone: {{telefone_cliente}}

CONTRATADA: Vision AI Tecnologia LTDA

1. OBJETO
A CONTRATADA se compromete a configurar e manter agentes de inteligência artificial para o CONTRATANTE, incluindo:
{{descricao_servico}}

2. VALOR DO SETUP (IMPLANTAÇÃO)
Valor do setup: {{valor_setup}}
Forma de pagamento do setup: {{parcelas_setup}}

3. ASSINATURA MENSAL
Valor mensal: {{valor_mensal}}
Dia de vencimento: {{dia_vencimento}}
O pagamento mensal inclui: manutenção dos agentes, atualizações, suporte técnico e monitoramento.

4. VIGÊNCIA
Data de início: {{data_inicio}}
Prazo mínimo de contrato: {{prazo_minimo}} meses
Após o prazo mínimo, o contrato renova automaticamente por períodos iguais, podendo ser cancelado com aviso prévio de 30 dias.

5. SLA (ACORDO DE NÍVEL DE SERVIÇO)
- Disponibilidade: 99,5% uptime
- Tempo de resposta para suporte: até 4 horas úteis
- Correção de bugs críticos: até 24 horas

6. RESCISÃO
Em caso de rescisão antes do prazo mínimo, o CONTRATANTE deverá pagar multa de {{multa_rescisao}}% do valor restante do prazo mínimo.

{{clausulas_adicionais}}

Local e data: _____________, {{data_assinatura}}

___________________________
CONTRATANTE: {{nome_cliente}}

___________________________
CONTRATADA: Vision AI Tecnologia LTDA`,
    placeholders: ["nome_cliente", "cnpj", "endereco", "email_cliente", "telefone_cliente", "descricao_servico", "valor_setup", "parcelas_setup", "valor_mensal", "dia_vencimento", "data_inicio", "prazo_minimo", "multa_rescisao", "clausulas_adicionais", "data_assinatura"],
  },
];

interface Template {
  id: string;
  nome: string;
  tipo: string;
  conteudo_template: string;
  placeholders: any;
  ativo: boolean;
  created_at: string;
}

interface TemplatesTabProps {
  templates: Template[];
  onRefresh: () => void;
}

export default function TemplatesTab({ templates, onRefresh }: TemplatesTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("venda_sistema");
  const [conteudo, setConteudo] = useState("");

  function resetForm() {
    setNome(""); setTipo("venda_sistema"); setConteudo(""); setEditId(null);
  }

  function openEdit(t: Template) {
    setEditId(t.id);
    setNome(t.nome);
    setTipo(t.tipo);
    setConteudo(t.conteudo_template);
    setDialogOpen(true);
  }

  async function seedDefaults() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    for (const t of DEFAULT_TEMPLATES) {
      await supabase.from("contrato_templates").insert({
        user_id: user.id,
        nome: t.nome,
        tipo: t.tipo,
        conteudo_template: t.conteudo_template,
        placeholders: t.placeholders,
      } as any);
    }
    toast({ title: "Templates padrão criados!" });
    onRefresh();
  }

  async function handleSave() {
    if (!nome.trim() || !conteudo.trim()) {
      toast({ title: "Preencha nome e conteúdo do template", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Extract placeholders from content
    const matches = conteudo.match(/\{\{(\w+)\}\}/g) || [];
    const placeholders = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))];

    const payload: any = {
      user_id: user.id,
      nome: nome.trim(),
      tipo,
      conteudo_template: conteudo,
      placeholders,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("contrato_templates").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("contrato_templates").insert(payload));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editId ? "Template atualizado" : "Template criado" });
      setDialogOpen(false);
      resetForm();
      onRefresh();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("contrato_templates").delete().eq("id", deleteId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Template excluído" });
      onRefresh();
    }
    setDeleteId(null);
  }

  // Highlight placeholders in content preview
  function highlightPlaceholders(text: string) {
    return text.replace(/\{\{(\w+)\}\}/g, '<span class="text-primary font-semibold">{{$1}}</span>');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Modelos base para gerar contratos com IA.</p>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={seedDefaults}>
              <FileCode className="h-4 w-4 mr-2" />Criar Templates Padrão
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar Template" : "Novo Template"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Contrato de..." />
                  </div>
                  <div>
                    <Label>Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_TEMPLATE.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Conteúdo do Template *</Label>
                  <p className="text-xs text-muted-foreground mb-1">Use {"{{placeholder}}"} para campos dinâmicos</p>
                  <Textarea
                    value={conteudo}
                    onChange={e => setConteudo(e.target.value)}
                    placeholder="CONTRATO DE PRESTAÇÃO DE SERVIÇOS..."
                    rows={20}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                <Button onClick={handleSave}>{editId ? "Salvar" : "Criar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-40" />
            <p>Nenhum template cadastrado.</p>
            <p className="text-xs mt-1">Clique em "Criar Templates Padrão" para começar com 2 modelos prontos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map(t => (
            <Card key={t.id} className="glass-card">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{t.nome}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {TIPOS_TEMPLATE.find(x => x.value === t.tipo)?.label || t.tipo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "dd/MM/yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="bg-muted/50 rounded p-3 max-h-32 overflow-y-auto">
                  <pre
                    className="text-xs whitespace-pre-wrap font-mono"
                    dangerouslySetInnerHTML={{ __html: highlightPlaceholders(t.conteudo_template.slice(0, 500) + (t.conteudo_template.length > 500 ? "..." : "")) }}
                  />
                </div>
                {Array.isArray(t.placeholders) && t.placeholders.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(t.placeholders as string[]).slice(0, 8).map(p => (
                      <Badge key={p} variant="secondary" className="text-[10px]">{`{{${p}}}`}</Badge>
                    ))}
                    {(t.placeholders as string[]).length > 8 && (
                      <Badge variant="secondary" className="text-[10px]">+{(t.placeholders as string[]).length - 8}</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
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
