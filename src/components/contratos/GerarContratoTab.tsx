import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracoesSistema } from "@/hooks/useConfiguracoesSistema";
import { Send, Loader2, Save, FileText, Bot, UserIcon, Sparkles, Home, Building2 } from "lucide-react";

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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GerarContratoTabProps {
  templates: Template[];
  onContratoGerado: () => void;
}

// Fluxo guiado para contratos imobiliários
const FLOW_STEPS = [
  "tipo",
  "imovel",
  "comprador",
  "vendedor",
  "condicoes",
  "clausulas",
  "gerar",
];

export default function GerarContratoTab({ templates, onContratoGerado }: GerarContratoTabProps) {
  const { toast } = useToast();
  const { config } = useConfiguracoesSistema();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [selectedImovel, setSelectedImovel] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contractPreview, setContractPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const [collectedData, setCollectedData] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeadsImoveis();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchLeadsImoveis() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const [{ data: leadsData }, { data: imoveisData }] = await Promise.all([
      supabase.from("leads").select("id, nome, email, telefone").order("nome").limit(200),
      supabase.from("imoveis")
        .select("id, titulo, tipo, endereco, bairro, cidade, valor_venda, valor_aluguel, matricula, cartorio_registro, corretor:corretores(nome, creci)")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setLeads((leadsData as Lead[]) || []);
    setImoveis((imoveisData as unknown as Imovel[]) || []);
  }

  function getTemplate() {
    return templates.find(t => t.id === selectedTemplate);
  }

  function getImovelData() {
    return imoveis.find(i => i.id === selectedImovel);
  }

  function getLeadData() {
    return leads.find(l => l.id === selectedLead);
  }

  // Inicia o fluxo guiado
  function startGuidedFlow() {
    const template = getTemplate();
    if (!template) {
      toast({ title: "Selecione um template primeiro", variant: "destructive" });
      return;
    }
    setMessages([{
      role: "assistant",
      content: `Olá! Vou te ajudar a gerar o **${template.nome}**.\n\nPrimeiro, selecione o imóvel acima (ou confirme o já selecionado) e o lead/comprador. Depois, descreva os dados das partes e as condições financeiras na caixa de mensagem abaixo.\n\nPode incluir:\n• Nome, CPF, RG do comprador e do vendedor\n• Condições de pagamento (entrada, financiamento, parcelas)\n• Prazo de entrega/assinatura\n• Cláusulas especiais\n\nQuando tiver tudo pronto, envie e eu gero o contrato completo.`,
    }]);
    setFlowStep(1);
    setContractPreview("");
  }

  async function handleSend() {
    if (!input.trim()) return;
    const template = getTemplate();
    if (!template) {
      toast({ title: "Selecione um template primeiro", variant: "destructive" });
      return;
    }

    const imovel = getImovelData();
    const lead = getLeadData();

    // Montar contexto do imóvel e imobiliária para a IA
    const contexto = buildContexto(template, imovel, lead);

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("fill-contract", {
        body: {
          action: "fill_contract",
          template_content: contexto + "\n\n" + template.conteudo_template,
          messages: newMessages,
          sistema_context: `Você é um assistente especializado em contratos imobiliários.
          Imobiliária: ${config.nome_imobiliaria || config.nome_plataforma}.
          Quando você gerar o contrato, coloque entre tags <contrato> e </contrato>.
          Use linguagem jurídica adequada para o mercado imobiliário brasileiro.`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data.content || "";
      setMessages(prev => [...prev, { role: "assistant", content }]);

      const match = content.match(/<contrato>([\s\S]*?)<\/contrato>/);
      if (match) {
        setContractPreview(match[1].trim());
      }
    } catch (e: any) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  function buildContexto(template: Template, imovel: Imovel | undefined, lead: Lead | undefined): string {
    const parts: string[] = ["=== CONTEXTO AUTOMÁTICO ==="];

    if (config.nome_imobiliaria) {
      parts.push(`Imobiliária: ${config.nome_imobiliaria}`);
      if (config.cnpj) parts.push(`CNPJ: ${config.cnpj}`);
    }

    if (imovel) {
      parts.push(`\nImóvel selecionado:`);
      parts.push(`- Tipo: ${imovel.tipo}`);
      if (imovel.titulo) parts.push(`- Título: ${imovel.titulo}`);
      if (imovel.endereco) parts.push(`- Endereço: ${imovel.endereco}${imovel.bairro ? `, ${imovel.bairro}` : ""}${imovel.cidade ? `, ${imovel.cidade}` : ""}`);
      if (imovel.matricula) parts.push(`- Matrícula: ${imovel.matricula}`);
      if (imovel.cartorio_registro) parts.push(`- Cartório: ${imovel.cartorio_registro}`);
      if (imovel.valor_venda) parts.push(`- Valor de venda: R$ ${imovel.valor_venda.toLocaleString("pt-BR")}`);
      if (imovel.valor_aluguel) parts.push(`- Valor de aluguel: R$ ${imovel.valor_aluguel.toLocaleString("pt-BR")}/mês`);
      if (imovel.corretor) {
        parts.push(`- Corretor: ${imovel.corretor.nome}${imovel.corretor.creci ? ` (CRECI: ${imovel.corretor.creci})` : ""}`);
      }
    }

    if (lead) {
      parts.push(`\nLead/Cliente selecionado:`);
      parts.push(`- Nome: ${lead.nome}`);
      if (lead.email) parts.push(`- Email: ${lead.email}`);
      if (lead.telefone) parts.push(`- Telefone: ${lead.telefone}`);
    }

    parts.push("\n=== FIM DO CONTEXTO AUTOMÁTICO ===\n");
    return parts.join("\n");
  }

  async function handleSaveRascunho() {
    if (!contractPreview) {
      toast({ title: "Gere um contrato antes de salvar", variant: "destructive" });
      return;
    }
    const template = getTemplate();
    const lead = getLeadData();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    try {
      const { data } = await supabase.functions.invoke("fill-contract", {
        body: {
          action: "extract_data",
          template_content: "",
          messages: messages.filter(m => m.role === "user"),
        },
      });
      const extractedData = data?.data || {};

      const { error } = await supabase.from("contratos_gerados").insert({
        user_id: user.id,
        template_id: template?.id || null,
        lead_id: selectedLead || null,
        nome_cliente: extractedData.nome_cliente || lead?.nome || "Cliente",
        email_cliente: extractedData.email_cliente || lead?.email || null,
        telefone_cliente: extractedData.telefone_cliente || lead?.telefone || null,
        cnpj_cpf: extractedData.cnpj_cpf || null,
        endereco: extractedData.endereco || null,
        dados_preenchidos: {
          ...extractedData,
          imovel_id: selectedImovel || null,
          tipo_contrato: template?.tipo || null,
        },
        conteudo_final: contractPreview,
        valor_total: extractedData.valor_total || null,
        numero_parcelas: extractedData.numero_parcelas || null,
        tipo_pagamento: extractedData.tipo_pagamento || "avista",
        valor_recorrente: extractedData.valor_recorrente || null,
        status: "rascunho",
        chat_historico: messages,
      } as any);

      if (error) throw error;
      toast({ title: "Rascunho salvo com sucesso!" });
      onContratoGerado();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  }

  const imovelSelecionado = getImovelData();
  const leadSelecionado = getLeadData();

  return (
    <div className="space-y-4">
      {/* Seleção de template, imóvel e lead */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Template *</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger><SelectValue placeholder="Selecione o tipo de contrato" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">
            <Home className="inline h-3 w-3 mr-1" />
            Imóvel (auto-preenche dados)
          </label>
          <Select value={selectedImovel} onValueChange={setSelectedImovel}>
            <SelectTrigger><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem imóvel vinculado</SelectItem>
              {imoveis.map(i => (
                <SelectItem key={i.id} value={i.id}>
                  {i.titulo || i.tipo} — {i.endereco || i.bairro || "Sem endereço"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Lead / Cliente (opcional)</label>
          <Select value={selectedLead} onValueChange={setSelectedLead}>
            <SelectTrigger><SelectValue placeholder="Vincular lead do CRM" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem lead vinculado</SelectItem>
              {leads.map((l: Lead) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Info dos selecionados */}
      {(imovelSelecionado || leadSelecionado) && (
        <div className="flex flex-wrap gap-2">
          {imovelSelecionado && (
            <div className="flex items-center gap-2 text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg">
              <Building2 className="h-3 w-3" />
              {imovelSelecionado.tipo} · {imovelSelecionado.endereco || "Sem endereço"}
              {imovelSelecionado.valor_venda && ` · R$ ${imovelSelecionado.valor_venda.toLocaleString("pt-BR")}`}
            </div>
          )}
          {leadSelecionado && (
            <div className="flex items-center gap-2 text-xs bg-secondary px-3 py-1.5 rounded-lg">
              <UserIcon className="h-3 w-3" />
              {leadSelecionado.nome}
              {leadSelecionado.telefone && ` · ${leadSelecionado.telefone}`}
            </div>
          )}
        </div>
      )}

      {!selectedTemplate ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-40" />
            <p>Selecione um template para começar a gerar um contrato imobiliário com IA.</p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              A IA irá preencher automaticamente os dados do imóvel e do cliente selecionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chat panel */}
          <Card className="glass-card flex flex-col" style={{ minHeight: "520px" }}>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Assistente de Contratos</span>
              </div>
              {messages.length === 0 && (
                <Button size="sm" variant="outline" onClick={startGuidedFlow} className="text-xs h-7">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Iniciar
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8 space-y-2">
                    <Sparkles className="h-8 w-8 mx-auto opacity-30" />
                    <p>Clique em <strong>Iniciar</strong> para começar o fluxo guiado.</p>
                    <p className="text-xs text-muted-foreground/60">
                      A IA vai guiar você pelas etapas e gerar o contrato automaticamente.
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && <Bot className="h-5 w-5 text-primary mt-1 flex-shrink-0" />}
                    <div className={`rounded-lg px-3 py-2 max-w-[85%] text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      {msg.role === "assistant"
                        ? msg.content.replace(/<contrato>[\s\S]*?<\/contrato>/g, "📄 Contrato gerado → veja o preview ao lado")
                        : msg.content
                      }
                    </div>
                    {msg.role === "user" && <UserIcon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Gerando contrato...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border space-y-2">
              {messages.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[
                    "Gerar contrato agora",
                    "Alterar percentual de comissão",
                    "Adicionar cláusula de multa",
                    "Mudar forma de pagamento",
                  ].map(s => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-border hover:border-primary hover:text-primary transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={messages.length === 0 ? "Clique em Iniciar primeiro..." : "Descreva dados das partes, condições, cláusulas..."}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={loading || messages.length === 0}
                />
                <Button onClick={handleSend} disabled={loading || !input.trim() || messages.length === 0} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Preview panel */}
          <Card className="glass-card flex flex-col" style={{ minHeight: "520px" }}>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Preview do Contrato</span>
              </div>
              {contractPreview && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleSaveRascunho} disabled={saving} className="h-7 text-xs">
                    <Save className="h-3 w-3 mr-1" />
                    {saving ? "Salvando..." : "Salvar Rascunho"}
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              {contractPreview ? (
                <div className="text-sm leading-relaxed font-sans whitespace-pre-wrap bg-white dark:bg-muted/20 p-4 rounded border border-border min-h-full">
                  {contractPreview}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <FileText className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-sm text-center">
                    O contrato preenchido aparecerá aqui.
                    <br />
                    <span className="text-xs text-muted-foreground/60 mt-1 block">
                      Inicie o assistente e forneça os dados das partes.
                    </span>
                  </p>
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
}
