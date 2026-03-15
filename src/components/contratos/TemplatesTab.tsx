import { useState } from "react";
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
  { value: "compra_venda", label: "Compra e Venda" },
  { value: "locacao_residencial", label: "Locação Residencial" },
  { value: "locacao_comercial", label: "Locação Comercial" },
  { value: "proposta_compra", label: "Proposta de Compra" },
  { value: "autorizacao_venda", label: "Autorização de Venda" },
  { value: "autorizacao_locacao", label: "Autorização de Locação" },
  { value: "recibo_sinal", label: "Recibo de Sinal / Arras" },
  { value: "outro", label: "Outro" },
];

const PLACEHOLDERS_PADRAO = [
  "nome_vendedor", "cpf_vendedor", "rg_vendedor",
  "nome_comprador", "cpf_comprador", "rg_comprador",
  "endereco_imovel", "matricula_imovel", "cartorio_registro",
  "valor_total", "valor_sinal", "valor_financiado",
  "prazo_entrega", "data_assinatura",
  "nome_imobiliaria", "cnpj_imobiliaria", "creci_imobiliaria",
  "nome_corretor", "creci_corretor",
  "percentual_comissao", "valor_comissao",
  "clausulas_especiais",
];

const DEFAULT_TEMPLATES = [
  {
    nome: "Contrato de Compra e Venda",
    tipo: "compra_venda",
    conteudo_template: `CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL

VENDEDOR(A): {{nome_vendedor}}
CPF/CNPJ: {{cpf_vendedor}}
RG: {{rg_vendedor}}

COMPRADOR(A): {{nome_comprador}}
CPF/CNPJ: {{cpf_comprador}}
RG: {{rg_comprador}}

IMOBILIÁRIA: {{nome_imobiliaria}}
CNPJ: {{cnpj_imobiliaria}}
CRECI: {{creci_imobiliaria}}
CORRETOR RESPONSÁVEL: {{nome_corretor}} — CRECI: {{creci_corretor}}

CLÁUSULA 1ª — DO OBJETO
O VENDEDOR é legítimo proprietário do imóvel situado em {{endereco_imovel}}, com matrícula nº {{matricula_imovel}} no {{cartorio_registro}}.

CLÁUSULA 2ª — DO PREÇO E FORMA DE PAGAMENTO
O preço total da compra e venda é de {{valor_total}}, a ser pago da seguinte forma:
— Sinal/Arras: {{valor_sinal}}, pago neste ato;
— Financiamento: {{valor_financiado}};
— Demais condições: {{condicoes_pagamento}}.

CLÁUSULA 3ª — DA ENTREGA
A entrega das chaves e a lavratura da escritura definitiva ocorrerão até {{prazo_entrega}}.

CLÁUSULA 4ª — DA COMISSÃO DE CORRETAGEM
A comissão de corretagem é de {{percentual_comissao}}% sobre o valor total, correspondendo a {{valor_comissao}}, devida à {{nome_imobiliaria}}.

CLÁUSULA 5ª — DAS DISPOSIÇÕES ESPECIAIS
{{clausulas_especiais}}

Local e data: _____________, {{data_assinatura}}

_________________________________
VENDEDOR(A): {{nome_vendedor}}

_________________________________
COMPRADOR(A): {{nome_comprador}}

_________________________________
IMOBILIÁRIA: {{nome_imobiliaria}}`,
    placeholders: PLACEHOLDERS_PADRAO,
  },
  {
    nome: "Contrato de Locação Residencial",
    tipo: "locacao_residencial",
    conteudo_template: `CONTRATO DE LOCAÇÃO RESIDENCIAL

LOCADOR(A): {{nome_vendedor}}
CPF/CNPJ: {{cpf_vendedor}}

LOCATÁRIO(A): {{nome_comprador}}
CPF/CNPJ: {{cpf_comprador}}
RG: {{rg_comprador}}

IMOBILIÁRIA ADMINISTRADORA: {{nome_imobiliaria}}
CRECI: {{creci_imobiliaria}}
CORRETOR: {{nome_corretor}} — CRECI: {{creci_corretor}}

CLÁUSULA 1ª — DO IMÓVEL
O LOCADOR cede ao LOCATÁRIO, para uso exclusivamente residencial, o imóvel situado em {{endereco_imovel}}, matrícula nº {{matricula_imovel}}.

CLÁUSULA 2ª — DO PRAZO
O prazo de locação é de {{prazo_locacao}} meses, iniciando-se em {{data_inicio}} e encerrando-se em {{data_termino}}.

CLÁUSULA 3ª — DO ALUGUEL
O aluguel mensal é de {{valor_total}}, a ser pago até o dia {{dia_vencimento}} de cada mês.

CLÁUSULA 4ª — DA GARANTIA LOCATÍCIA
{{tipo_garantia}}: {{dados_garantia}}.

CLÁUSULA 5ª — DA COMISSÃO
A taxa de administração é de {{percentual_comissao}}% sobre o aluguel mensal, devida à {{nome_imobiliaria}}.

CLÁUSULA 6ª — DISPOSIÇÕES ESPECIAIS
{{clausulas_especiais}}

Local e data: _____________, {{data_assinatura}}

_________________________________
LOCADOR(A): {{nome_vendedor}}

_________________________________
LOCATÁRIO(A): {{nome_comprador}}

_________________________________
IMOBILIÁRIA: {{nome_imobiliaria}}`,
    placeholders: [...PLACEHOLDERS_PADRAO, "prazo_locacao", "data_inicio", "data_termino", "dia_vencimento", "tipo_garantia", "dados_garantia"],
  },
  {
    nome: "Proposta de Compra",
    tipo: "proposta_compra",
    conteudo_template: `PROPOSTA DE COMPRA DE IMÓVEL

DATA: {{data_assinatura}}

PROPONENTE COMPRADOR(A): {{nome_comprador}}
CPF: {{cpf_comprador}}
Telefone: {{telefone_comprador}}

IMÓVEL PRETENDIDO: {{endereco_imovel}}
Matrícula: {{matricula_imovel}}

VALOR PROPOSTO: {{valor_total}}
FORMA DE PAGAMENTO:
— Entrada/Sinal: {{valor_sinal}}
— Financiamento: {{valor_financiado}}
— Condições: {{condicoes_pagamento}}

PRAZO DE VALIDADE DESTA PROPOSTA: {{prazo_validade}} dias.

PRAZO PARA ASSINATURA DO CONTRATO DEFINITIVO: {{prazo_entrega}}.

CORRETOR RESPONSÁVEL: {{nome_corretor}} — CRECI: {{creci_corretor}}
IMOBILIÁRIA: {{nome_imobiliaria}} — CRECI: {{creci_imobiliaria}}
COMISSÃO: {{percentual_comissao}}% — {{valor_comissao}}

CONDIÇÕES ESPECIAIS:
{{clausulas_especiais}}

_________________________________
PROPONENTE: {{nome_comprador}}`,
    placeholders: [...PLACEHOLDERS_PADRAO, "telefone_comprador", "prazo_validade", "condicoes_pagamento"],
  },
  {
    nome: "Autorização de Venda (Captação)",
    tipo: "autorizacao_venda",
    conteudo_template: `AUTORIZAÇÃO DE VENDA DE IMÓVEL

PROPRIETÁRIO(A): {{nome_vendedor}}
CPF/CNPJ: {{cpf_vendedor}}
Telefone: {{telefone_proprietario}}

IMÓVEL: {{endereco_imovel}}
Matrícula: {{matricula_imovel}} — {{cartorio_registro}}

Por meio deste instrumento, o PROPRIETÁRIO autoriza a {{nome_imobiliaria}} (CRECI: {{creci_imobiliaria}}) a intermediar a VENDA do referido imóvel pelo preço de {{valor_total}}, pelo prazo de {{prazo_autorizacao}} dias.

COMISSÃO DE CORRETAGEM: {{percentual_comissao}}% sobre o valor de venda, a ser paga pelo vendedor na data da assinatura do contrato.

CORRETOR RESPONSÁVEL: {{nome_corretor}} — CRECI: {{creci_corretor}}

EXCLUSIVIDADE: {{exclusividade}}

{{clausulas_especiais}}

Local e data: _____________, {{data_assinatura}}

_________________________________
PROPRIETÁRIO(A): {{nome_vendedor}}

_________________________________
IMOBILIÁRIA: {{nome_imobiliaria}}`,
    placeholders: [...PLACEHOLDERS_PADRAO, "telefone_proprietario", "prazo_autorizacao", "exclusividade"],
  },
  {
    nome: "Recibo de Sinal / Arras",
    tipo: "recibo_sinal",
    conteudo_template: `RECIBO DE SINAL E PRINCÍPIO DE PAGAMENTO (ARRAS)

PAGADOR(A): {{nome_comprador}}
CPF: {{cpf_comprador}}

RECEBEDOR(A): {{nome_vendedor}}
CPF: {{cpf_vendedor}}

IMÓVEL: {{endereco_imovel}}
Matrícula: {{matricula_imovel}}

RECEBI a quantia de {{valor_sinal}}, a título de sinal e princípio de pagamento pela compra do imóvel acima descrito, pelo preço total de {{valor_total}}.

O valor do sinal será DEDUZIDO do preço total na assinatura do contrato definitivo.

Em caso de desistência:
— Por parte do COMPRADOR: perde o valor do sinal em favor do VENDEDOR;
— Por parte do VENDEDOR: devolve o sinal em DOBRO ao COMPRADOR.

Prazo para assinatura do contrato definitivo: {{prazo_entrega}}.

CORRETOR: {{nome_corretor}} — CRECI: {{creci_corretor}}
IMOBILIÁRIA: {{nome_imobiliaria}}

{{clausulas_especiais}}

Local e data: _____________, {{data_assinatura}}

_________________________________
VENDEDOR(A): {{nome_vendedor}}

_________________________________
COMPRADOR(A): {{nome_comprador}}`,
    placeholders: PLACEHOLDERS_PADRAO,
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
  const [tipo, setTipo] = useState("compra_venda");
  const [conteudo, setConteudo] = useState("");

  function resetForm() {
    setNome(""); setTipo("compra_venda"); setConteudo(""); setEditId(null);
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
    toast({ title: `${DEFAULT_TEMPLATES.length} templates imobiliários criados!` });
    onRefresh();
  }

  async function handleSave() {
    if (!nome.trim() || !conteudo.trim()) {
      toast({ title: "Preencha nome e conteúdo do template", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

  function highlightPlaceholders(text: string) {
    return text.replace(/\{\{(\w+)\}\}/g, '<span class="text-primary font-semibold">{{$1}}</span>');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Templates para geração de contratos imobiliários com IA.</p>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={seedDefaults}>
              <FileCode className="h-4 w-4 mr-2" />Criar Templates Imobiliários Padrão
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
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Placeholders padrão disponíveis:{" "}
                    {PLACEHOLDERS_PADRAO.slice(0, 6).map(p => (
                      <code key={p} className="text-primary text-xs mx-0.5">{`{{${p}}}`}</code>
                    ))}
                    {" "}e mais...
                  </p>
                </div>
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
                    placeholder="CONTRATO DE COMPRA E VENDA..."
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
            <p className="text-xs mt-1">Clique em "Criar Templates Imobiliários Padrão" para começar com {DEFAULT_TEMPLATES.length} modelos prontos.</p>
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
