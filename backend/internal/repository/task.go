package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taskflow/backend/internal/model"
)

type TaskRepo struct {
	pool *pgxpool.Pool
}

func NewTaskRepo(pool *pgxpool.Pool) *TaskRepo {
	return &TaskRepo{pool: pool}
}

func (r *TaskRepo) List(ctx context.Context, projectID, status, assignee string) ([]model.Task, error) {
	where := []string{"project_id = $1"}
	args := []interface{}{projectID}
	idx := 2

	if status != "" {
		where = append(where, fmt.Sprintf("status = $%d", idx))
		args = append(args, status)
		idx++
	}
	if assignee != "" {
		where = append(where, fmt.Sprintf("assignee_id = $%d", idx))
		args = append(args, assignee)
		idx++
	}

	whereClause := strings.Join(where, " AND ")

	dataQuery := fmt.Sprintf(
		`SELECT id, title, description, status, priority, project_id, creator_id, assignee_id,
		        due_date::text, created_at, updated_at
		 FROM tasks WHERE %s
		 ORDER BY created_at DESC`, whereClause)

	rows, err := r.pool.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []model.Task
	for rows.Next() {
		var t model.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.CreatorID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

func (r *TaskRepo) Create(ctx context.Context, title, description, priority, projectID string, creatorID *string, assigneeID *string, dueDate *string) (*model.Task, error) {
	var t model.Task
	err := r.pool.QueryRow(ctx,
		`INSERT INTO tasks (title, description, priority, project_id, creator_id, assignee_id, due_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::date)
		 RETURNING id, title, description, status, priority, project_id, creator_id, assignee_id,
		           due_date::text, created_at, updated_at`,
		title, description, priority, projectID, creatorID, assigneeID, dueDate,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.CreatorID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	return &t, err
}

func (r *TaskRepo) GetByID(ctx context.Context, id string) (*model.Task, error) {
	var t model.Task
	err := r.pool.QueryRow(ctx,
		`SELECT id, title, description, status, priority, project_id, creator_id, assignee_id,
		        due_date::text, created_at, updated_at
		 FROM tasks WHERE id = $1`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.CreatorID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)

	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &t, err
}

func (r *TaskRepo) Update(ctx context.Context, id string, fields map[string]interface{}) (*model.Task, error) {
	sets := []string{}
	args := []interface{}{}
	idx := 1

	for k, v := range fields {
		if k == "due_date" {
			sets = append(sets, fmt.Sprintf("%s = $%d::date", k, idx))
		} else {
			sets = append(sets, fmt.Sprintf("%s = $%d", k, idx))
		}
		args = append(args, v)
		idx++
	}

	sets = append(sets, "updated_at = now()")
	setClause := strings.Join(sets, ", ")
	args = append(args, id)

	query := fmt.Sprintf(
		`UPDATE tasks SET %s WHERE id = $%d
		 RETURNING id, title, description, status, priority, project_id, creator_id, assignee_id,
		           due_date::text, created_at, updated_at`, setClause, idx)

	var t model.Task
	err := r.pool.QueryRow(ctx, query, args...).Scan(
		&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.CreatorID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	return &t, err
}

func (r *TaskRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	return err
}

func (r *TaskRepo) GetStatsByProject(ctx context.Context, projectID string) (*model.ProjectStats, error) {
	stats := &model.ProjectStats{
		ByStatus:   make(map[string]int),
		ByAssignee: make(map[string]model.AssigneeStats),
	}

	// Counts by status
	rows, err := r.pool.Query(ctx,
		`SELECT status::text, COUNT(*) FROM tasks WHERE project_id = $1 GROUP BY status`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats.ByStatus[status] = count
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Counts by assignee
	rows2, err := r.pool.Query(ctx,
		`SELECT u.id, u.name, COUNT(*)
		 FROM tasks t JOIN users u ON t.assignee_id = u.id
		 WHERE t.project_id = $1
		 GROUP BY u.id, u.name`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()

	for rows2.Next() {
		var id, name string
		var count int
		if err := rows2.Scan(&id, &name, &count); err != nil {
			return nil, err
		}
		stats.ByAssignee[id] = model.AssigneeStats{Name: name, Count: count}
	}
	return stats, rows2.Err()
}
