import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Mail, MessageSquare, Send, Plus, Search, MailCheck, CheckCheck, Calendar, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Comunicacao = Tables<"comunicacoes">;
type Lead = Tables<"leads">;

interface EmailMetrics {
  enviados: number;
  abertos: number;
  respondidos: number;
  taxaConversao: number;
}

interface WhatsAppMetrics {
  enviadas: number;
  respondidas: number;
  reunioes: number;
  taxaResposta: number;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "respondido": return "bg-success/20 text-success";
    case "aberto": return "bg-primary/20 text-primary";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function Comunicacoes() {
  const [comunicacoes, setComunicacoes] = useState<(Comunicacao & { lead?: Lead })[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics>({ enviados: 0, abertos: 0, respondidos: 0, taxaConversao: 0 });
  const [whatsMetrics, setWhatsMetrics] = useState<WhatsAppMetrics>({ enviadas: 0, respondidas: 0, reunioes: 0, taxaResposta: 0 });
  const [novoEmailOpen, setNovoEmailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // New email form state
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [assunto, setAssunto] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [comRes, leadsRes] = await Promise.all([
      supabase.from("comunicacoes").select("*").order("criado_em", { ascending: false }),
      supabase.from("leads").select("*").order("nome"),
    ]);

    const coms = comRes.data || [];
    const allLeads = leadsRes.data || [];
    setLeads(allLeads);

    // Enrich comunicacoes with lead data
    const enriched = coms.map(c => ({
      ...c,
      lead: allLeads.find(l => l.id === c.lead_id),
    }));
    setComunicacoes(enriched);

    // Email metrics
    const emails = coms.filter(c => c.tipo === "email" && c.direcao === "enviado");
    const emailsRespondidos = coms.filter(c => c.tipo === "email" && c.direcao === "recebido");
    const emailsAbertos = emails.filter(c => c.status === "aberto" || c.status === "respondido");
    setEmailMetrics({
      enviados: emails.length,
      abertos: emailsAbertos.length,
      respondidos: emailsRespondidos.length,
      taxaConversao: emails.length > 0 ? Math.round((emailsRespondidos.length / emails.length) * 100) : 0,
    });

    // WhatsApp metrics
    const whats = coms.filter(c => c.tipo === "whatsapp" && c.direcao === "enviado");
    const whatsRespondidos = coms.filter(c => c.tipo === "whatsapp" && c.direcao === "recebido");
    const reunioes = allLeads.filter(l => l.reuniao_agendada && l.whatsapp_enviado).length;
    setWhatsMetrics({
      enviadas: whats.length,
      respondidas: whatsRespondidos.length,
      reunioes,
      taxaResposta: whats.length > 0 ? Math.round((whatsRespondidos.length / whats.length) * 100) : 0,
    });

    setLoading(false);
  }

  async function handleEnviarEmail() {
    if (!selectedLeadId || !assunto || !conteudo) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setSending(true);

    const { error } = await supabase.from("comunicacoes").insert({
      lead_id: selectedLeadId,
      tipo: "email",
      direcao: "enviado",
      assunto,
      conteudo,
      status: "enviado",
    });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      // Mark lead as email_enviado
      await supabase.from("leads").update({ email_enviado: true, data_email_enviado: new Date().toISOString() }).eq("id", selectedLeadId);
      toast({ title: "Email registrado com sucesso" });
      setNovoEmailOpen(false);
      setSelectedLeadId("");
      setAssunto("");
      setConteudo("");
      fetchData();
    }
    setSending(false);
  }

  const emailComs = comunicacoes.filter(c => c.tipo === "email");
  const whatsComs = comunicacoes.filter(c => c.tipo === "whatsapp");

  const filteredEmails = emailComs.filter(c =>
    !searchTerm || c.lead?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lead?.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.assunto?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWhats = whatsComs.filter(c =>
    !searchTerm || c.lead?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lead?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <h1 className="text-2xl font-bold">Comunicações</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 w-60 bg-secondary/30"
            />
          </div>
        </div>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="email" className="gap-1.5"><Mail className="h-4 w-4" />Email</TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5"><MessageSquare className="h-4 w-4" />WhatsApp</TabsTrigger>
        </TabsList>

        {/* EMAIL TAB */}
        <TabsContent value="email" className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard icon={<Send className="h-4 w-4" />} title="Enviados" value={String(emailMetrics.enviados)} />
            <MetricCard icon={<MailCheck className="h-4 w-4" />} title="Abertos" value={String(emailMetrics.abertos)} />
            <MetricCard icon={<CheckCheck className="h-4 w-4" />} title="Respondidos" value={String(emailMetrics.respondidos)} />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} title="Taxa Conversão" value={`${emailMetrics.taxaConversao}%`} />
          </div>

          <div className="flex justify-end">
            <Dialog open={novoEmailOpen} onOpenChange={setNovoEmailOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground gap-1.5">
                  <Plus className="h-4 w-4" /> Novo Email
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Compor Email</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Para (Lead)</Label>
                    <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um lead..." /></SelectTrigger>
                      <SelectContent>
                        {leads.map(l => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.nome} {l.empresa ? `— ${l.empresa}` : ""} ({l.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assunto</Label>
                    <Input value={assunto} onChange={e => setAssunto(e.target.value)} placeholder="Assunto do email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Conteúdo</Label>
                    <Textarea value={conteudo} onChange={e => setConteudo(e.target.value)} placeholder="Escreva o conteúdo do email..." className="min-h-[200px]" />
                  </div>

                  {/* Preview */}
                  {(assunto || conteudo) && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Preview</Label>
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div className="gradient-primary p-4 flex items-center gap-2">
                            <span className="text-white font-bold text-lg">Vision AI</span>
                          </div>
                          <div className="bg-card p-4 space-y-2">
                            <h3 className="font-semibold">{assunto || "Sem assunto"}</h3>
                            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{conteudo || "..."}</div>
                          </div>
                          <div className="bg-secondary/30 px-4 py-3 text-[10px] text-muted-foreground text-center">
                            Vision AI — Inteligência Artificial para o seu negócio
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setNovoEmailOpen(false)}>Cancelar</Button>
                    <Button onClick={handleEnviarEmail} disabled={sending} className="gradient-primary text-primary-foreground gap-1.5">
                      <Send className="h-4 w-4" />
                      {sending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Email List */}
          <Card className="glass-card">
            <CardContent className="p-0">
              {filteredEmails.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Nenhum email registrado.</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredEmails.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{c.lead?.nome || "—"}</p>
                          {c.lead?.empresa && <span className="text-xs text-muted-foreground">— {c.lead.empresa}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.assunto || "Sem assunto"}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <Badge className={`text-[10px] ${getStatusBadge(c.status)}`}>{c.status}</Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(c.criado_em), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WHATSAPP TAB */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard icon={<Send className="h-4 w-4" />} title="Enviadas" value={String(whatsMetrics.enviadas)} />
            <MetricCard icon={<CheckCheck className="h-4 w-4" />} title="Respondidas" value={String(whatsMetrics.respondidas)} />
            <MetricCard icon={<Calendar className="h-4 w-4" />} title="Reuniões via WhatsApp" value={String(whatsMetrics.reunioes)} />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} title="Taxa Resposta" value={`${whatsMetrics.taxaResposta}%`} />
          </div>

          <Card className="glass-card">
            <CardContent className="p-0">
              {filteredWhats.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6">Nenhuma mensagem WhatsApp registrada.</p>
              ) : (
                <div className="divide-y divide-border">
                  {filteredWhats.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{c.lead?.nome || "—"}</p>
                          {c.lead?.empresa && <span className="text-xs text-muted-foreground">— {c.lead.empresa}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate line-clamp-1">{c.conteudo || "—"}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <Badge className={`text-[10px] ${getStatusBadge(c.status)}`}>{c.direcao}</Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(c.criado_em), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-primary">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
