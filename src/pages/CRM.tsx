import { useEffect, useState, useCallback } from "react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCorners,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import KanbanColumn from "@/components/crm/KanbanColumn";
import LeadCard from "@/components/crm/LeadCard";
import LeadDrawer from "@/components/crm/LeadDrawer";
import AddLeadDialog from "@/components/crm/AddLeadDialog";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Users, User, MessageSquare } from "lucide-react";

const FEEDBACK_STAGES = ["proposta_enviada", "fechado", "perdido"];

const RESULTADO_OPTIONS = [
  { value: "interessado_negociacao", label: "Cliente interessado — seguiu para negociação" },
  { value: "contrato_assinado",      label: "Contrato assinado" },
  { value: "nao_converteu_preco",    label: "Não converteu — preço" },
  { value: "nao_converteu_localizacao", label: "Não converteu — localização" },
  { value: "nao_converteu_desistiu", label: "Não converteu — cliente desistiu" },
  { value: "nao_converteu_sem_resposta", label: "Não converteu — sem resposta" },
];

type Lead = Tables<"leads">;

const COLUNAS = [
  { id: "novo_lead", title: "Novo Lead" },
  { id: "contatado", title: "Contatado" },
  { id: "visita_agendada", title: "Visita Agendada" },
  { id: "visita_realizada", title: "Visita Realizada" },
  { id: "proposta_enviada", title: "Proposta Enviada" },
  { id: "negociando", title: "Negociando" },
  { id: "contrato_assinado", title: "Contrato Assinado" },
  { id: "perdido", title: "Perdido" },
];

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [drawerLead, setDrawerLead] = useState<Lead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterMeus, setFilterMeus] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Gatilho 2: feedback modal state
  const [feedbackModal, setFeedbackModal] = useState<{
    leadId: string;
    pendingStatus: string;
    visita: any | null;
  } | null>(null);
  const [feedbackResultado, setFeedbackResultado] = useState("");
  const [feedbackObs, setFeedbackObs] = useState("");
  const [showContratoSugest, setShowContratoSugest] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase.from("leads").select("*").order("criado_em", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel("leads-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLeads]);

  function getLeadsByStatus(status: string) {
    return leads.filter(l => {
      if ((l.status || "novo_lead") !== status) return false;
      if (filterMeus && currentUserId) {
        return (l as any).corretor_responsavel === currentUserId;
      }
      return true;
    });
  }

  function handleDragStart(event: DragStartEvent) {
    const lead = leads.find(l => l.id === event.active.id);
    setActiveLead(lead || null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    // The "over" could be a column id or another lead id
    let newStatus: string | undefined;

    // Check if dropped over a column directly
    const column = COLUNAS.find(c => c.id === over.id);
    if (column) {
      newStatus = column.id;
    } else {
      // Dropped over another lead — find which column that lead is in
      const overLead = leads.find(l => l.id === over.id);
      if (overLead) {
        newStatus = overLead.status || "novo_lead";
      }
    }

    if (!newStatus) return;

    const currentLead = leads.find(l => l.id === leadId);
    if (currentLead && (currentLead.status || "novo_lead") === newStatus) return;

    const needsFeedback = await checkFeedbackNeeded(leadId, newStatus);
    if (needsFeedback) return; // modal will handle the status change

    await applyStatusChange(leadId, newStatus);
  }

  function handleDragOver(event: DragOverEvent) {
    // Optional: could add visual feedback
  }

  function handleLeadClick(lead: Lead) {
    setDrawerLead(lead);
    setDrawerOpen(true);
  }

  async function handleStatusChange(leadId: string, newStatus: string) {
    const needsFeedback = await checkFeedbackNeeded(leadId, newStatus);
    if (needsFeedback) return;
    await applyStatusChange(leadId, newStatus);
  }

  function handleLeadUpdate(updatedLead: Lead) {
    setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
    setDrawerLead(prev => prev && prev.id === updatedLead.id ? updatedLead : prev);
  }

  async function checkFeedbackNeeded(leadId: string, newStatus: string): Promise<boolean> {
    if (!FEEDBACK_STAGES.includes(newStatus)) return false;
    const { data } = await supabase
      .from("agenda_visitas")
      .select("id, imovel:imoveis(titulo, tipo)")
      .eq("lead_id", leadId)
      .eq("status", "realizada")
      .is("feedback_pos_visita", null)
      .limit(1) as any;
    if (data?.length) {
      setFeedbackModal({ leadId, pendingStatus: newStatus, visita: data[0] });
      setFeedbackResultado("");
      setFeedbackObs("");
      setShowContratoSugest(false);
      return true;
    }
    return false;
  }

  async function applyStatusChange(leadId: string, newStatus: string) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    setDrawerLead(prev => prev && prev.id === leadId ? { ...prev, status: newStatus } : prev);
    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
    if (newStatus === "contrato_assinado") {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        const { data: { user } } = await supabase.auth.getUser();
        supabase.functions.invoke("pos-venda-automation", {
          body: { action: "criar_tarefas", user_id: user?.id, lead_id: leadId, lead_nome: lead.nome, corretor_id: (lead as any).corretor_responsavel },
        }).catch(() => {});
      }
    }
  }

  async function handleFeedbackSave() {
    if (!feedbackModal) return;
    setSavingFeedback(true);
    // Save feedback to the visit
    if (feedbackModal.visita) {
      await supabase.from("agenda_visitas").update({
        feedback_pos_visita: feedbackObs || feedbackResultado,
        interesse_apos_visita: feedbackResultado,
      }).eq("id", feedbackModal.visita.id);
    }
    await applyStatusChange(feedbackModal.leadId, feedbackModal.pendingStatus);
    setSavingFeedback(false);
    if (feedbackResultado === "contrato_assinado") {
      setShowContratoSugest(true);
    } else {
      setFeedbackModal(null);
    }
  }

  async function handleFeedbackSkip() {
    if (!feedbackModal) return;
    // Create a reminder notification
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notificacoes").insert({
        user_id: user.id,
        tipo: "lembrete_feedback",
        titulo: "Lembre de atualizar a visita",
        descricao: "Você avançou um lead sem registrar o feedback da visita.",
        link: "/agenda",
        lida: false,
        metadata: feedbackModal.visita ? { visita_id: feedbackModal.visita.id } : {},
      } as any);
    }
    await applyStatusChange(feedbackModal.leadId, feedbackModal.pendingStatus);
    setFeedbackModal(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">CRM — Pipeline de Leads</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-md">
            <Button
              variant={!filterMeus ? "secondary" : "ghost"}
              size="sm"
              className="text-xs gap-1.5 rounded-r-none"
              onClick={() => setFilterMeus(false)}
            >
              <Users className="h-3.5 w-3.5" /> Todos
            </Button>
            <Button
              variant={filterMeus ? "secondary" : "ghost"}
              size="sm"
              className="text-xs gap-1.5 rounded-l-none"
              onClick={() => setFilterMeus(true)}
            >
              <User className="h-3.5 w-3.5" /> Meus Leads
            </Button>
          </div>
          <AddLeadDialog />
        </div>
      </div>

      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="flex gap-3 min-w-max">
            {COLUNAS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                leads={getLeadsByStatus(col.id)}
                onLeadClick={handleLeadClick}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead ? (
              <div className="opacity-90 rotate-2">
                <LeadCard lead={activeLead} onClick={() => {}} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadDrawer
        lead={drawerLead}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onStatusChange={handleStatusChange}
        onLeadUpdate={handleLeadUpdate}
        onLeadDelete={(leadId) => {
          setLeads(prev => prev.filter(l => l.id !== leadId));
          setDrawerOpen(false);
        }}
      />

      {/* Gatilho 2: Feedback obrigatório */}
      <Dialog open={!!feedbackModal && !showContratoSugest} onOpenChange={(open) => { if (!open) setFeedbackModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Como foi a visita?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {feedbackModal?.visita && (
              <p className="text-sm text-muted-foreground">
                Antes de avançar, registre o resultado da visita ao{" "}
                <span className="font-medium text-foreground">
                  {feedbackModal.visita.imovel?.titulo || feedbackModal.visita.imovel?.tipo || "imóvel"}
                </span>{" "}
                com este cliente.
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Resultado da visita</Label>
              <Select value={feedbackResultado} onValueChange={setFeedbackResultado}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {RESULTADO_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea
                value={feedbackObs}
                onChange={e => setFeedbackObs(e.target.value)}
                rows={2}
                placeholder="Detalhes adicionais sobre a visita..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleFeedbackSkip}>
              Pular por agora
            </Button>
            <Button size="sm" onClick={handleFeedbackSave} disabled={savingFeedback || !feedbackResultado}>
              {savingFeedback ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sugestão de criar contrato */}
      <Dialog open={showContratoSugest} onOpenChange={setShowContratoSugest}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Contrato assinado! 🎉</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Deseja registrar o contrato agora?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowContratoSugest(false); setFeedbackModal(null); }}>
              Agora não
            </Button>
            <Button size="sm" onClick={() => { setShowContratoSugest(false); setFeedbackModal(null); window.location.href = "/contratos"; }}>
              Sim, criar contrato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
