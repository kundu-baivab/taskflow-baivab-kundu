import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, TaskStatus } from "@/types";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  usersMap?: Map<string, string>;
  canDragTask?: (task: Task) => boolean;
}

const statusLabels: Record<TaskStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const statusColors: Record<TaskStatus, string> = {
  todo: "border-t-blue-500",
  in_progress: "border-t-yellow-500",
  done: "border-t-green-500",
};

export function KanbanColumn({ status, tasks, onTaskClick, usersMap, canDragTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border border-t-4 bg-muted/30 min-h-0 h-full",
        statusColors[status],
        isOver && "bg-accent/50"
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <h3 className="font-semibold text-sm">{statusLabels[status]}</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto min-h-0 kanban-scroll">
          {tasks.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              No tasks
            </div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task)}
                assigneeName={task.assignee_id && usersMap ? usersMap.get(task.assignee_id) : null}
                canDrag={canDragTask ? canDragTask(task) : true}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
