import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, GripVertical, Lock, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragOverlay?: boolean;
  assigneeName?: string | null;
  canDrag?: boolean;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export function TaskCard({ task, onClick, isDragOverlay, assigneeName, canDrag = true }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 cursor-pointer hover:border-primary/50 transition-colors",
        isDragging && "opacity-50",
        isDragOverlay && "shadow-lg rotate-2 border-primary"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        {canDrag ? (
          <button
            className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        ) : (
          <span className="mt-0.5 cursor-not-allowed text-muted-foreground/40 shrink-0" title="You don't have permission to move this task">
            <Lock className="h-4 w-4" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight mb-2 truncate">{task.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", priorityColors[task.priority])}>
              {task.priority}
            </Badge>
            {task.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {assigneeName && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {assigneeName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
