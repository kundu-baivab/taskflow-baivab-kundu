export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
}

export interface ProjectWithTasks extends Project {
  tasks: Task[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  project_id: string;
  creator_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedProjects {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

export interface ProjectStats {
  by_status: Record<string, number>;
  by_assignee: Record<string, { name: string; count: number }>;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
