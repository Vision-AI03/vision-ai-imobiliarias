import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, DollarSign, Target, Mail, CheckSquare, Key, FileText, ChevronLeft, ChevronRight, Trash2, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const tipoIcons: Record<string, React.ReactNode> = {
  parcela_vencendo: <DollarSign className="h-4 w-4 text-yellow-500" />,
  parcela_vencida: <DollarSign className="h-4 w-4 text-destructive" />,
  lead_parado: <Target className="h-4 w-4 text-orange-500" />,
  email_respondido: <Mail className="h-4 w-4 text-green-500" />,
  novo_lead_webhook: <Target className="h-4 w-4 text-primary" />,
  tarefa_atrasada: <CheckSquare className="h-4 w-4 text-destructive" />,
  contrato_pendente: <FileText className="h-4 w-4 text-blue-500" />,
  credencial_expirando: <Key className="h-4 w-4 text-yellow-500" />,
};

const tipoLabels: Record<string, string> = {
  parcela_vencendo: "Parcela Vencendo",
  parcela_vencida: "Parcela Vencida",
  lead_parado: "Lead Parado",
  email_respondido: "Email Respondido",
  novo_lead_webhook: "Novo Lead",
  tarefa_atrasada: "Tarefa Atrasada",
  contrato_pendente: "Contrato Pendente",
  credencial_expirando: "Credencial Expirando",
};

const PAGE_SIZE = 20;

export default function Notificacoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterLida, setFilterLida] = useState<string>("todas");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [cleaning, setCleaning] = useState(false);

  const fetchNotificacoes = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let query = supabase
      .from("notificacoes")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterTipo !== "todos") query = query.eq("tipo", filterTipo);
    if (filterLida === "nao_lidas") query = query.eq("lida", false);
    if (filterLida === "lidas") query = query.eq("lida", true);

    const { data, count } = await query;
    setNotificacoes((data || []) as unknown as Notificacao[]);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotificacoes();
  }, [page, filterTipo, filterLida]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notificacoes")
      .update({ lida: true } as Record<string, unknown>)
      .eq("id", id);
    setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
  };

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true } as Record<string, unknown>)
      .eq("user_id", user.id)
      .eq("lida", false);
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
  };

  const handleClick = (notif: Notificacao) => {
    if (!notif.lida) markAsRead(notif.id);
    if (notif.link) navigate(notif.link);
  };

  const cleanStaleNotifications = async () => {
    setCleaning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all notifications with metadata
      const { data: allNotifs } = await supabase
        .from("notificacoes")
        .select("id, tipo, metadata")
        .eq("user_id", user.id);

      if (!allNotifs || allNotifs.length === 0) {
        toast({ title: "Nenhuma notificação para limpar" });
        setCleaning(false);
        return;
      }

      const staleIds: string[] = [];

      // Check leads
      const leadNotifs = allNotifs.filter((n) => ["lead_parado", "novo_lead_webhook"].includes(n.tipo));
      if (leadNotifs.length > 0) {
        const leadIds = [...new Set(leadNotifs.map((n) => (n.metadata as Record<string, unknown>)?.lead_id as string).filter(Boolean))];
        if (leadIds.length > 0) {
          const { data: existingLeads } = await supabase.from("leads").select("id").in("id", leadIds);
          const existingSet = new Set((existingLeads || []).map((l) => l.id));
          leadNotifs.forEach((n) => {
            const lid = (n.metadata as Record<string, unknown>)?.lead_id as string;
            if (lid && !existingSet.has(lid)) staleIds.push(n.id);
          });
        }
      }

      // Check tarefas
      const tarefaNotifs = allNotifs.filter((n) => n.tipo === "tarefa_atrasada");
      if (tarefaNotifs.length > 0) {
        const tarefaIds = [...new Set(tarefaNotifs.map((n) => (n.metadata as Record<string, unknown>)?.tarefa_id as string).filter(Boolean))];
        if (tarefaIds.length > 0) {
          const { data: existingTarefas } = await supabase.from("tarefas").select("id").in("id", tarefaIds);
          const existingSet = new Set((existingTarefas || []).map((t) => t.id));
          tarefaNotifs.forEach((n) => {
            const tid = (n.metadata as Record<string, unknown>)?.tarefa_id as string;
            if (tid && !existingSet.has(tid)) staleIds.push(n.id);
          });
        }
      }

      // Check contratos
      const contratoNotifs = allNotifs.filter((n) => n.tipo === "contrato_pendente");
      if (contratoNotifs.length > 0) {
        const contratoIds = [...new Set(contratoNotifs.map((n) => (n.metadata as Record<string, unknown>)?.contrato_id as string).filter(Boolean))];
        if (contratoIds.length > 0) {
          const { data: existingContratos } = await supabase.from("contratos").select("id").in("id", contratoIds);
          const existingSet = new Set((existingContratos || []).map((c) => c.id));
          contratoNotifs.forEach((n) => {
            const cid = (n.metadata as Record<string, unknown>)?.contrato_id as string;
            if (cid && !existingSet.has(cid)) staleIds.push(n.id);
          });
        }
      }

      // Check parcelas
      const parcelaNotifs = allNotifs.filter((n) => ["parcela_vencendo", "parcela_vencida"].includes(n.tipo));
      if (parcelaNotifs.length > 0) {
        const parcelaIds = [...new Set(parcelaNotifs.map((n) => (n.metadata as Record<string, unknown>)?.parcela_id as string).filter(Boolean))];
        if (parcelaIds.length > 0) {
          const { data: existingParcelas } = await supabase.from("parcelas").select("id").in("id", parcelaIds);
          const existingSet = new Set((existingParcelas || []).map((p) => p.id));
          parcelaNotifs.forEach((n) => {
            const pid = (n.metadata as Record<string, unknown>)?.parcela_id as string;
            if (pid && !existingSet.has(pid)) staleIds.push(n.id);
          });
        }
      }

      if (staleIds.length > 0) {
        await supabase.from("notificacoes").delete().in("id", staleIds);
        toast({ title: `${staleIds.length} notificação(ões) obsoleta(s) removida(s)` });
      } else {
        toast({ title: "Nenhuma notificação obsoleta encontrada" });
      }

      fetchNotificacoes();
    } catch {
      toast({ title: "Erro ao limpar notificações", variant: "destructive" });
    }
    setCleaning(false);
  };

  const deleteAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCleaning(true);
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("user_id", user.id)
      .eq("lida", true);
    if (!error) {
      toast({ title: "Notificações lidas removidas" });
      fetchNotificacoes();
    }
    setCleaning(false);
  };

  const deleteAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCleaning(true);
    const { error } = await supabase
      .from("notificacoes")
      .delete()
      .eq("user_id", user.id);
    if (!error) {
      toast({ title: "Todas as notificações removidas" });
      fetchNotificacoes();
    }
    setCleaning(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">Gerencie todas as notificações do sistema</p>
        </div>
      </div>

      <Tabs defaultValue="todas">
        <TabsList>
          <TabsTrigger value="todas">Todas</TabsTrigger>
          <TabsTrigger value="limpeza">Limpeza</TabsTrigger>
        </TabsList>

        <TabsContent value="todas" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <Select value={filterTipo} onValueChange={(v) => { setFilterTipo(v); setPage(0); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {Object.entries(tipoLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLida} onValueChange={(v) => { setFilterLida(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="nao_lidas">Não lidas</SelectItem>
                  <SelectItem value="lidas">Lidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm" onClick={markAllRead}>
              <Check className="h-4 w-4 mr-1" />
              Marcar todas como lidas
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">Carregando...</div>
              ) : notificacoes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma notificação encontrada</div>
              ) : (
                notificacoes.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left p-4 border-b border-border hover:bg-accent/50 transition-colors flex gap-3 items-start ${
                      !n.lida ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {tipoIcons[n.tipo] || <Bell className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm ${!n.lida ? "font-medium" : "text-muted-foreground"}`}>
                          {n.titulo}
                        </p>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {tipoLabels[n.tipo] || n.tipo}
                        </Badge>
                      </div>
                      {n.descricao && (
                        <p className="text-xs text-muted-foreground mt-0.5">{n.descricao}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!n.lida && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page + 1} de {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="limpeza" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Limpeza de Notificações</h3>
              <p className="text-sm text-muted-foreground">
                Remova notificações obsoletas referentes a leads, tarefas, contratos ou parcelas que já foram excluídos do sistema.
              </p>

              <div className="grid gap-3">
                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">Limpar notificações obsoletas</p>
                    <p className="text-xs text-muted-foreground">Remove notificações de entidades que não existem mais (leads, tarefas, contratos, parcelas excluídos)</p>
                  </div>
                  <Button variant="outline" onClick={cleanStaleNotifications} disabled={cleaning}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${cleaning ? "animate-spin" : ""}`} />
                    Limpar obsoletas
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-sm">Excluir notificações lidas</p>
                    <p className="text-xs text-muted-foreground">Remove todas as notificações que já foram marcadas como lidas</p>
                  </div>
                  <Button variant="outline" onClick={deleteAllRead} disabled={cleaning}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir lidas
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/30">
                  <div>
                    <p className="font-medium text-sm text-destructive">Excluir todas as notificações</p>
                    <p className="text-xs text-muted-foreground">Remove permanentemente todas as notificações</p>
                  </div>
                  <Button variant="destructive" onClick={deleteAll} disabled={cleaning}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir todas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
