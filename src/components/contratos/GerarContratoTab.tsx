import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracoesSistema } from "@/hooks/useConfiguracoesSistema";
import { Loader2, Save, FileText, Sparkles, Building2, UserIcon, Printer } from "lucide-react";
import { format } from "date-fns";

interface Template {
  id: string;
  nome: string;
  tipo: string;
  conteudo_template: string;
  placeholders: any;
}

interface Lead {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
}

interface Imovel {
  id: string;
  titulo: string | null;
  tipo: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  valor_venda: number | null;
  valor_aluguel: number | null;
  matricula: string | null;
  cartorio_registro: string | null;
  corretor?: { nome: string; creci: string | null } | null;
}

interface GerarContratoTabProps {
  templates: Template[];
  onContratoGerado: () => void;
}

function renderPreview(text: string) {
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return parts.map((part, i) =>
    /^\{\{[^}]+\}\}$/.test(part)
      ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-800/70 text-yellow-900 dark:text-yellow-100 px-0.5 rounded"
        >
          {part}
        </mark>
      )
      : <span key={i}>{part}</span>
  );
}

export default function GerarContratoTab({ templates, onContratoGerado }: GerarContratoTabProps) {
  const { toast } = useToast();
  const { config } = useConfiguracoesSistema();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<string>("__none__");
  const [selectedImovel, setSelectedImovel] = useState<string>("__none__");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [contractFilled, setContractFilled] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchLeadsImoveis();
  }, []);

  async function fetchLeadsImoveis() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const [{ data: leadsData }, { data: imoveisData }] = await Promise.all([
      supabase.from("leads").select("id, nome, email, telefone").order("nome").limit(200),
      supabase
        .from("imoveis")
        .select("id, titulo, tipo, endereco, bairro, cidade, valor_venda, valor_aluguel, matricula, cartorio_registro, corretor:corretores(nome, creci)")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setLeads((leadsData as Lead[]) || []);
    setImoveis((imoveisData as unknown as Imovel[]) || []);
  }

  const template = templates.find(t => t.id === selectedTemplate);
  const lead = leads.find(l => l.id === selectedLead);
  const imovel = imoveis.find(i => i.id === selectedImovel);

  async function handlePreencherIA() {
    if (!template) {
      toast({ title: "Selecione um template", variant: "destructive" });
      return;
    }

    const today = format(new Date(), "dd/MM/yyyy");
    const lines: string[] = [];
    lines.push(`Data atual: ${today}`);
    lines.push(`Imobiliária: ${config.nome_imobiliaria || config.nome_plataforma || "Vision AI"}`);
    if (config.cnpj) lines.push(`CNPJ: ${config.cnpj}`);
    if (config.telefone_suporte) lines.push(`Telefone: ${config.telefone_suporte}`);
    if (config.email_suporte) lines.push(`Email: ${config.email_suporte}`);

    if (imovel) {
      lines.push(`\nIMÓVEL:`);
      lines.push(`- Tipo: ${imovel.tipo}`);
      if (imovel.titulo) lines.push(`- Título: ${imovel.titulo}`);
      if (imovel.endereco) lines.push(`- Endereço: ${imovel.endereco}${imovel.bairro ? `, ${imovel.bairro}` : ""}${imovel.cidade ? `, ${imovel.cidade}` : ""}`);
      if (imovel.matricula) lines.push(`- Matrícula: ${imovel.matricula}`);
      if (imovel.cartorio_registro) lines.push(`- Cartório: ${imovel.cartorio_registro}`);
      if (imovel.valor_venda) lines.push(`- Valor de venda: R$ ${imovel.valor_venda.toLocaleString("pt-BR")}`);
      if (imovel.valor_aluguel) lines.push(`- Valor de aluguel: R$ ${imovel.valor_aluguel.toLocaleString("pt-BR")}/mês`);
      if (imovel.corretor?.nome) lines.push(`- Corretor: ${imovel.corretor.nome}${imovel.corretor.creci ? ` (CRECI: ${imovel.corretor.creci})` : ""}`);
    }

    if (lead) {
      lines.push(`\nCLIENTE:`);
      lines.push(`- Nome: ${lead.nome}`);
      if (lead.email) lines.push(`- Email: ${lead.email}`);
      if (lead.telefone) lines.push(`- Telefone: ${lead.telefone}`);
    }

    lines.push(`\nInstruções: Preencha TODOS os {{campos}} do template com os dados acima. Para campos sem dados disponíveis, mantenha o placeholder {{campo}}. Retorne SOMENTE o contrato preenchido entre as tags <contrato> e </contrato>, sem nenhum texto adicional fora das tags.`);

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fill-contract", {
        body: {
          action: "fill_contract",
          template_content: template.conteudo_template,
          messages: [{ role: "user", content: lines.join("\n") }],
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content: string = data.content || "";
      const match = content.match(/<contrato>([\s\S]*?)<\/contrato>/);
      setContractFilled(match ? match[1].trim() : content.trim());
    } catch (e: any) {
      toast({ title: "Erro ao preencher contrato", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  function handlePDF() {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({ title: "Permita popups para gerar PDF", variant: "destructive" });
      return;
    }
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrato</title><style>body{font-family:Arial,sans-serif;padding:40px;font-size:12pt;line-height:1.6;}pre{white-space:pre-wrap;font-family:inherit;}</style></head><body><pre>${contractFilled.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`);
    printWindow.document.close();
    printWindow.print();
  }

  async function handleSaveRascunho() {
    if (!contractFilled) {
      toast({ title: "Preencha com IA antes de salvar", variant: "destructive" });
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("contratos_gerados").insert({
        user_id: user.id,
        template_id: template?.id || null,
        lead_id: lead?.id || null,
        nome_cliente: lead?.nome || "Cliente",
        email_cliente: lead?.email || null,
        telefone_cliente: lead?.telefone || null,
        dados_preenchidos: {
          imovel_id: imovel?.id || null,
          tipo_contrato: template?.tipo || null,
        },
        conteudo_final: contractFilled,
        status: "rascunho",
      } as any);

      if (error) throw error;
      toast({ title: "Rascunho salvo!" });
      onContratoGerado();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  // Count remaining unfilled fields
  const unfilledCount = (contractFilled.match(/\{\{[^}]+\}\}/g) || []).length;

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Template *</label>
          <Select value={selectedTemplate} onValueChange={(v) => { setSelectedTemplate(v); setContractFilled(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione o tipo de contrato" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <Building2 className="inline h-3 w-3 mr-1" />
            Imóvel (auto-preenche dados)
          </label>
          <Select value={selectedImovel} onValueChange={(v) => { setSelectedImovel(v); setContractFilled(""); }}>
            <SelectTrigger><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem imóvel vinculado</SelectItem>
              {imoveis.map(i => (
                <SelectItem key={i.id} value={i.id}>
                  {i.titulo || i.tipo} — {i.endereco || i.bairro || "Sem endereço"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <UserIcon className="inline h-3 w-3 mr-1" />
            Lead / Cliente (opcional)
          </label>
          <Select value={selectedLead} onValueChange={(v) => { setSelectedLead(v); setContractFilled(""); }}>
            <SelectTrigger><SelectValue placeholder="Vincular lead do CRM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem lead vinculado</SelectItem>
              {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Context badges */}
      {(imovel || lead) && (
        <div className="flex flex-wrap gap-2">
          {imovel && (
            <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg">
              <Building2 className="h-3 w-3" />
              {imovel.tipo} · {imovel.endereco || imovel.bairro || "Sem endereço"}
              {imovel.valor_venda ? ` · R$ ${imovel.valor_venda.toLocaleString("pt-BR")}` : ""}
            </div>
          )}
          {lead && (
            <div className="flex items-center gap-2 text-xs bg-secondary px-3 py-1.5 rounded-lg">
              <UserIcon className="h-3 w-3" />
              {lead.nome}
              {lead.telefone ? ` · ${lead.telefone}` : ""}
            </div>
          )}
        </div>
      )}

      {!selectedTemplate ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-sm">Selecione um template para começar.</p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              A IA irá preencher automaticamente os dados do imóvel, cliente e imobiliária.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Action button */}
          <div className="flex justify-center">
            <Button
              onClick={handlePreencherIA}
              disabled={loading}
              size="lg"
              className="gap-2 px-8"
            >
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preenchendo...</>
                : <><Sparkles className="h-4 w-4" /> Preencher com IA</>
              }
            </Button>
          </div>

          {/* Preview */}
          <Card className="glass-card">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {contractFilled ? "Contrato Preenchido" : "Preview do Template"}
                </span>
              </div>
              {contractFilled && (
                <div className="flex items-center gap-2">
                  {unfilledCount > 0 && (
                    <span className="text-xs text-yellow-600 dark:text-yellow-400">
                      {unfilledCount} campo{unfilledCount !== 1 ? "s" : ""} não preenchido{unfilledCount !== 1 ? "s" : ""}
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={handlePDF} className="h-7 text-xs gap-1">
                    <Printer className="h-3 w-3" />
                    Gerar PDF
                  </Button>
                  <Button size="sm" onClick={handleSaveRascunho} disabled={saving} className="h-7 text-xs gap-1">
                    <Save className="h-3 w-3" />
                    {saving ? "Salvando..." : "Salvar Rascunho"}
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="h-[480px]">
              <div className="p-4 text-sm leading-relaxed font-mono whitespace-pre-wrap bg-white dark:bg-muted/10 min-h-[480px]">
                {contractFilled
                  ? renderPreview(contractFilled)
                  : renderPreview(template.conteudo_template)
                }
              </div>
            </ScrollArea>
          </Card>

          {contractFilled && unfilledCount === 0 && (
            <p className="text-xs text-center text-green-600 dark:text-green-400">
              Todos os campos foram preenchidos com sucesso.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
