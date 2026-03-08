import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Mail, MessageSquare, Send, Plus, Search, MailCheck, CheckCheck, Calendar, TrendingUp, Clock, ArrowUpRight, ArrowDownLeft, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { EmailComposeDialog } from "@/components/comunicacoes/EmailComposeDialog";
import { ComunicacaoDrawer } from "@/components/comunicacoes/ComunicacaoDrawer";

type Comunicacao = Tables<"comunicacoes">;
type Lead = Tables<"leads">;
type EnrichedCom = Comunicacao & { lead?: Lead };

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

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return `Hoje, ${format(date, "HH:mm")}`;
  if (isYesterday(date)) return `Ontem, ${format(date, "HH:mm")}`;
  return format(date, "dd/MM/yyyy HH:mm");
}

function groupByDate(items: EnrichedCom[]): Record<string, EnrichedCom[]> {
  const groups: Record<string, EnrichedCom[]> = {};
  items.forEach(item => {
    const date = new Date(item.criado_em);
    let key: string;
    if (isToday(date)) key = "Hoje";
    else if (isYesterday(date)) key = "Ontem";
    else key = format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

export default function Comunicacoes() {
  const [comunicacoes, setComunicacoes] = useState<EnrichedCom[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailMetrics, setEmailMetrics] = useState<EmailMetrics>({ enviados: 0, abertos: 0, respondidos: 0, taxaConversao: 0 });
  const [whatsMetrics, setWhatsMetrics] = useState<WhatsAppMetrics>({ enviadas: 0, respondidas: 0, reunioes: 0, taxaResposta: 0 });
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCom, setSelectedCom] = useState<EnrichedCom | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");
  const { toast } = useToast();

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

  function handleOpenDetail(com: EnrichedCom) {
    setSelectedCom(com);
    setDrawerOpen(true);
  }

  const filterItems = (items: EnrichedCom[]) =>
    items.filter(c =>
      !searchTerm ||
      c.lead?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lead?.empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.assunto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.conteudo?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const emailComs = filterItems(comunicacoes.filter(c => c.tipo === "email"));
  const whatsComs = filterItems(comunicacoes.filter(c => c.tipo === "whatsapp"));
  const allFiltered = filterItems(comunicacoes);

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
          <Button onClick={() => setComposeOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Email
          </Button>
        </div>
      </div>

      <Tabs defaultValue="email" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="email" className="gap-1.5"><Mail className="h-4 w-4" />Email</TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-1.5"><MessageSquare className="h-4 w-4" />WhatsApp</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-1.5"><History className="h-4 w-4" />Timeline</TabsTrigger>
          </TabsList>
        </div>

        {/* EMAIL TAB */}
        <TabsContent value="email" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard icon={<Send className="h-4 w-4" />} title="Enviados" value={String(emailMetrics.enviados)} />
            <MetricCard icon={<MailCheck className="h-4 w-4" />} title="Abertos" value={String(emailMetrics.abertos)} />
            <MetricCard icon={<CheckCheck className="h-4 w-4" />} title="Respondidos" value={String(emailMetrics.respondidos)} />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} title="Taxa Conversão" value={`${emailMetrics.taxaConversao}%`} />
          </div>

          <CommunicationList items={emailComs} onSelect={handleOpenDetail} type="email" />
        </TabsContent>

        {/* WHATSAPP TAB */}
        <TabsContent value="whatsapp" className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard icon={<Send className="h-4 w-4" />} title="Enviadas" value={String(whatsMetrics.enviadas)} />
            <MetricCard icon={<CheckCheck className="h-4 w-4" />} title="Respondidas" value={String(whatsMetrics.respondidas)} />
            <MetricCard icon={<Calendar className="h-4 w-4" />} title="Reuniões" value={String(whatsMetrics.reunioes)} />
            <MetricCard icon={<TrendingUp className="h-4 w-4" />} title="Taxa Resposta" value={`${whatsMetrics.taxaResposta}%`} />
          </div>

          <CommunicationList items={whatsComs} onSelect={handleOpenDetail} type="whatsapp" />
        </TabsContent>

        {/* TIMELINE TAB */}
        <TabsContent value="timeline" className="space-y-4">
          <TimelineView items={allFiltered} onSelect={handleOpenDetail} />
        </TabsContent>
      </Tabs>

      <EmailComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        leads={leads}
        onSent={fetchData}
      />

      <ComunicacaoDrawer
        comunicacao={selectedCom}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

// --- Sub-components ---

function MetricCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <Card className="bg-card border-border">
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

function CommunicationList({ items, onSelect, type }: { items: EnrichedCom[]; onSelect: (c: EnrichedCom) => void; type: string }) {
  if (items.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            {type === "email" ? "Nenhum email registrado." : "Nenhuma mensagem WhatsApp registrada."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {items.map(c => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {c.direcao === "enviado" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                  </div>
                  <p className="text-sm font-medium truncate">{c.lead?.nome || "—"}</p>
                  {c.lead?.empresa && <span className="text-xs text-muted-foreground">— {c.lead.empresa}</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate ml-5">
                  {type === "email" ? (c.assunto || "Sem assunto") : (c.conteudo || "—")}
                </p>
              </div>
              <div className="flex items-center gap-3 ml-4">
                <Badge className={`text-[10px] ${getStatusBadge(c.status)}`}>
                  {c.status}
                </Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatRelativeDate(c.criado_em)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineView({ items, onSelect }: { items: EnrichedCom[]; onSelect: (c: EnrichedCom) => void }) {
  const grouped = groupByDate(items);
  const dateKeys = Object.keys(grouped);

  if (items.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Nenhuma comunicação registrada.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dateKeys.map(dateKey => (
        <div key={dateKey}>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground">{dateKey}</h3>
          </div>
          <div className="relative ml-2 border-l-2 border-border pl-6 space-y-3">
            {grouped[dateKey].map(c => (
              <button
                key={c.id}
                onClick={() => onSelect(c)}
                className="relative w-full text-left rounded-lg border border-border bg-card p-3 hover:bg-secondary/20 transition-colors"
              >
                {/* Timeline dot */}
                <div className="absolute -left-[31px] top-4 h-3 w-3 rounded-full border-2 border-border bg-primary" />

                <div className="flex items-center gap-2 mb-1">
                  {c.tipo === "email" ? (
                    <Mail className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <span className="text-xs font-medium">
                    {c.tipo === "email" ? "Email" : "WhatsApp"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {c.direcao === "enviado" ? "→" : "←"} {c.lead?.nome || "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {format(new Date(c.criado_em), "HH:mm")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {c.assunto || c.conteudo || "Sem conteúdo"}
                </p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
