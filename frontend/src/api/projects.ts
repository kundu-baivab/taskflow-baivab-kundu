import client from "./client";
import { Project, ProjectWithTasks, PaginatedProjects } from "@/types";

export async function fetchProjectsList(params?: { page?: number; limit?: number }): Promise<PaginatedProjects> {
  const { data } = await client.get<PaginatedProjects>("/api/projects", { params });
  return data;
}

export async function fetchProject(id: string): Promise<ProjectWithTasks> {
  const { data } = await client.get<ProjectWithTasks>(`/api/projects/${id}`);
  return data;
}

export async function createProject(name: string, description: string): Promise<Project> {
  const { data } = await client.post<Project>("/api/projects", { name, description });
  return data;
}

export async function updateProject(id: string, payload: { name?: string; description?: string }): Promise<Project> {
  const { data } = await client.patch<Project>(`/api/projects/${id}`, payload);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await client.delete(`/api/projects/${id}`);
}
