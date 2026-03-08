import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, MessageSquare, ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Comunicacao = Tables<"comunicacoes">;
type Lead = Tables<"leads">;

interface Props {
  comunicacao: (Comunicacao & { lead?: Lead }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case "respondido": return "bg-success/20 text-success";
    case "aberto": return "bg-primary/20 text-primary";
    default: return "bg-muted text-muted-foreground";
  }
}

export function ComunicacaoDrawer({ comunicacao, open, onOpenChange }: Props) {
  if (!comunicacao) return null;

  const isEmail = comunicacao.tipo === "email";
  const isEnviado = comunicacao.direcao === "enviado";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
        <SheetHeader className="space-y-3">
          <div className="flex items-center gap-2">
            {isEmail ? <Mail className="h-5 w-5 text-primary" /> : <MessageSquare className="h-5 w-5 text-emerald-500" />}
            <SheetTitle className="text-lg">
              {isEmail ? "Detalhes do Email" : "Detalhes da Mensagem"}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Lead info */}
          <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
            <p className="text-sm font-medium">{comunicacao.lead?.nome || "Lead desconhecido"}</p>
            {comunicacao.lead?.empresa && (
              <p className="text-xs text-muted-foreground">{comunicacao.lead.empresa}</p>
            )}
            <p className="text-xs text-muted-foreground">{comunicacao.lead?.email}</p>
          </div>

          {/* Status & Direction */}
          <div className="flex items-center gap-3">
            <Badge className={getStatusColor(comunicacao.status)}>
              {comunicacao.status}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {isEnviado ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
              {isEnviado ? "Enviado" : "Recebido"}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
              <Clock className="h-3 w-3" />
              {format(new Date(comunicacao.criado_em), "dd/MM/yyyy 'às' HH:mm")}
            </div>
          </div>

          <Separator />

          {/* Subject (email only) */}
          {isEmail && comunicacao.assunto && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Assunto</p>
              <p className="text-sm font-medium">{comunicacao.assunto}</p>
            </div>
          )}

          {/* Content */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Conteúdo</p>
            <div className="rounded-lg border border-border bg-secondary/20 p-4">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">
                {comunicacao.conteudo || "Sem conteúdo registrado."}
              </p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
