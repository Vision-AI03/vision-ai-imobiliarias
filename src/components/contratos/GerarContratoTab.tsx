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
import { Send, Loader2, Save, FileText, Bot, User, Sparkles } from "lucide-react";

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
  email: string;
  empresa: string | null;
  telefone: string | null;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface GerarContratoTabProps {
  templates: Template[];
  onContratoGerado: () => void;
}

export default function GerarContratoTab({ templates, onContratoGerado }: GerarContratoTabProps) {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [contractPreview, setContractPreview] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchLeads() {
    const { data } = await supabase.from("leads").select("id, nome, email, empresa, telefone").order("nome");
    setLeads(data || []);
  }

  function getTemplate() {
    return templates.find(t => t.id === selectedTemplate);
  }

  function getLeadData() {
    return leads.find(l => l.id === selectedLead);
  }

  async function handleSend() {
    if (!input.trim()) return;
    const template = getTemplate();
    if (!template) {
      toast({ title: "Selecione um template primeiro", variant: "destructive" });
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("fill-contract", {
        body: {
          action: "fill_contract",
          template_content: template.conteudo_template,
          messages: newMessages,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const content = data.content || "";
      setMessages(prev => [...prev, { role: "assistant", content }]);

      // Extract contract preview from <contrato> tags
      const match = content.match(/<contrato>([\s\S]*?)<\/contrato>/);
      if (match) {
        setContractPreview(match[1].trim());
      }
    } catch (e: any) {
      toast({ title: "Erro ao processar", description: e.message, variant: "destructive" });
    }
    setLoading(false);
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

    // Extract data from chat via AI
    let extractedData: any = {};
    try {
      const { data } = await supabase.functions.invoke("fill-contract", {
        body: {
          action: "extract_data",
          template_content: "",
          messages: messages.filter(m => m.role === "user"),
        },
      });
      if (data?.data) extractedData = data.data;
    } catch { /* use empty */ }

    const nome_cliente = extractedData.nome_cliente || lead?.nome || "Cliente";

    const { error } = await supabase.from("contratos_gerados").insert({
      user_id: user.id,
      template_id: template?.id || null,
      lead_id: selectedLead || null,
      nome_cliente,
      email_cliente: extractedData.email_cliente || lead?.email || null,
      telefone_cliente: extractedData.telefone_cliente || lead?.telefone || null,
      cnpj_cpf: extractedData.cnpj_cpf || null,
      endereco: extractedData.endereco || null,
      dados_preenchidos: extractedData,
      conteudo_final: contractPreview,
      valor_total: extractedData.valor_total || null,
      numero_parcelas: extractedData.numero_parcelas || null,
      tipo_pagamento: extractedData.tipo_pagamento || "avista",
      valor_recorrente: extractedData.valor_recorrente || null,
      status: "rascunho",
      chat_historico: messages,
    } as any);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Rascunho salvo com sucesso!" });
      onContratoGerado();
    }
    setSaving(false);
  }

  function handleLeadSelect(leadId: string) {
    setSelectedLead(leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead && messages.length === 0) {
      const info = [`Cliente: ${lead.nome}`, lead.email && `Email: ${lead.email}`, lead.empresa && `Empresa: ${lead.empresa}`, lead.telefone && `Telefone: ${lead.telefone}`].filter(Boolean).join("\n");
      setInput(info);
    }
  }

  return (
    <div className="space-y-4">
      {/* Selection bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Template *</label>
          <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Vincular a Lead (opcional)</label>
          <Select value={selectedLead} onValueChange={handleLeadSelect}>
            <SelectTrigger><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
            <SelectContent>
              {leads.map(l => (
                <SelectItem key={l.id} value={l.id}>{l.nome} {l.empresa ? `— ${l.empresa}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedTemplate ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mb-4 opacity-40" />
            <p>Selecione um template para começar a gerar um contrato com IA.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Chat panel */}
          <Card className="glass-card flex flex-col" style={{ minHeight: "500px" }}>
            <div className="p-3 border-b border-border flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Chat com IA</span>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-muted-foreground text-sm py-8">
                    <p>Descreva os dados do cliente e da negociação.</p>
                    <p className="text-xs mt-2 text-muted-foreground/60">Ex: "O cliente é João da Silva, CNPJ 12.345.678/0001-99. Fechamos por R$8.000 em 4x."</p>
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
                        ? msg.content.replace(/<contrato>[\s\S]*?<\/contrato>/g, "[📄 Contrato gerado — veja o preview ao lado]")
                        : msg.content
                      }
                    </div>
                    {msg.role === "user" && <User className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />}
                  </div>
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Gerando...</span>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Digite os dados do cliente..."
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                disabled={loading}
              />
              <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>

          {/* Preview panel */}
          <Card className="glass-card flex flex-col" style={{ minHeight: "500px" }}>
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Preview do Contrato</span>
              </div>
              {contractPreview && (
                <Button size="sm" onClick={handleSaveRascunho} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Salvando..." : "Salvar Rascunho"}
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1 p-4">
              {contractPreview ? (
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{contractPreview}</pre>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                  <FileText className="h-12 w-12 mb-4 opacity-40" />
                  <p className="text-sm">O contrato preenchido aparecerá aqui.</p>
                </div>
              )}
            </ScrollArea>
          </Card>
        </div>
      )}
    </div>
  );
}
