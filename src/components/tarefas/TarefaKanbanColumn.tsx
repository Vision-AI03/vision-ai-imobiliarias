import { useDroppable } from "@dnd-kit/core";
import { TarefaCard } from "./TarefaCard";
import type { Tarefa } from "@/pages/Tarefas";
import type { LucideIcon } from "lucide-react";

interface Props {
  coluna: { id: string; titulo: string; icon: LucideIcon; cor: string };
  tarefas: Tarefa[];
  onEdit: (t: Tarefa) => void;
  onDelete: (id: string) => void;
  onToggle: (t: Tarefa) => void;
}

export function TarefaKanbanColumn({ coluna, tarefas, onEdit, onDelete, onToggle }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const Icon = coluna.icon;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border border-border bg-secondary/30 p-3 min-h-[300px] transition-colors ${isOver ? "border-primary/50 bg-primary/5" : ""}`}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <Icon className={`h-4 w-4 ${coluna.cor}`} />
        <span className="text-sm font-semibold">{coluna.titulo}</span>
        <span className="text-xs text-muted-foreground ml-auto">{tarefas.length}</span>
      </div>
      <div className="space-y-2">
        {tarefas.map(t => (
          <TarefaCard key={t.id} tarefa={t} onEdit={onEdit} onDelete={onDelete} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
