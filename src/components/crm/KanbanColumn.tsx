import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import LeadCard from "./LeadCard";
import type { Tables } from "@/integrations/supabase/types";

type Lead = Tables<"leads">;

interface KanbanColumnProps {
  id: string;
  title: string;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

const KanbanColumn = memo(function KanbanColumn({ id, title, leads, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[260px] w-[260px] rounded-xl transition-colors ${
        isOver ? "bg-primary/5 ring-1 ring-primary/20" : "bg-secondary/30"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <span className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground font-medium">
          {leads.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-220px)]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
});

export default KanbanColumn;
