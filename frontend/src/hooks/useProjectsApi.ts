import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchProjectsList, fetchProject, createProject, updateProject, deleteProject } from "@/api/projects";

export const projectsKeys = {
  all: ["projects"] as const,
  list: (page: number, limit: number) => ["projects", page, limit] as const,
  detail: (id: string) => ["project", id] as const,
};

export function useProjectsListQuery(page: number, limit: number) {
  return useQuery({
    queryKey: projectsKeys.list(page, limit),
    queryFn: () => fetchProjectsList({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

export function useProjectQuery(id: string | undefined) {
  return useQuery({
    queryKey: projectsKeys.detail(id!),
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description: string }) =>
      createProject(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useUpdateProjectMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name?: string; description?: string }) =>
      updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      navigate("/projects");
    },
  });
}
