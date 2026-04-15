import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createTask, updateTask, deleteTask } from "@/api/tasks";
import { Task, ProjectWithTasks } from "@/types";
import { projectsKeys } from "./useProjectsApi";

export function useCreateTaskMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string;
      priority?: string;
      assignee_id?: string | null;
      due_date?: string | null;
    }) => createTask(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(projectId) });
    },
  });
}

export function useUpdateTaskMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Partial<Task> }) =>
      updateTask(taskId, data),
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: projectsKeys.detail(projectId) });
      const prev = queryClient.getQueryData<ProjectWithTasks>(projectsKeys.detail(projectId));
      if (prev) {
        queryClient.setQueryData<ProjectWithTasks>(projectsKeys.detail(projectId), {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...data } : t)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(projectsKeys.detail(projectId), context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(projectId) });
    },
  });
}

export function useDeleteTaskMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(projectId) });
    },
  });
}
