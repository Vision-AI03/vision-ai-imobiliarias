import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MailCheck, MessageSquare, CheckCheck, ExternalLink, Calendar, Building2, User, Globe, Linkedin, Sparkles, Loader2, Send, Trash2, Bot, ChevronDown, ChevronUp, CheckSquare, MapPin, Clock } from "lucide-react";
import { CalculadoraFinanciamento } from "@/components/financiamento/CalculadoraFinanciamento";
import { WhatsAppTab } from "@/components/crm/WhatsAppTab";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const COLUNAS = [
  { value: "novo_lead", label: "Novo Lead" },
  { value: "contatado", label: "Contatado" },
  { value: "visita_agendada", label: "Visita Agendada" },
  { value: "visita_realizada", label: "Visita Realizada" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "negociando", label: "Negociando" },
  { value: "contrato_assinado", label: "Contrato Assinado" },
  { value: "perdido", label: "Perdido" },
];

const MOTIVOS_PERDA = [
  "Preço acima do orçamento",
  "Não encontrou imóvel adequado",
  "Escolheu outra imobiliária",
  "Desistiu da compra/aluguel",
  "Financiamento não aprovado",
  "Sem resposta após follow-up",
  "Timing — vai buscar depois",
  "Outro",
];

const ORIGENS_BADGE: Record<string, string> = {
  zap: "🏠 ZAP Imóveis",
  vivareal: "🏠 Viva Real",
  olx: "🏠 OLX",
  meta: "📱 Meta Ads",
  whatsapp: "💬 WhatsApp",
  site: "🌐 Formulário Site",
  indicacao: "👤 Indicação",
  manual: "✋ Manual",
};

function getScoreColor(score: number | null) {
  const s = score ?? 0;
  if (s >= 71) return "bg-success/20 text-success";
  if (s >= 41) return "bg-warning/20 text-warning";
  return "bg-destructive/20 text-destructive";
}

interface LeadDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (leadId: string, newStatus: string) => void;
  onLeadUpdate?: (lead: Lead) => void;
  onLeadDelete?: (leadId: string) => void;
}

interface TimelineEvent {
  id: string;
  type: "email" | "whatsapp" | "tarefa" | "visita" | "criacao";
  title: string;
  subtitle?: string;
  date: string;
  extra?: string;
}

export default function LeadDrawer({ lead, open, onClose, onStatusChange, onLeadUpdate, onLeadDelete }: LeadDrawerProps) {
  const [anotacoes, setAnotacoes] = useState("");
  const [comunicacoes, setComunicacoes] = useState<Tables<"comunicacoes">[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [showCalc, setShowCalc] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ assunto: string; conteudo: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (lead) {
      setAnotacoes(lead.mensagem_original || "");
      setEmailDraft(null);
      fetchComunicacoes(lead.id);
      fetchTimeline(lead);
    }
  }, [lead]);

  async function fetchComunicacoes(leadId: string) {
    const { data } = await supabase
      .from("comunicacoes")
      .select("*")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: false });
    setComunicacoes(data || []);
  }

  async function fetchTimeline(l: Lead) {
    const [comsRes, tarefasRes, visitasRes] = await Promise.all([
      supabase.from("comunicacoes").select("id, tipo, direcao, assunto, conteudo, criado_em").eq("lead_id", l.id),
      supabase.from("tarefas").select("id, titulo, status, concluida, data_vencimento, criado_em").eq("lead_id", l.id),
      supabase.from("agenda_visitas").select("id, data_visita, hora_visita, status, imovel:imoveis(endereco, bairro)").eq("lead_id", l.id),
    ]);

    const events: TimelineEvent[] = [];

    // Lead creation
    events.push({
      id: "criacao",
      type: "criacao",
      title: "Lead criado",
      subtitle: ORIGENS_BADGE[(l as any).origem_portal] || "Manual",
      date: l.criado_em,
    });

    // Communications
    for (const c of comsRes.data || []) {
      events.push({
        id: c.id,
        type: c.tipo === "whatsapp" ? "whatsapp" : "email",
        title: c.assunto || (c.tipo === "whatsapp" ? "Mensagem WhatsApp" : "Email"),
        subtitle: `${c.direcao === "enviado" ? "Enviado" : "Recebido"} · ${c.conteudo?.slice(0, 60) || ""}`,
        date: c.criado_em,
      });
    }

    // Tasks
    for (const t of tarefasRes.data || []) {
      events.push({
        id: t.id,
        type: "tarefa",
        title: t.titulo,
        subtitle: t.concluida ? "Concluída" : t.status?.replace(/_/g, " "),
        date: t.data_vencimento ? `${t.data_vencimento}T00:00:00` : t.criado_em,
        extra: t.concluida ? "concluida" : undefined,
      });
    }

    // Visits
    for (const v of visitasRes.data || []) {
      const imovel = (v as any).imovel;
      const addr = imovel ? `${imovel.endereco || ""}${imovel.bairro ? `, ${imovel.bairro}` : ""}` : "";
      events.push({
        id: v.id,
        type: "visita",
        title: `Visita ${v.status === "realizada" ? "realizada" : v.status === "cancelada" ? "cancelada" : "agendada"}`,
        subtitle: [v.hora_visita?.slice(0, 5), addr].filter(Boolean).join(" · "),
        date: `${v.data_visita}T${v.hora_visita || "00:00:00"}`,
        extra: v.status,
      });
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTimeline(events);
  }

  async function salvarAnotacoes() {
    if (!lead) return;
    await supabase.from("leads").update({ mensagem_original: anotacoes }).eq("id", lead.id);
  }

  async function handleDeleteLead() {
    if (!lead) return;
    setDeleting(true);
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) {
      toast({ title: "Erro ao excluir lead", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead excluído com sucesso!" });
      onLeadDelete?.(lead.id);
      onClose();
    }
    setDeleting(false);
  }

  async function handleEnrichLead() {
    if (!lead) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-lead", {
        body: { lead_id: lead.id },
      });
      if (error || data?.error) {
        toast({ title: "Erro no enriquecimento", description: error?.message || data?.error, variant: "destructive" });
      } else {
        toast({
          title: "Lead enriquecido com sucesso!",
          description: `Site: ${data.sources?.site_scraped ? "✓" : "✗"} | Busca: ${data.sources?.search_done ? "✓" : "✗"} | LinkedIn: ${data.sources?.linkedin_scraped ? "✓" : "✗"} | Instagram: ${data.sources?.instagram_scraped ? "✓" : "✗"}`,
        });
        // Fetch updated lead data from DB and propagate
        const { data: updatedLead } = await supabase
          .from("leads")
          .select("*")
          .eq("id", lead.id)
          .maybeSingle();
        if (updatedLead && onLeadUpdate) {
          onLeadUpdate(updatedLead);
        }
      }
    } catch (e) {
      toast({ title: "Erro ao enriquecer lead", variant: "destructive" });
    }
    setEnriching(false);
  }

  async function handleGenerateEmail() {
    if (!lead) return;
    setGeneratingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: { lead_id: lead.id },
      });
      if (error || data?.error) {
        toast({ title: "Erro ao gerar email", description: error?.message || data?.error, variant: "destructive" });
      } else {
        setEmailDraft(data.data);
        toast({ title: "Rascunho de email gerado!" });
      }
    } catch (e) {
      toast({ title: "Erro ao gerar email", variant: "destructive" });
    }
    setGeneratingEmail(false);
  }

  async function handleSendDraft() {
    if (!lead || !emailDraft) return;
    setSendingEmail(true);

    const htmlContent = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px;text-align:center;">
          <span style="color:#fff;font-weight:bold;font-size:20px;">Vision AI</span>
        </div>
        <div style="padding:24px;background:#fff;">
          <h2 style="margin:0 0 16px;">${emailDraft.assunto}</h2>
          <div style="white-space:pre-wrap;color:#333;">${emailDraft.conteudo}</div>
        </div>
        <div style="background:#f5f5f5;padding:12px;text-align:center;font-size:11px;color:#888;">
          Vision AI — Inteligência Artificial para o seu negócio
        </div>
      </div>`;

    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to: lead.email, name: lead.nome, subject: emailDraft.assunto, html: htmlContent },
    });

    if (error || data?.error) {
      toast({ title: "Erro ao enviar", description: error?.message || data?.error, variant: "destructive" });
    } else {
      await supabase.from("comunicacoes").insert({
        lead_id: lead.id, tipo: "email", direcao: "enviado",
        assunto: emailDraft.assunto, conteudo: emailDraft.conteudo, status: "enviado",
      });
      await supabase.from("leads").update({
        email_enviado: true, data_email_enviado: new Date().toISOString(),
      }).eq("id", lead.id);

      toast({ title: "Email enviado com sucesso!" });
      setEmailDraft(null);
      fetchComunicacoes(lead.id);
    }
    setSendingEmail(false);
  }

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-5">
            <SheetHeader className="text-left">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-lg">{lead.nome}</SheetTitle>
                <Badge className={`${getScoreColor(lead.score)}`}>Score: {lead.score ?? 0}</Badge>
              </div>
              {lead.empresa && <p className="text-sm text-muted-foreground">{lead.empresa}</p>}
            </SheetHeader>

            {/* Origem badge */}
            {(lead as any).origem_portal && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Origem:</span>
                <span className="text-xs font-medium">
                  {ORIGENS_BADGE[(lead as any).origem_portal] || (lead as any).origem_portal}
                </span>
              </div>
            )}

            {/* Move column */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Mover para</label>
              <Select value={lead.status || "novo_lead"} onValueChange={(v) => onStatusChange(lead.id, v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COLUNAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Contact info */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Dados de Contato</h4>
              <div className="grid grid-cols-1 gap-1.5 text-sm">
                <InfoRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={lead.email} />
                <InfoRow icon={<MessageSquare className="h-3.5 w-3.5" />} label="Telefone" value={lead.telefone} />
                <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Empresa" value={lead.empresa} />
                <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Site" value={lead.site_empresa} link />
                <InfoRow icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" value={lead.linkedin_url} link />
                <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Instagram" value={(lead as any).instagram_url} link />
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Cargo" value={lead.linkedin_cargo} />
              </div>
            </div>

            {/* Motivo de perda — só aparece na coluna perdido */}
            {lead.status === "perdido" && (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-medium">Motivo da perda</label>
                <Select
                  value={(lead as any).motivo_perda || ""}
                  onValueChange={async (v) => {
                    await supabase.from("leads").update({ motivo_perda: v } as any).eq("id", lead.id);
                    if (onLeadUpdate) {
                      const { data: upd } = await supabase.from("leads").select("*").eq("id", lead.id).maybeSingle();
                      if (upd) onLeadUpdate(upd);
                    }
                  }}
                >
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_PERDA.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            {/* Interesse Imobiliário */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Interesse Imobiliário
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <DataBadge label="Tipo de Interesse" value={(lead as any).tipo_interesse} />
                <DataBadge label="Tipo de Imóvel" value={(lead as any).tipo_imovel} />
                <DataBadge label="Quartos Desejado" value={(lead as any).quartos_desejado ? `${(lead as any).quartos_desejado}+` : null} />
                <DataBadge label="Vagas Desejadas" value={(lead as any).vagas_desejado != null ? `${(lead as any).vagas_desejado}` : null} />
                <DataBadge label="Prazo de Decisão" value={(lead as any).prazo_decisao} />
                <DataBadge label="Aceita Financiamento" value={(lead as any).aceita_financiamento_lead} />
                <DataBadge label="Possui FGTS" value={(lead as any).possui_fgts ? "Sim" : null} />
              </div>
              {((lead as any).valor_min || (lead as any).valor_max) && (
                <div className="bg-secondary/50 rounded p-2 text-xs">
                  <p className="text-muted-foreground text-[10px]">Faixa de Valor</p>
                  <p className="font-medium">
                    {(lead as any).valor_min
                      ? `R$ ${Number((lead as any).valor_min).toLocaleString("pt-BR")}`
                      : "—"}{" "}
                    →{" "}
                    {(lead as any).valor_max
                      ? `R$ ${Number((lead as any).valor_max).toLocaleString("pt-BR")}`
                      : "—"}
                  </p>
                </div>
              )}
              {(lead as any).bairros_interesse?.length > 0 && (
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Bairros de interesse</p>
                  <div className="flex flex-wrap gap-1">
                    {(lead as any).bairros_interesse.map((b: string) => (
                      <span key={b} className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calculadora de Financiamento */}
            {(lead as any).aceita_financiamento_lead && (
              <div className="rounded-lg border border-border overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs font-medium"
                  onClick={() => setShowCalc(!showCalc)}
                >
                  <span>Simulação de Financiamento</span>
                  {showCalc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showCalc && (
                  <div className="p-4">
                    <CalculadoraFinanciamento
                      valorImovelInicial={(lead as any).valor_max || (lead as any).valor_min || undefined}
                      compact
                    />
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* AI Analysis */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Análise da IA</h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <DataBadge label="Segmento" value={lead.segmento} />
                <DataBadge label="Porte" value={lead.porte_empresa} />
                <DataBadge label="Maturidade Digital" value={lead.nivel_maturidade_digital} />
                <DataBadge label="Prioridade" value={lead.prioridade_contato} />
              </div>
              {lead.dores_identificadas && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Dores Identificadas</p>
                  <p className="text-xs bg-secondary/50 p-2 rounded">{lead.dores_identificadas}</p>
                </div>
              )}
              {lead.oportunidades && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Oportunidades</p>
                  <p className="text-xs bg-secondary/50 p-2 rounded">{lead.oportunidades}</p>
                </div>
              )}
              {lead.motivo_score && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Motivo do Score</p>
                  <p className="text-xs bg-secondary/50 p-2 rounded">{lead.motivo_score}</p>
                </div>
              )}
              {lead.resumo_empresa && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Resumo da Empresa</p>
                  <p className="text-xs bg-secondary/50 p-2 rounded">{lead.resumo_empresa}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Interaction indicators */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Status de Interação</h4>
              <div className="flex flex-wrap gap-2">
                <InteractionBadge
                  icon={lead.email_respondido ? <MailCheck className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                  label={lead.email_respondido ? "Email Respondido" : lead.email_enviado ? "Email Enviado" : "Email Pendente"}
                  active={!!lead.email_enviado}
                  success={!!lead.email_respondido}
                />
                <InteractionBadge
                  icon={lead.whatsapp_respondido ? <CheckCheck className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                  label={lead.whatsapp_respondido ? "WhatsApp Respondido" : lead.whatsapp_enviado ? "WhatsApp Enviado" : "WhatsApp Pendente"}
                  active={!!lead.whatsapp_enviado}
                  success={!!lead.whatsapp_respondido}
                />
                <InteractionBadge
                  icon={<Calendar className="h-3 w-3" />}
                  label={lead.reuniao_agendada ? `Reunião ${lead.data_reuniao ? format(new Date(lead.data_reuniao), "dd/MM") : "Agendada"}` : "Sem Reunião"}
                  active={!!lead.reuniao_agendada}
                  success={!!lead.reuniao_agendada}
                />
              </div>
            </div>

            <Separator />

            {/* Actions: Enrich + Generate Email */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Ações Automáticas</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEnrichLead}
                  disabled={enriching}
                  className="gap-1.5 text-xs"
                >
                  {enriching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {enriching ? "Enriquecendo..." : "Enriquecer com IA"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleGenerateEmail}
                  disabled={generatingEmail}
                  className="gap-1.5 text-xs"
                >
                  {generatingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                  {generatingEmail ? "Gerando..." : "Gerar Email com IA"}
                </Button>
              </div>

              {/* Email Draft - Editable */}
              {emailDraft && (
                <div className="rounded-lg border border-primary/30 overflow-hidden mt-2">
                  <div className="bg-primary/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-primary">Rascunho de Email (editável)</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEmailDraft(null)}>
                        Descartar
                      </Button>
                      <Button
                        size="sm"
                        className="h-6 text-xs gradient-primary text-primary-foreground gap-1"
                        onClick={handleSendDraft}
                        disabled={sendingEmail}
                      >
                        <Send className="h-3 w-3" />
                        {sendingEmail ? "Enviando..." : "Enviar"}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Assunto</label>
                      <input
                        type="text"
                        value={emailDraft.assunto}
                        onChange={(e) => setEmailDraft({ ...emailDraft, assunto: e.target.value })}
                        className="w-full mt-0.5 rounded border border-border bg-secondary/30 px-2 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Conteúdo</label>
                      <textarea
                        value={emailDraft.conteudo}
                        onChange={(e) => setEmailDraft({ ...emailDraft, conteudo: e.target.value })}
                        rows={8}
                        className="w-full mt-0.5 rounded border border-border bg-secondary/30 px-2 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y min-h-[100px]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Interactions + WhatsApp tabs */}
            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="w-full bg-secondary/50 h-8">
                <TabsTrigger value="timeline" className="flex-1 text-xs h-7">
                  <Mail className="h-3 w-3 mr-1" /> Timeline
                </TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex-1 text-xs h-7">
                  <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                  {(lead as any).total_mensagens_whatsapp > 0 && (
                    <Badge className="ml-1 text-[9px] h-4 px-1 bg-primary/20 text-primary">
                      {(lead as any).total_mensagens_whatsapp}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-3">
                {timeline.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>
                ) : (
                  <div className="relative space-y-0">
                    {/* Vertical line */}
                    <div className="absolute left-3.5 top-4 bottom-0 w-px bg-border" />
                    {timeline.map((ev, idx) => {
                      const icons = {
                        email: <Mail className="h-3.5 w-3.5" />,
                        whatsapp: <MessageSquare className="h-3.5 w-3.5" />,
                        tarefa: <CheckSquare className="h-3.5 w-3.5" />,
                        visita: <MapPin className="h-3.5 w-3.5" />,
                        criacao: <User className="h-3.5 w-3.5" />,
                      };
                      const colors = {
                        email: "bg-blue-500/20 text-blue-500",
                        whatsapp: "bg-green-500/20 text-green-600",
                        tarefa: ev.extra === "concluida" ? "bg-emerald-500/20 text-emerald-600" : "bg-orange-500/20 text-orange-500",
                        visita: ev.extra === "realizada" ? "bg-emerald-500/20 text-emerald-600" : ev.extra === "cancelada" ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary",
                        criacao: "bg-purple-500/20 text-purple-500",
                      };
                      return (
                        <div key={`${ev.id}-${idx}`} className="flex gap-3 pb-4 last:pb-0">
                          <div className={`relative z-10 flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${colors[ev.type]}`}>
                            {icons[ev.type]}
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium leading-tight">{ev.title}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {format(new Date(ev.date), "dd/MM HH:mm")}
                              </span>
                            </div>
                            {ev.subtitle && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{ev.subtitle}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="whatsapp" className="mt-3">
                <WhatsAppTab
                  leadId={lead.id}
                  estagioFonte={(lead as any).estagio_fonte}
                />
              </TabsContent>
            </Tabs>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Anotações Internas</h4>
              <Textarea
                value={anotacoes}
                onChange={(e) => setAnotacoes(e.target.value)}
                placeholder="Adicione anotações sobre este lead..."
                className="text-sm min-h-[80px] bg-secondary/30"
              />
              <Button size="sm" onClick={salvarAnotacoes} className="gradient-primary text-primary-foreground">
                Salvar Anotações
              </Button>
            </div>

            <Separator />

            {/* Delete */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="w-full gap-1.5" disabled={deleting}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Excluindo..." : "Excluir Lead"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir <strong>{lead.nome}</strong>? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteLead} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value, link }: { icon: React.ReactNode; label: string; value: string | null; link?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      {icon}
      <span className="text-foreground">
        {link ? (
          <a href={value.startsWith("http") ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary inline-flex items-center gap-1">
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : value}
      </span>
    </div>
  );
}

function DataBadge({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="bg-secondary/50 rounded p-2">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}

function InteractionBadge({ icon, label, active, success }: { icon: React.ReactNode; label: string; active: boolean; success: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
      success ? "bg-success/20 text-success" : active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
    }`}>
      {icon}
      {label}
    </div>
  );
}
