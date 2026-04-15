package service

import (
	"context"
	"errors"

	"github.com/taskflow/backend/internal/model"
	"github.com/taskflow/backend/internal/repository"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
)

type ProjectService struct {
	projectRepo *repository.ProjectRepo
}

func NewProjectService(projectRepo *repository.ProjectRepo) *ProjectService {
	return &ProjectService{projectRepo: projectRepo}
}

func (s *ProjectService) List(ctx context.Context, page, limit int) ([]model.Project, int, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	return s.projectRepo.List(ctx, page, limit)
}

func (s *ProjectService) Create(ctx context.Context, name, description, ownerID string) (*model.Project, error) {
	return s.projectRepo.Create(ctx, name, description, ownerID)
}

func (s *ProjectService) GetByID(ctx context.Context, id string) (*model.ProjectWithTasks, error) {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrNotFound
	}

	tasks, err := s.projectRepo.GetTasksByProject(ctx, id)
	if err != nil {
		return nil, err
	}
	if tasks == nil {
		tasks = []model.Task{}
	}

	return &model.ProjectWithTasks{Project: *project, Tasks: tasks}, nil
}

func (s *ProjectService) Update(ctx context.Context, id, name, description, userID string) (*model.Project, error) {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if project == nil {
		return nil, ErrNotFound
	}
	if project.OwnerID != userID {
		return nil, ErrForbidden
	}

	if name == "" {
		name = project.Name
	}
	if description == "" {
		description = project.Description
	}

	return s.projectRepo.Update(ctx, id, name, description)
}

func (s *ProjectService) Delete(ctx context.Context, id, userID string) error {
	project, err := s.projectRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if project == nil {
		return ErrNotFound
	}
	if project.OwnerID != userID {
		return ErrForbidden
	}
	return s.projectRepo.Delete(ctx, id)
}
