import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { useProjectQuery, useUpdateProjectMutation, useDeleteProjectMutation } from "@/hooks/useProjectsApi";
import { useCreateTaskMutation, useUpdateTaskMutation, useDeleteTaskMutation } from "@/hooks/useTasksApi";
import { useUsersQuery } from "@/hooks/useUsersApi";
import { useAuth } from "@/context/AuthContext";
import { Task, TaskStatus } from "@/types";
import { KanbanColumn } from "@/components/KanbanColumn";
import { TaskCard } from "@/components/TaskCard";
import { TaskModal, TaskFormData } from "@/components/TaskModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, Plus, Loader2, AlertCircle, Trash2, Settings,
} from "lucide-react";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const { data: project, isLoading, error } = useProjectQuery(id);
  const { data: users = [] } = useUsersQuery();

  const createMutation = useCreateTaskMutation(id!);
  const updateMutation = useUpdateTaskMutation(id!);
  const deleteMutation = useDeleteTaskMutation(id!);
  const updateProjectMutation = useUpdateProjectMutation(id!);
  const deleteProjectMutation = useDeleteProjectMutation();

  const usersMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users]
  );

  const isOwner = project?.owner_id === user?.id;

  const tasksByStatus = useMemo(() => {
    const tasks = project?.tasks || [];
    let filtered = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);
    if (assigneeFilter === "unassigned") {
      filtered = filtered.filter((t) => !t.assignee_id);
    } else if (assigneeFilter !== "all") {
      filtered = filtered.filter((t) => t.assignee_id === assigneeFilter);
    }
    const grouped: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] };
    filtered.forEach((t) => grouped[t.status]?.push(t));
    return grouped;
  }, [project?.tasks, statusFilter, assigneeFilter]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task;
    if (task) setActiveTask(task);
  }, []);

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // visual feedback handled by KanbanColumn's isOver
  }, []);

  const canEditTask = useCallback(
    (task: Task) => isOwner || task.creator_id === user?.id || task.assignee_id === user?.id,
    [isOwner, user?.id]
  );

  const canDeleteTask = useCallback(
    (task: Task) => isOwner || task.creator_id === user?.id,
    [isOwner, user?.id]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over) return;

      const taskData = active.data.current?.task as Task;
      if (!taskData) return;
      if (!canEditTask(taskData)) return;

      const newStatus = (STATUSES.includes(over.id as TaskStatus)
        ? over.id
        : (over.data.current?.task as Task)?.status) as TaskStatus;

      if (newStatus && newStatus !== taskData.status) {
        updateMutation.mutate({
          taskId: taskData.id,
          data: { status: newStatus },
        });
      }
    },
    [updateMutation, canEditTask]
  );

  const handleTaskSubmit = (data: TaskFormData) => {
    const onDone = () => {
      setTaskModalOpen(false);
      setEditTask(null);
    };
    if (editTask) {
      updateMutation.mutate(
        {
          taskId: editTask.id,
          data: {
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            due_date: data.due_date || null,
            assignee_id: data.assignee_id,
          },
        },
        { onSettled: onDone }
      );
    } else {
      createMutation.mutate(
        {
          title: data.title,
          description: data.description,
          priority: data.priority,
          due_date: data.due_date || null,
          assignee_id: data.assignee_id,
        },
        { onSuccess: onDone }
      );
    }
  };

  const openEditSettings = () => {
    if (project) {
      setProjectName(project.name);
      setProjectDesc(project.description);
      setSettingsOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p>Failed to load project.</p>
        <Button variant="outline" onClick={() => navigate("/projects")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground text-sm mt-0.5">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isOwner && (
            <Button variant="outline" size="icon" onClick={openEditSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          )}
          <Button onClick={() => { setEditTask(null); setTaskModalOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Task
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 min-h-0">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              usersMap={usersMap}
              canDragTask={canEditTask}
              onTaskClick={(task) => {
                setEditTask(task);
                setTaskModalOpen(true);
              }}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              onClick={() => {}}
              isDragOverlay
              assigneeName={activeTask.assignee_id ? usersMap.get(activeTask.assignee_id) : null}
            />
          )}
        </DragOverlay>
      </DndContext>

      <TaskModal
        open={taskModalOpen}
        onClose={() => { setTaskModalOpen(false); setEditTask(null); }}
        onSubmit={handleTaskSubmit}
        task={editTask}
        isPending={createMutation.isPending || updateMutation.isPending}
        onDelete={editTask ? () => deleteMutation.mutate(editTask.id, { onSuccess: () => { setTaskModalOpen(false); setEditTask(null); } }) : undefined}
        isDeletePending={deleteMutation.isPending}
        canDelete={editTask ? canDeleteTask(editTask) : false}
        readOnly={!!editTask && !canEditTask(editTask)}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
            <DialogDescription>Update project details or delete the project.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateProjectMutation.mutate(
                { name: projectName, description: projectDesc },
                { onSuccess: () => setSettingsOpen(false) }
              );
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-pname">Name</Label>
              <Input
                id="edit-pname"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-pdesc">Description</Label>
              <Textarea
                id="edit-pdesc"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
              />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (confirm("Delete this project and all its tasks?")) {
                    deleteProjectMutation.mutate(id!);
                  }
                }}
                disabled={deleteProjectMutation.isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Project
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setSettingsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateProjectMutation.isPending}>
                {updateProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
