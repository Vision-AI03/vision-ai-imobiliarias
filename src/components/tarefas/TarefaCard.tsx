import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, GripVertical, Calendar, User, FileText } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import type { Tarefa } from "@/pages/Tarefas";

const PRIORIDADE_COLORS: Record<string, string> = {
  alta: "bg-destructive/20 text-destructive border-destructive/30",
  media: "bg-warning/20 text-warning border-warning/30",
  baixa: "bg-success/20 text-success border-success/30",
};

interface Props {
  tarefa: Tarefa;
  onEdit: (t: Tarefa) => void;
  onDelete: (id: string) => void;
  onToggle: (t: Tarefa) => void;
  isDragging?: boolean;
}

export const TarefaCard = memo(function TarefaCard({ tarefa, onEdit, onDelete, onToggle, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: tarefa.id });

  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  const isOverdue = tarefa.data_vencimento && !tarefa.concluida &&
    isPast(new Date(tarefa.data_vencimento + "T23:59:59")) &&
    !isToday(new Date(tarefa.data_vencimento + "T00:00:00"));

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-3 rounded-lg border border-border bg-card hover:border-primary/30 transition-all ${isDragging ? "opacity-50 shadow-lg" : ""} ${tarefa.concluida ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <div {...listeners} {...attributes} className="mt-1 cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <Checkbox checked={tarefa.concluida} onCheckedChange={() => onToggle(tarefa)} className="mt-1" />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${tarefa.concluida ? "line-through text-muted-foreground" : ""}`}>
            {tarefa.titulo}
          </p>
          {tarefa.descricao && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tarefa.descricao}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_COLORS[tarefa.prioridade] || ""}`}>
              {tarefa.prioridade}
            </Badge>
            {tarefa.data_vencimento && (
              <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                <Calendar className="h-3 w-3" />
                {format(new Date(tarefa.data_vencimento + "T00:00:00"), "dd/MM")}
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
    </div>
  );
});
