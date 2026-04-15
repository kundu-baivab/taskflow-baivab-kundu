package seed

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const (
	seedUserID    = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"
	seedProjectID = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22"
)

func Run(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	var exists bool
	err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", seedUserID).Scan(&exists)
	if err != nil {
		return err
	}
	if exists {
		logger.Info("seed data already present, skipping")
		return nil
	}

	logger.Info("applying seed data...")

	hashed, err := bcrypt.GenerateFromPassword([]byte("password123"), 12)
	if err != nil {
		return err
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO users (id, name, email, password) VALUES ($1, $2, $3, $4)`,
		seedUserID, "Test User", "test@example.com", string(hashed))
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx,
		`INSERT INTO projects (id, name, description, owner_id) VALUES ($1, $2, $3, $4)`,
		seedProjectID, "Website Redesign", "Q2 redesign of the company website", seedUserID)
	if err != nil {
		return err
	}

	tasks := []struct {
		id, title, desc, status, priority string
		assigneeID                        *string
		dueDate                           *string
	}{
		{
			id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a31", title: "Design homepage mockup",
			desc: "Create wireframes and high-fidelity mockups for the new homepage",
			status: "todo", priority: "high", assigneeID: strPtr(seedUserID), dueDate: strPtr("2026-04-30"),
		},
		{
			id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a32", title: "Implement navigation bar",
			desc: "Build responsive nav with mobile hamburger menu",
			status: "in_progress", priority: "medium", assigneeID: strPtr(seedUserID), dueDate: strPtr("2026-04-20"),
		},
		{
			id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33", title: "Set up CI/CD pipeline",
			desc: "Configure GitHub Actions for automated testing and deployment",
			status: "done", priority: "low", assigneeID: nil, dueDate: strPtr("2026-04-10"),
		},
	}

	for _, t := range tasks {
		_, err = tx.Exec(ctx,
			`INSERT INTO tasks (id, title, description, status, priority, project_id, creator_id, assignee_id, due_date)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date)`,
			t.id, t.title, t.desc, t.status, t.priority, seedProjectID, seedUserID, t.assigneeID, t.dueDate)
		if err != nil {
			return err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	logger.Info("seed data applied successfully")
	return nil
}

func strPtr(s string) *string { return &s }
