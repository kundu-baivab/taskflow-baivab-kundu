import { useState, useEffect, FormEvent } from "react";
import { useUsersQuery } from "@/hooks/useUsersApi";
import { Task, TaskStatus, TaskPriority } from "@/types";
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
import { Loader2, Trash2 } from "lucide-react";

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => void;
  task?: Task | null;
  isPending?: boolean;
  onDelete?: () => void;
  isDeletePending?: boolean;
  canDelete?: boolean;
  readOnly?: boolean;
}

export interface TaskFormData {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  assignee_id: string | null;
}

export function TaskModal({ open, onClose, onSubmit, task, isPending, onDelete, isDeletePending, canDelete, readOnly }: TaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("unassigned");

  const { data: users = [] } = useUsersQuery();

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date || "");
      setAssigneeId(task.assignee_id || "unassigned");
    } else {
      setTitle("");
      setDescription("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setAssigneeId("unassigned");
    }
  }, [task, open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || readOnly) return;
    onSubmit({
      title: title.trim(),
      description,
      status,
      priority,
      due_date: dueDate || "",
      assignee_id: assigneeId === "unassigned" ? null : assigneeId,
    });
  };

  const isEditing = !!task;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "View Task" : isEditing ? "Edit Task" : "Create Task"}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? "You are viewing this task. Only the project owner can edit."
              : isEditing ? "Update the task details below." : "Fill in the details for your new task."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-due">Due Date</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditing && canDelete && onDelete && !readOnly && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={isDeletePending}
                className="sm:mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Task
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={!title.trim() || isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
