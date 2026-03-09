import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Check, DollarSign, Target, Mail, CheckSquare, Key, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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

export function NotificationBell() {
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotificacoes = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notificacoes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotificacoes(data as unknown as Notificacao[]);
      setUnreadCount((data as unknown as Notificacao[]).filter((n) => !n.lida).length);
    }
  }, []);

  useEffect(() => {
    fetchNotificacoes();

    // Generate notifications on load
    supabase.functions.invoke("generate-notifications").catch(() => {});

    // Realtime subscription
    const channel = supabase
      .channel("notificacoes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          const newNotif = payload.new as unknown as Notificacao;
          setNotificacoes((prev) => [newNotif, ...prev].slice(0, 20));
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotificacoes]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notificacoes")
      .update({ lida: true } as Record<string, unknown>)
      .eq("id", id);
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
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
    setUnreadCount(0);
  };

  const handleClick = (notif: Notificacao) => {
    if (!notif.lida) markAsRead(notif.id);
    if (notif.link) {
      setOpen(false);
      navigate(notif.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
              <Check className="h-3 w-3 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notificacoes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              Nenhuma notificação
            </div>
          ) : (
            notificacoes.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left p-3 border-b border-border hover:bg-accent/50 transition-colors flex gap-3 ${
                  !n.lida ? "bg-primary/5" : ""
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {tipoIcons[n.tipo] || <Bell className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-tight ${!n.lida ? "font-medium" : "text-muted-foreground"}`}>
                    {n.titulo}
                  </p>
                  {n.descricao && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.descricao}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {!n.lida && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </button>
            ))
          )}
        </ScrollArea>
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            className="w-full text-xs h-8"
            onClick={() => { setOpen(false); navigate("/notificacoes"); }}
          >
            Ver todas as notificações
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
