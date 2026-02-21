import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, MailCheck, MessageSquare, CheckCheck, ExternalLink, Calendar, Building2, User, Globe, Linkedin, Sparkles, Loader2, Send } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

const COLUNAS = [
  { value: "novo", label: "Novo" },
  { value: "enriquecido", label: "Enriquecido" },
  { value: "contatado", label: "Contatado" },
  { value: "qualificado", label: "Qualificado" },
  { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
];

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
}

export default function LeadDrawer({ lead, open, onClose, onStatusChange }: LeadDrawerProps) {
  const [anotacoes, setAnotacoes] = useState("");
  const [comunicacoes, setComunicacoes] = useState<Tables<"comunicacoes">[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ assunto: string; conteudo: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (lead) {
      setAnotacoes(lead.mensagem_original || "");
      setEmailDraft(null);
      fetchComunicacoes(lead.id);
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

  async function salvarAnotacoes() {
    if (!lead) return;
    await supabase.from("leads").update({ mensagem_original: anotacoes }).eq("id", lead.id);
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
        toast({ title: "Lead enriquecido com sucesso!", description: `Site: ${data.sources?.site_scraped ? "✓" : "✗"} | Busca: ${data.sources?.search_done ? "✓" : "✗"} | LinkedIn: ${data.sources?.linkedin_scraped ? "✓" : "✗"}` });
        onStatusChange(lead.id, "enriquecido");
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

            {/* Move column */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Mover para</label>
              <Select value={lead.status || "novo"} onValueChange={(v) => onStatusChange(lead.id, v)}>
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
                <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Cargo" value={lead.linkedin_cargo} />
              </div>
            </div>

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

              {/* Email Draft Preview */}
              {emailDraft && (
                <div className="rounded-lg border border-primary/30 overflow-hidden mt-2">
                  <div className="bg-primary/10 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-primary">Rascunho de Email</span>
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
                  <div className="p-3 space-y-1 text-xs">
                    <p className="font-medium">{emailDraft.assunto}</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{emailDraft.conteudo}</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Timeline de Interações</h4>
              {comunicacoes.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma interação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {comunicacoes.map(c => (
                    <div key={c.id} className="bg-secondary/30 rounded p-2 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{c.tipo} — {c.direcao}</Badge>
                        <span className="text-muted-foreground">{format(new Date(c.criado_em), "dd/MM HH:mm")}</span>
                      </div>
                      {c.assunto && <p className="font-medium">{c.assunto}</p>}
                      {c.conteudo && <p className="text-muted-foreground line-clamp-2">{c.conteudo}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

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
