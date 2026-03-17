import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, LayoutGrid, List, CheckCircle2, Circle, Clock, AlertTriangle, Heart } from "lucide-react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCorners } from "@dnd-kit/core";
import { format, isPast, isToday, addDays, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TarefaKanbanColumn } from "@/components/tarefas/TarefaKanbanColumn";
import { TarefaCard } from "@/components/tarefas/TarefaCard";
import { TarefaDialog } from "@/components/tarefas/TarefaDialog";
import { TarefaListItem } from "@/components/tarefas/TarefaListItem";

export interface Tarefa {
  id: string;
  user_id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  data_vencimento: string | null;
  lead_id: string | null;
  contrato_id: string | null;
  concluida: boolean;
  categoria?: string | null;
  criado_em: string;
  atualizado_em: string;
  lead_nome?: string;
  contrato_nome?: string;
}

const COLUNAS = [
  { id: "a_fazer", titulo: "A Fazer", icon: Circle, cor: "text-muted-foreground" },
  { id: "fazendo", titulo: "Fazendo", icon: Clock, cor: "text-warning" },
  { id: "feito", titulo: "Feito", icon: CheckCircle2, cor: "text-success" },
];

export default function Tarefas() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarefa, setEditingTarefa] = useState<Tarefa | null>(null);
  const [activeTarefa, setActiveTarefa] = useState<Tarefa | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const fetchTarefas = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setLoading(false); return; }

    const { data } = await supabase
      .from("tarefas")
      .select("*")
      .eq("user_id", user.user.id)
      .order("criado_em", { ascending: false });

    if (data) {
      // Enrich with lead/contrato names
      const leadIds = [...new Set(data.filter(t => t.lead_id).map(t => t.lead_id!))];
      const contratoIds = [...new Set(data.filter(t => t.contrato_id).map(t => t.contrato_id!))];

      let leadsMap: Record<string, string> = {};
      let contratosMap: Record<string, string> = {};

      if (leadIds.length > 0) {
        const { data: leads } = await supabase.from("leads").select("id, nome").in("id", leadIds);
        if (leads) leadsMap = Object.fromEntries(leads.map(l => [l.id, l.nome]));
      }
      if (contratoIds.length > 0) {
        const { data: contratos } = await supabase.from("contratos").select("id, cliente_nome").in("id", contratoIds);
        if (contratos) contratosMap = Object.fromEntries(contratos.map(c => [c.id, c.cliente_nome]));
      }

      setTarefas(data.map(t => ({
        ...t,
        lead_nome: t.lead_id ? leadsMap[t.lead_id] : undefined,
        contrato_nome: t.contrato_id ? contratosMap[t.contrato_id] : undefined,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTarefas();
  }, [fetchTarefas]);

  const handleDragStart = (event: DragStartEvent) => {
    const tarefa = tarefas.find(t => t.id === event.active.id);
    setActiveTarefa(tarefa || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTarefa(null);
    const { active, over } = event;
    if (!over) return;

    const tarefaId = active.id as string;
    const newStatus = over.id as string;
    const tarefa = tarefas.find(t => t.id === tarefaId);
    if (!tarefa || tarefa.status === newStatus) return;

    const concluida = newStatus === "feito";
    setTarefas(prev => prev.map(t => t.id === tarefaId ? { ...t, status: newStatus, concluida } : t));
    await supabase.from("tarefas").update({ status: newStatus, concluida }).eq("id", tarefaId);
  };

  const handleToggleConcluida = async (tarefa: Tarefa) => {
    const newConcluida = !tarefa.concluida;
    const newStatus = newConcluida ? "feito" : "a_fazer";
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? { ...t, concluida: newConcluida, status: newStatus } : t));
    await supabase.from("tarefas").update({ concluida: newConcluida, status: newStatus }).eq("id", tarefa.id);
  };

  const handleDelete = async (id: string) => {
    setTarefas(prev => prev.filter(t => t.id !== id));
    await supabase.from("tarefas").delete().eq("id", id);
  };

  const handleEdit = (tarefa: Tarefa) => {
    setEditingTarefa(tarefa);
    setDialogOpen(true);
  };

  const handleNew = () => {
    setEditingTarefa(null);
    setDialogOpen(true);
  };

  const getTarefasByStatus = (status: string, categoria?: string) =>
    tarefas.filter(t => t.status === status && (!categoria || t.categoria === categoria));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendentes = tarefas.filter(t => !t.concluida);
  const atrasadas = pendentes.filter(t => t.data_vencimento && isPast(new Date(t.data_vencimento + "T23:59:59")) && !isToday(new Date(t.data_vencimento + "T00:00:00")));
  const hojeCount = pendentes.filter(t => t.data_vencimento && isToday(new Date(t.data_vencimento + "T00:00:00"))).length;
  const posVendaCount = tarefas.filter(t => t.categoria === "pos_venda" && !t.concluida).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tarefas</h1>
          <div className="flex gap-3 mt-1">
            {atrasadas.length > 0 && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {atrasadas.length} atrasada(s)
              </span>
            )}
            {hojeCount > 0 && (
              <span className="text-xs text-warning flex items-center gap-1">
                <Clock className="h-3 w-3" /> {hojeCount} para hoje
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-border rounded-md">
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="icon" onClick={() => setView("kanban")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" onClick={() => setView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova Tarefa
          </Button>
        </div>
      </div>

      <Tabs defaultValue="geral">
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="pos_venda" className="gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            Pós-Venda
            {posVendaCount > 0 && (
              <Badge className="ml-1 text-[9px] h-4 px-1 bg-pink-500/20 text-pink-600 border-pink-500/20">
                {posVendaCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Geral ── */}
        <TabsContent value="geral" className="mt-4">
          {view === "kanban" ? (
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {COLUNAS.map(col => (
                  <TarefaKanbanColumn
                    key={col.id}
                    coluna={col}
                    tarefas={tarefas.filter(t => t.status === col.id && t.categoria !== "pos_venda")}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggle={handleToggleConcluida}
                  />
                ))}
              </div>
              <DragOverlay>
                {activeTarefa ? <TarefaCard tarefa={activeTarefa} onEdit={() => {}} onDelete={() => {}} onToggle={() => {}} isDragging /> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-4 space-y-1">
                {tarefas.filter(t => t.categoria !== "pos_venda").length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma tarefa criada ainda.</p>
                ) : (
                  tarefas.filter(t => t.categoria !== "pos_venda").map(t => (
                    <TarefaListItem key={t.id} tarefa={t} onToggle={handleToggleConcluida} onEdit={handleEdit} onDelete={handleDelete} />
                  ))
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Aba Pós-Venda ── */}
        <TabsContent value="pos_venda" className="mt-4 space-y-4">
          <div className="flex items-start gap-3 bg-pink-500/5 border border-pink-500/20 rounded-lg p-4">
            <Heart className="h-4 w-4 text-pink-500 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Régua de Relacionamento Pós-Venda</p>
              <p>Tarefas criadas automaticamente ao fechar um contrato: D+1, D+7, D+30, D+90, D+180 e D+365.</p>
              <p>Mantenha o relacionamento ativo para gerar indicações e novas oportunidades.</p>
            </div>
          </div>

          {tarefas.filter(t => t.categoria === "pos_venda").length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-10 text-center text-muted-foreground">
                <Heart className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Nenhuma tarefa pós-venda ainda.</p>
                <p className="text-xs mt-1">Mova um lead para "Contrato Assinado" no CRM para gerar a régua automaticamente.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {/* Group by lead */}
              {Array.from(
                new Set(tarefas.filter(t => t.categoria === "pos_venda").map(t => t.lead_nome || t.lead_id || "—"))
              ).map(leadNome => {
                const leadTarefas = tarefas.filter(
                  t => t.categoria === "pos_venda" && (t.lead_nome || t.lead_id || "—") === leadNome
                ).sort((a, b) => (a.data_vencimento || "").localeCompare(b.data_vencimento || ""));
                const done = leadTarefas.filter(t => t.concluida).length;
                const progress = Math.round((done / leadTarefas.length) * 100);

                return (
                  <Card key={leadNome} className="bg-card border-border">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">{leadNome}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {done}/{leadTarefas.length} concluídas · {progress}%
                        </Badge>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full mt-2">
                        <div
                          className="h-1.5 bg-pink-500 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-1.5">
                      {leadTarefas.map(t => (
                        <TarefaListItem
                          key={t.id}
                          tarefa={t}
                          onToggle={handleToggleConcluida}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <TarefaDialog open={dialogOpen} onOpenChange={setDialogOpen} tarefa={editingTarefa} onSaved={fetchTarefas} />
    </div>
  );
}
