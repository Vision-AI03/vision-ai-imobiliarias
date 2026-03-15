import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare, Bot, Check, CheckCheck, Image, FileText, Mic, Video } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

interface WppMensagem {
  id: string;
  direcao: string;
  tipo_mensagem: string;
  conteudo: string | null;
  timestamp_whatsapp: string;
  status_entrega: string | null;
}

interface UltimaAnalise {
  estagio_sugerido: string;
  confianca: number;
  motivo: string;
  acoes_sugeridas: string | null;
  aplicado: boolean;
  created_at: string;
}

interface Props {
  leadId: string;
  estagioFonte?: string | null;
}

function MediaIcon({ tipo }: { tipo: string }) {
  if (tipo === "image") return <Image className="h-3.5 w-3.5 inline mr-1" />;
  if (tipo === "document") return <FileText className="h-3.5 w-3.5 inline mr-1" />;
  if (tipo === "audio") return <Mic className="h-3.5 w-3.5 inline mr-1" />;
  if (tipo === "video") return <Video className="h-3.5 w-3.5 inline mr-1" />;
  return null;
}

function DeliveryIcon({ status }: { status: string | null }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 inline ml-1 text-blue-400" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 inline ml-1 text-muted-foreground" />;
  if (status === "sent") return <Check className="h-3 w-3 inline ml-1 text-muted-foreground" />;
  return null;
}

export function WhatsAppTab({ leadId, estagioFonte }: Props) {
  const [mensagens, setMensagens] = useState<WppMensagem[]>([]);
  const [ultimaAnalise, setUltimaAnalise] = useState<UltimaAnalise | null>(null);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leadId) return;
    fetchData();

    const channel = supabase
      .channel(`wpp-${leadId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_mensagens",
        filter: `lead_id=eq.${leadId}`,
      }, (payload) => {
        setMensagens(prev => [...prev, payload.new as WppMensagem]);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "whatsapp_mensagens",
        filter: `lead_id=eq.${leadId}`,
      }, (payload) => {
        setMensagens(prev => prev.map(m => m.id === payload.new.id ? payload.new as WppMensagem : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  async function fetchData() {
    setLoading(true);
    const [msgsRes, analiseRes] = await Promise.all([
      supabase
        .from("whatsapp_mensagens")
        .select("id, direcao, tipo_mensagem, conteudo, timestamp_whatsapp, status_entrega")
        .eq("lead_id", leadId)
        .order("timestamp_whatsapp", { ascending: true })
        .limit(100),
      supabase
        .from("analise_lead_ia")
        .select("estagio_sugerido, confianca, motivo, acoes_sugeridas, aplicado, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setMensagens(msgsRes.data || []);
    setUltimaAnalise(analiseRes.data || null);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* IA Analysis Banner */}
      {estagioFonte === "ia_whatsapp" && ultimaAnalise && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Estágio definido pela IA</span>
            <Badge className="text-[10px] bg-primary/20 text-primary ml-auto">
              {ultimaAnalise.confianca}% confiança
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{ultimaAnalise.motivo}</p>
          {ultimaAnalise.acoes_sugeridas && (
            <p className="text-xs text-foreground/80">
              <span className="font-medium">Próximo passo:</span> {ultimaAnalise.acoes_sugeridas}
            </p>
          )}
        </div>
      )}

      {mensagens.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma mensagem de WhatsApp registrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            As mensagens aparecem aqui automaticamente via webhook
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[380px] pr-2">
          <div className="space-y-2 pb-2">
            {mensagens.map((msg) => {
              const enviada = msg.direcao === "enviada";
              return (
                <div key={msg.id} className={`flex ${enviada ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs space-y-0.5 ${
                      enviada
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-foreground rounded-tl-sm"
                    }`}
                  >
                    {msg.tipo_mensagem !== "text" && (
                      <p className="text-[10px] opacity-70 flex items-center gap-1">
                        <MediaIcon tipo={msg.tipo_mensagem} />
                        {msg.tipo_mensagem}
                      </p>
                    )}
                    {msg.conteudo && <p className="leading-relaxed">{msg.conteudo}</p>}
                    <div className={`flex items-center gap-1 ${enviada ? "justify-end" : "justify-start"}`}>
                      <span className="text-[10px] opacity-60">
                        {format(new Date(msg.timestamp_whatsapp), "HH:mm", { locale: ptBR })}
                      </span>
                      {enviada && <DeliveryIcon status={msg.status_entrega} />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
