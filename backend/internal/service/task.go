package service

import (
	"context"

	"github.com/taskflow/backend/internal/model"
	"github.com/taskflow/backend/internal/repository"
)

type TaskService struct {
	taskRepo    *repository.TaskRepo
	projectRepo *repository.ProjectRepo
}

func NewTaskService(taskRepo *repository.TaskRepo, projectRepo *repository.ProjectRepo) *TaskService {
	return &TaskService{taskRepo: taskRepo, projectRepo: projectRepo}
}

func (s *TaskService) List(ctx context.Context, projectID, status, assignee string) ([]model.Task, error) {
	project, err := s.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrNotFound
	}

	return s.taskRepo.List(ctx, projectID, status, assignee)
}

func (s *TaskService) Create(ctx context.Context, title, description, priority, projectID, userID string, assigneeID, dueDate *string) (*model.Task, error) {
	project, err := s.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrNotFound
	}

	if priority == "" {
		priority = "medium"
	}

	return s.taskRepo.Create(ctx, title, description, priority, projectID, &userID, assigneeID, dueDate)
}

func (s *TaskService) Update(ctx context.Context, taskID, userID string, fields map[string]interface{}) (*model.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return nil, err
	}
	if task == nil {
		return nil, ErrNotFound
	}

	isAssignee := task.AssigneeID != nil && *task.AssigneeID == userID
	isCreator := task.CreatorID != nil && *task.CreatorID == userID

	project, err := s.projectRepo.GetByID(ctx, task.ProjectID)
	if err != nil {
		return nil, err
	}
	if project.OwnerID != userID && !isAssignee && !isCreator {
		return nil, ErrForbidden
	}

	if len(fields) == 0 {
		return task, nil
	}

	return s.taskRepo.Update(ctx, taskID, fields)
}

func (s *TaskService) Delete(ctx context.Context, taskID, userID string) error {
	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil {
		return err
	}
	if task == nil {
		return ErrNotFound
	}

	isCreator := task.CreatorID != nil && *task.CreatorID == userID

	project, err := s.projectRepo.GetByID(ctx, task.ProjectID)
	if err != nil {
		return err
	}

	if project.OwnerID != userID && !isCreator {
		return ErrForbidden
	}

	return s.taskRepo.Delete(ctx, taskID)
}

func (s *TaskService) GetStats(ctx context.Context, projectID string) (*model.ProjectStats, error) {
	project, err := s.projectRepo.GetByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrNotFound
	}

	return s.taskRepo.GetStatsByProject(ctx, projectID)
}
