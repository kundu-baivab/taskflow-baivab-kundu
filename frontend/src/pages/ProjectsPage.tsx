import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useProjectsListQuery, useCreateProjectMutation } from "@/hooks/useProjectsApi";
import { useUsersQuery } from "@/hooks/useUsersApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, FolderOpen, Loader2, AlertCircle, ChevronLeft, ChevronRight, User } from "lucide-react";

const PAGE_SIZE_OPTIONS = [5, 10, 15] as const;

function getStoredPageSize(): number {
  const stored = localStorage.getItem("projects_page_size");
  const parsed = stored ? Number(stored) : NaN;
  return PAGE_SIZE_OPTIONS.includes(parsed as typeof PAGE_SIZE_OPTIONS[number]) ? parsed : 10;
}

export function ProjectsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(getStoredPageSize);

  const { data, isLoading, error, isPlaceholderData } = useProjectsListQuery(page, limit);
  const { data: users = [] } = useUsersQuery();

  const usersMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users]
  );

  const projects = data?.projects ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handlePageSizeChange = (value: string) => {
    const newLimit = Number(value);
    localStorage.setItem("projects_page_size", value);
    setLimit(newLimit);
    setPage(1);
  };

  const createMutation = useCreateProjectMutation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2 text-destructive">
        <AlertCircle className="h-8 w-8" />
        <p>Failed to load projects. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-screen-xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Manage your projects and tasks</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      {total === 0 && projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No projects yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first project to get started.</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create Project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isPlaceholderData ? "opacity-60" : ""}`}>
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="line-clamp-2">
                      {project.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                    {usersMap.get(project.owner_id) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {usersMap.get(project.owner_id)}
                      </span>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="flex items-center justify-between mt-8 gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Show</span>
              <Select value={String(limit)} onValueChange={handlePageSizeChange}>
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">per page</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>Add a new project to organize your tasks.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(
                { name: name.trim(), description: description.trim() },
                {
                  onSuccess: () => {
                    setDialogOpen(false);
                    setName("");
                    setDescription("");
                  },
                }
              );
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="project-name">Name</Label>
              <Input
                id="project-name"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-desc">Description (optional)</Label>
              <Textarea
                id="project-desc"
                placeholder="What's this project about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {createMutation.error && (
              <p className="text-destructive text-sm">Failed to create project. Try again.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
