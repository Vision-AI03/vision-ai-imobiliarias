import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, DollarSign, Target, Mail, CheckSquare, Key, FileText, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
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
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterLida, setFilterLida] = useState<string>("todas");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

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

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notificações</h1>
          <p className="text-muted-foreground">Todas as notificações do sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}>
          <Check className="h-4 w-4 mr-1" />
          Marcar todas como lidas
        </Button>
      </div>

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
    </div>
  );
}
