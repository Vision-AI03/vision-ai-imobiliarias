import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Calendar, ChevronLeft, ChevronRight, Plus, MapPin, User, Clock, CheckCircle2, XCircle, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCorretores } from "@/hooks/useCorretores";

interface Visita {
  id: string;
  lead_id: string | null;
  imovel_id: string | null;
  corretor_id: string | null;
  data_visita: string;
  hora_visita: string;
  duracao_minutos: number;
  status: string;
  tipo: string;
  observacoes: string | null;
  feedback_pos_visita: string | null;
  interesse_apos_visita: string | null;
  created_at: string;
  lead?: { nome: string; telefone: string | null } | null;
  imovel?: { titulo: string | null; endereco: string | null; bairro: string | null; tipo: string } | null;
  corretor?: { nome: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  agendada: { label: "Agendada", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Clock },
  confirmada: { label: "Confirmada", color: "bg-green-500/15 text-green-600 border-green-500/30", icon: CheckCircle2 },
  realizada: { label: "Realizada", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", color: "bg-red-500/15 text-red-600 border-red-500/30", icon: XCircle },
  "no-show": { label: "No-show", color: "bg-gray-500/15 text-gray-500 border-gray-300", icon: AlertCircle },
};

const INTERESSE_OPTIONS = [
  "muito interessado",
  "interessado",
  "pouco interessado",
  "nao gostou",
];

export default function Agenda() {
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<"mes" | "dia">("mes");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [editingVisita, setEditingVisita] = useState<Visita | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { corretores } = useCorretores();

  // Edit & delete state
  const [editVisitaId, setEditVisitaId] = useState<string | null>(null);
  const [deleteVisitaId, setDeleteVisitaId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Leads for autocomplete
  const [leads, setLeads] = useState<{ id: string; nome: string; telefone: string | null }[]>([]);
  const [imoveis, setImoveis] = useState<{ id: string; titulo: string | null; endereco: string | null; tipo: string }[]>([]);

  const [form, setForm] = useState({
    lead_id: "",
    imovel_id: "",
    corretor_id: "",
    data_visita: "",
    hora_visita: "",
    duracao_minutos: "60",
    tipo: "presencial",
    observacoes: "",
  });

  const [feedback, setFeedback] = useState({
    status: "",
    interesse_apos_visita: "",
    feedback_pos_visita: "",
  });

  const fetchVisitas = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

    const { data } = await supabase
      .from("agenda_visitas")
      .select("*, lead:leads(nome, telefone), imovel:imoveis(titulo, endereco, bairro, tipo), corretor:corretores(nome)")
      .eq("user_id", userData.user.id)
      .gte("data_visita", start)
      .lte("data_visita", end)
      .order("data_visita")
      .order("hora_visita");

    setVisitas((data as unknown as Visita[]) || []);
    setLoading(false);
  }, [currentMonth, userId]);

  useEffect(() => {
    fetchVisitas();
  }, [fetchVisitas]);

  useEffect(() => {
    if (!userId) return;
    const fetchLeadsImoveis = async () => {
      const [{ data: leadsData }, { data: imoveisData }] = await Promise.all([
        supabase.from("leads").select("id, nome, telefone").order("nome").limit(200),
        supabase.from("imoveis").select("id, titulo, endereco, tipo").eq("user_id", userId).eq("status", "disponivel").order("created_at", { ascending: false }).limit(200),
      ]);
      setLeads((leadsData as any) || []);
      setImoveis((imoveisData as any) || []);
    };
    fetchLeadsImoveis();
  }, [userId]);

  const openCreate = (day?: Date) => {
    setEditVisitaId(null);
    setForm({
      lead_id: "",
      imovel_id: "",
      corretor_id: "",
      data_visita: day ? format(day, "yyyy-MM-dd") : "",
      hora_visita: "",
      duracao_minutos: "60",
      tipo: "presencial",
      observacoes: "",
    });
    setDialogOpen(true);
  };

  const openEdit = (visita: Visita) => {
    setEditVisitaId(visita.id);
    setForm({
      lead_id: visita.lead_id || "",
      imovel_id: visita.imovel_id || "",
      corretor_id: visita.corretor_id || "",
      data_visita: visita.data_visita,
      hora_visita: visita.hora_visita?.slice(0, 5) || "",
      duracao_minutos: String(visita.duracao_minutos || 60),
      tipo: visita.tipo || "presencial",
      observacoes: visita.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.data_visita || !form.hora_visita) {
      toast.error("Data e hora são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const editPayload = {
        lead_id: form.lead_id || null,
        imovel_id: form.imovel_id || null,
        corretor_id: form.corretor_id || null,
        data_visita: form.data_visita,
        hora_visita: form.hora_visita,
        duracao_minutos: parseInt(form.duracao_minutos) || 60,
        tipo: form.tipo,
        observacoes: form.observacoes || null,
      };

      if (editVisitaId) {
        const { error } = await supabase
          .from("agenda_visitas")
          .update(editPayload)
          .eq("id", editVisitaId);
        if (error) throw error;
        toast.success("Visita atualizada!");
        setEditVisitaId(null);
      } else {
        const insertPayload = {
          ...editPayload,
          user_id: userData.user.id,
          status: "agendada",
        };
        const { error } = await supabase.from("agenda_visitas").insert(insertPayload);
        if (error) throw error;
        toast.success("Visita agendada!");

        // Sync: advance lead to visita_agendada if still in early stage
        if (editPayload.lead_id) {
          await supabase
            .from("leads")
            .update({ status: "visita_agendada" } as any)
            .eq("id", editPayload.lead_id)
            .in("status", ["novo_lead", "contatado"]);
        }
      }

      setDialogOpen(false);
      fetchVisitas();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar visita.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVisita = async () => {
    if (!deleteVisitaId) return;
    const { error } = await supabase.from("agenda_visitas").delete().eq("id", deleteVisitaId);
    if (error) { toast.error("Erro ao excluir visita."); }
    else { toast.success("Visita excluída."); fetchVisitas(); }
    setDeleteVisitaId(null);
  };

  const handleFeedback = async () => {
    if (!editingVisita || !feedback.status) {
      toast.error("Informe o status da visita.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agenda_visitas")
        .update({
          status: feedback.status,
          interesse_apos_visita: feedback.interesse_apos_visita || null,
          feedback_pos_visita: feedback.feedback_pos_visita || null,
        })
        .eq("id", editingVisita.id);

      if (error) throw error;

      // Atualizar estágio do lead automaticamente
      if (editingVisita.lead_id) {
        let novoEstagio: string | null = null;
        if (feedback.interesse_apos_visita === "muito interessado") novoEstagio = "proposta_enviada";
        else if (feedback.interesse_apos_visita === "nao gostou") novoEstagio = "perdido";
        else novoEstagio = "visita_realizada";

        if (novoEstagio) {
          await supabase.from("leads").update({ status: novoEstagio } as any).eq("id", editingVisita.lead_id);
        }
      }

      // Incrementar contador de visitas no imóvel
      if (feedback.status === "realizada" && editingVisita.imovel_id) {
        await supabase.rpc("increment_visitas_count" as any, { imovel_id: editingVisita.imovel_id });
      }

      toast.success("Feedback registrado!");
      setFeedbackDialogOpen(false);
      fetchVisitas();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar feedback.");
    } finally {
      setSaving(false);
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getVisitasForDay = (day: Date) =>
    visitas.filter((v) => isSameDay(parseISO(v.data_visita), day));

  const visitasHoje = visitas.filter((v) => isSameDay(parseISO(v.data_visita), new Date()));

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Agenda de Visitas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {visitas.length} visita{visitas.length !== 1 ? "s" : ""} neste mês
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              setCurrentMonth(today);
              setSelectedDay(today);
              setView("dia");
            }}
          >
            Hoje
          </Button>
          {view === "dia" && (
            <Button variant="ghost" size="sm" onClick={() => setView("mes")}>
              Ver Mês
            </Button>
          )}
          <Button onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Visita
          </Button>
        </div>
      </div>

      {/* Visitas de hoje */}
      {visitasHoje.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Visitas de Hoje ({visitasHoje.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {visitasHoje.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{v.hora_visita?.slice(0, 5) ?? "--:--"}</span>
                  <span>{v.lead?.nome || "Lead não vinculado"}</span>
                  {v.imovel && (
                    <span className="text-muted-foreground text-xs">
                      · {v.imovel.endereco || v.imovel.tipo}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[v.status]?.color}`}>
                    {STATUS_CONFIG[v.status]?.label}
                  </Badge>
                  {v.status === "agendada" || v.status === "confirmada" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => {
                        setEditingVisita(v);
                        setFeedback({ status: "realizada", interesse_apos_visita: "", feedback_pos_visita: "" });
                        setFeedbackDialogOpen(true);
                      }}
                    >
                      Registrar feedback
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Calendário */}
      {loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card>
          <CardContent className="p-4">
            {/* Navegação do mês */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((m) => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold capitalize">
                {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth((m) => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Grid de dias */}
            <div className="grid grid-cols-7 gap-1">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">
                  {d}
                </div>
              ))}

              {/* Dias vazios antes do primeiro dia */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {days.map((day) => {
                const dayVisitas = getVisitasForDay(day);
                const isSelected = selectedDay && isSameDay(day, selectedDay);

                return (
                  <div
                    key={day.toISOString()}
                    className={`min-h-[72px] p-1 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      isToday(day) ? "border-primary bg-primary/5" : "border-transparent"
                    } ${isSelected ? "bg-muted" : ""}`}
                    onClick={() => {
                      setSelectedDay(day);
                      setView("dia");
                    }}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday(day) ? "text-primary" : "text-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayVisitas.slice(0, 3).map((v) => (
                        <Popover key={v.id}>
                          <PopoverTrigger asChild>
                            <div
                              className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer ${STATUS_CONFIG[v.status]?.color || "bg-blue-500/15 text-blue-600"}`}
                              onClick={(e) => { e.stopPropagation(); setSelectedDay(day); setView("dia"); }}
                            >
                              {v.hora_visita?.slice(0, 5) ?? "--:--"} {v.lead?.nome?.split(" ")[0] || "Visita"}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
                            <div className="space-y-2">
                              <p className="font-bold text-sm">{v.lead?.nome || "Lead não vinculado"}</p>
                              {v.imovel && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {v.imovel.titulo || v.imovel.tipo}
                                  {v.imovel.endereco ? ` · ${v.imovel.endereco}` : ""}
                                </p>
                              )}
                              {v.corretor && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {v.corretor.nome}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {v.data_visita} {v.hora_visita?.slice(0, 5) ?? "--:--"}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">Tipo: {v.tipo}</p>
                              <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[v.status]?.color}`}>
                                {STATUS_CONFIG[v.status]?.label}
                              </Badge>
                              {v.observacoes && (
                                <p className="text-xs italic text-muted-foreground">{v.observacoes}</p>
                              )}
                              <div className="flex items-center gap-1 pt-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => openEdit(v)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive hover:text-destructive"
                                  onClick={() => setDeleteVisitaId(v.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                                  Excluir
                                </Button>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      ))}
                      {dayVisitas.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">
                          +{dayVisitas.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Painel do dia selecionado */}
      {selectedDay && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>
                {format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </span>
              <Button size="sm" variant="outline" onClick={() => openCreate(selectedDay)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Agendar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {getVisitasForDay(selectedDay).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma visita agendada para este dia.
              </p>
            ) : (
              getVisitasForDay(selectedDay).map((v) => (
                <VisitaCard
                  key={v.id}
                  visita={v}
                  onFeedback={() => {
                    setEditingVisita(v);
                    setFeedback({
                      status: v.status === "agendada" ? "realizada" : v.status,
                      interesse_apos_visita: v.interesse_apos_visita || "",
                      feedback_pos_visita: v.feedback_pos_visita || "",
                    });
                    setFeedbackDialogOpen(true);
                  }}
                  onEdit={(visita) => openEdit(visita)}
                  onDelete={(id) => setDeleteVisitaId(id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialog nova / editar visita */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditVisitaId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editVisitaId ? "Editar Visita" : "Agendar Visita"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Lead</Label>
              <Select value={form.lead_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, lead_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o lead..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem lead vinculado</SelectItem>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Imóvel</Label>
              <Select value={form.imovel_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, imovel_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o imóvel..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem imóvel vinculado</SelectItem>
                  {imoveis.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.titulo || i.tipo} — {i.endereco || "Sem endereço"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Corretor</Label>
              <Select value={form.corretor_id || "__none__"} onValueChange={(v) => setForm((f) => ({ ...f, corretor_id: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem corretor</SelectItem>
                  {corretores.filter((c) => c.ativo).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data *</Label>
                <Input
                  type="date"
                  value={form.data_visita}
                  onChange={(e) => setForm((f) => ({ ...f, data_visita: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hora *</Label>
                <Input
                  type="time"
                  value={form.hora_visita}
                  onChange={(e) => setForm((f) => ({ ...f, hora_visita: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duração (min)</Label>
                <Input
                  type="number"
                  value={form.duracao_minutos}
                  onChange={(e) => setForm((f) => ({ ...f, duracao_minutos: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="presencial">Presencial</SelectItem>
                    <SelectItem value="virtual">Virtual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                rows={2}
                placeholder="Informações adicionais..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditVisitaId(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editVisitaId ? "Salvar alterações" : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog feedback */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Feedback da Visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Status da Visita *</Label>
              <Select value={feedback.status} onValueChange={(v) => setFeedback((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="realizada">Realizada</SelectItem>
                  <SelectItem value="confirmada">Confirmada</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                  <SelectItem value="no-show">No-show (não compareceu)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {feedback.status === "realizada" && (
              <div className="space-y-1">
                <Label>Interesse do Lead após a Visita</Label>
                <Select
                  value={feedback.interesse_apos_visita}
                  onValueChange={(v) => setFeedback((f) => ({ ...f, interesse_apos_visita: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {INTERESSE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o} className="capitalize">{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  "Muito interessado" → avança para Proposta · "Não gostou" → vai para Perdido
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Feedback livre</Label>
              <Textarea
                value={feedback.feedback_pos_visita}
                onChange={(e) => setFeedback((f) => ({ ...f, feedback_pos_visita: e.target.value }))}
                rows={3}
                placeholder="O que o lead achou do imóvel, objeções levantadas..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeedbackDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleFeedback} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog confirmação de exclusão */}
      <AlertDialog open={!!deleteVisitaId} onOpenChange={(open) => { if (!open) setDeleteVisitaId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A visita será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteVisita} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function VisitaCard({
  visita,
  onFeedback,
  onEdit,
  onDelete,
}: {
  visita: Visita;
  onFeedback: () => void;
  onEdit: (visita: Visita) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[visita.status] || STATUS_CONFIG.agendada;
  const Icon = cfg.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex flex-col items-center">
        <span className="font-semibold text-sm">{visita.hora_visita?.slice(0, 5) ?? "--:--"}</span>
        <span className="text-xs text-muted-foreground">{visita.duracao_minutos}min</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{visita.lead?.nome || "Lead não vinculado"}</span>
          <Badge variant="outline" className={`text-xs ${cfg.color}`}>
            <Icon className="h-3 w-3 mr-1" />
            {cfg.label}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">{visita.tipo}</Badge>
        </div>

        {visita.imovel && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {visita.imovel.titulo || visita.imovel.tipo}
            {visita.imovel.endereco ? ` · ${visita.imovel.endereco}` : ""}
          </p>
        )}

        {visita.corretor && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3" />
            {visita.corretor.nome}
          </p>
        )}

        {visita.observacoes && (
          <p className="text-xs text-muted-foreground mt-1 italic">{visita.observacoes}</p>
        )}

        {visita.feedback_pos_visita && (
          <p className="text-xs bg-muted rounded px-2 py-1 mt-1">{visita.feedback_pos_visita}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {(visita.status === "agendada" || visita.status === "confirmada") && (
          <Button variant="ghost" size="sm" onClick={onFeedback} className="text-xs h-7">
            Feedback
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => onEdit(visita)} className="h-7 px-2">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(visita.id)}
          className="h-7 px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
