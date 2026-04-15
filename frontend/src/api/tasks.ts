import client from "./client";
import { Task } from "@/types";

export async function createTask(
  projectId: string,
  payload: {
    title: string;
    description?: string;
    priority?: string;
    assignee_id?: string | null;
    due_date?: string | null;
  }
): Promise<Task> {
  const { data } = await client.post<Task>(`/api/projects/${projectId}/tasks`, payload);
  return data;
}

export async function updateTask(
  taskId: string,
  payload: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assignee_id" | "due_date">>
): Promise<Task> {
  const { data } = await client.patch<Task>(`/api/tasks/${taskId}`, payload);
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  await client.delete(`/api/tasks/${taskId}`);
}
