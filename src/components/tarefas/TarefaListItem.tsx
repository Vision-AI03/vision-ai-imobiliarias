import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Calendar, User, FileText } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import type { Tarefa } from "@/pages/Tarefas";

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-destructive/20 text-destructive border-destructive/30",
  media: "bg-warning/20 text-warning border-warning/30",
  baixa: "bg-success/20 text-success border-success/30",
};

interface Props {
  tarefa: Tarefa;
  onToggle: (t: Tarefa) => void;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: string) => void;
}

export const TarefaListItem = memo(function TarefaListItem({ tarefa, onToggle, onEdit, onDelete }: Props) {
  const isOverdue = tarefa.data_vencimento && !tarefa.concluida &&
    isPast(new Date(tarefa.data_vencimento + "T23:59:59")) &&
    !isToday(new Date(tarefa.data_vencimento + "T00:00:00"));

  return (
    <div className="group flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors border-b border-border last:border-0">
      <Checkbox checked={tarefa.concluida} onCheckedChange={() => onToggle(tarefa)} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${tarefa.concluida ? "line-through text-muted-foreground" : "font-medium"}`}>
          {tarefa.titulo}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_COLORS[tarefa.prioridade] || ""}`}>
            {tarefa.prioridade}
          </Badge>
          {tarefa.data_vencimento && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
              <Calendar className="h-3 w-3" />
              {format(new Date(tarefa.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}
            </span>
          )}
          {tarefa.lead_nome && (
            <span className="text-[10px] text-accent flex items-center gap-0.5">
              <User className="h-3 w-3" /> {tarefa.lead_nome}
            </span>
          )}
          {tarefa.contrato_nome && (
            <span className="text-[10px] text-primary flex items-center gap-0.5">
              <FileText className="h-3 w-3" /> {tarefa.contrato_nome}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(tarefa)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(tarefa.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
});
