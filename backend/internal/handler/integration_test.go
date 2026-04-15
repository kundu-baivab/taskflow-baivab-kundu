package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/taskflow/backend/internal/handler"
	"github.com/taskflow/backend/internal/middleware"
	"github.com/taskflow/backend/internal/repository"
	"github.com/taskflow/backend/internal/service"
)

func setupTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("TEST_DATABASE_URL")
	if dbURL == "" {
		t.Skip("TEST_DATABASE_URL not set, skipping integration test")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatalf("failed to connect to test db: %v", err)
	}

	// Verify schema exists so tests fail fast with a clear message
	for _, table := range []string{"users", "projects", "tasks", "revoked_tokens"} {
		var exists bool
		err := pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)`, table,
		).Scan(&exists)
		if err != nil {
			t.Fatalf("failed to check schema: %v", err)
		}
		if !exists {
			t.Fatalf("table %q does not exist — run migrations before running integration tests", table)
		}
	}

	return pool
}

func setupRouter(pool *pgxpool.Pool) *chi.Mux {
	jwtSecret := "test-secret"
	userRepo := repository.NewUserRepo(pool)
	projectRepo := repository.NewProjectRepo(pool)
	taskRepo := repository.NewTaskRepo(pool)
	tokenRepo := repository.NewTokenRepo(pool)

	authService := service.NewAuthService(userRepo, tokenRepo, jwtSecret)
	projectService := service.NewProjectService(projectRepo)
	taskService := service.NewTaskService(taskRepo, projectRepo)

	authHandler := handler.NewAuthHandler(authService)
	projectHandler := handler.NewProjectHandler(projectService)
	taskHandler := handler.NewTaskHandler(taskService)

	r := chi.NewRouter()
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)

	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(jwtSecret, tokenRepo))
		r.Post("/api/auth/logout", authHandler.Logout)
		r.Get("/api/users", authHandler.ListUsers)
		r.Get("/api/projects", projectHandler.List)
		r.Post("/api/projects", projectHandler.Create)
		r.Get("/api/projects/{id}", projectHandler.GetByID)
		r.Post("/api/projects/{id}/tasks", taskHandler.Create)
		r.Get("/api/projects/{id}/tasks", taskHandler.List)
		r.Patch("/api/tasks/{id}", taskHandler.Update)
		r.Delete("/api/tasks/{id}", taskHandler.Delete)
	})

	return r
}

// cleanupUser removes a user and all their owned projects (cascades to tasks).
func cleanupUser(pool *pgxpool.Pool, email string) {
	ctx := context.Background()
	var id string
	err := pool.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", email).Scan(&id)
	if err != nil {
		return
	}
	pool.Exec(ctx, "DELETE FROM projects WHERE owner_id = $1", id)
	pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
}

// registerUser is a helper that registers a user and returns the auth token.
// It fails the test with a clear message instead of panicking.
func registerUser(t *testing.T, router *chi.Mux, name, email, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{
		"name": name, "email": email, "password": password,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("register %q: expected 201, got %d: %s", email, w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("register %q: failed to parse response: %v", email, err)
	}
	token, ok := resp["token"].(string)
	if !ok || token == "" {
		t.Fatalf("register %q: expected token in response, got: %v", email, resp)
	}
	return token
}

// jsonField safely extracts a string field from an untyped JSON map.
func jsonField(t *testing.T, data map[string]interface{}, key, context string) string {
	t.Helper()
	val, ok := data[key].(string)
	if !ok {
		t.Fatalf("%s: expected string field %q, got %v (full body: %v)", context, key, data[key], data)
	}
	return val
}

func TestRegisterAndLogin(t *testing.T) {
	pool := setupTestDB(t)
	defer pool.Close()
	r := setupRouter(pool)

	cleanupUser(pool, "integration@test.com")
	t.Cleanup(func() { cleanupUser(pool, "integration@test.com") })

	// Register
	registerUser(t, r, "Integration Test", "integration@test.com", "testpass123")

	// Login
	loginBody, _ := json.Marshal(map[string]string{
		"email": "integration@test.com", "password": "testpass123",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(loginBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("login: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Login with wrong password
	wrongBody, _ := json.Marshal(map[string]string{
		"email": "integration@test.com", "password": "wrongpassword",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader(wrongBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusUnauthorized {
		t.Fatalf("bad login: expected 401, got %d: %s", w2.Code, w2.Body.String())
	}
}

func TestDuplicateRegistration(t *testing.T) {
	pool := setupTestDB(t)
	defer pool.Close()
	r := setupRouter(pool)

	cleanupUser(pool, "dupe@test.com")
	t.Cleanup(func() { cleanupUser(pool, "dupe@test.com") })

	// First register
	registerUser(t, r, "Dupe User", "dupe@test.com", "testpass123")

	// Duplicate register — expect 400
	body, _ := json.Marshal(map[string]string{
		"name": "Dupe User", "email": "dupe@test.com", "password": "testpass123",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/auth/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("dupe register: expected 400, got %d: %s", w.Code, w.Body.String())
	}
}

func TestTaskCRUD(t *testing.T) {
	pool := setupTestDB(t)
	defer pool.Close()
	r := setupRouter(pool)

	cleanupUser(pool, "taskcrud@test.com")
	t.Cleanup(func() { cleanupUser(pool, "taskcrud@test.com") })

	token := registerUser(t, r, "Task User", "taskcrud@test.com", "testpass123")

	// Create project
	projBody, _ := json.Marshal(map[string]string{"name": "Test Project", "description": "for testing"})
	req := httptest.NewRequest(http.MethodPost, "/api/projects", bytes.NewReader(projBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("create project: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var projResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &projResp)
	projectID := jsonField(t, projResp, "id", "create project")

	// Create task
	taskBody, _ := json.Marshal(map[string]string{"title": "Test Task", "priority": "high"})
	req2 := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/projects/%s/tasks", projectID), bytes.NewReader(taskBody))
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+token)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusCreated {
		t.Fatalf("create task: expected 201, got %d: %s", w2.Code, w2.Body.String())
	}

	var taskResp map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &taskResp)
	taskID := jsonField(t, taskResp, "id", "create task")

	if taskResp["status"] != "todo" {
		t.Fatalf("expected default status 'todo', got %v", taskResp["status"])
	}

	// Update task status
	updateBody, _ := json.Marshal(map[string]string{"status": "in_progress"})
	req3 := httptest.NewRequest(http.MethodPatch, fmt.Sprintf("/api/tasks/%s", taskID), bytes.NewReader(updateBody))
	req3.Header.Set("Content-Type", "application/json")
	req3.Header.Set("Authorization", "Bearer "+token)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)

	if w3.Code != http.StatusOK {
		t.Fatalf("update task: expected 200, got %d: %s", w3.Code, w3.Body.String())
	}

	var updatedTask map[string]interface{}
	json.Unmarshal(w3.Body.Bytes(), &updatedTask)
	if updatedTask["status"] != "in_progress" {
		t.Fatalf("expected status 'in_progress', got %v", updatedTask["status"])
	}

	// Delete task
	req4 := httptest.NewRequest(http.MethodDelete, fmt.Sprintf("/api/tasks/%s", taskID), nil)
	req4.Header.Set("Authorization", "Bearer "+token)
	w4 := httptest.NewRecorder()
	r.ServeHTTP(w4, req4)

	if w4.Code != http.StatusNoContent {
		t.Fatalf("delete task: expected 204, got %d: %s", w4.Code, w4.Body.String())
	}

	// List tasks — should be empty after delete
	req5 := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/projects/%s/tasks", projectID), nil)
	req5.Header.Set("Authorization", "Bearer "+token)
	w5 := httptest.NewRecorder()
	r.ServeHTTP(w5, req5)

	if w5.Code != http.StatusOK {
		t.Fatalf("list tasks: expected 200, got %d: %s", w5.Code, w5.Body.String())
	}

	var listResp map[string]interface{}
	json.Unmarshal(w5.Body.Bytes(), &listResp)
	tasks, ok := listResp["tasks"].([]interface{})
	if !ok {
		t.Fatalf("list tasks: expected tasks array, got: %v", listResp)
	}
	if len(tasks) != 0 {
		t.Fatalf("list tasks: expected 0 tasks after delete, got %d", len(tasks))
	}
}

func TestLogoutRevokesToken(t *testing.T) {
	pool := setupTestDB(t)
	defer pool.Close()
	r := setupRouter(pool)

	cleanupUser(pool, "logout@test.com")
	t.Cleanup(func() {
		cleanupUser(pool, "logout@test.com")
		pool.Exec(context.Background(), "DELETE FROM revoked_tokens")
	})

	token := registerUser(t, r, "Logout User", "logout@test.com", "testpass123")

	// Verify token works before logout
	req := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("pre-logout request: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// Logout
	req2 := httptest.NewRequest(http.MethodPost, "/api/auth/logout", nil)
	req2.Header.Set("Authorization", "Bearer "+token)
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)

	if w2.Code != http.StatusNoContent {
		t.Fatalf("logout: expected 204, got %d: %s", w2.Code, w2.Body.String())
	}

	// Verify token is rejected after logout
	req3 := httptest.NewRequest(http.MethodGet, "/api/projects", nil)
	req3.Header.Set("Authorization", "Bearer "+token)
	w3 := httptest.NewRecorder()
	r.ServeHTTP(w3, req3)

	if w3.Code != http.StatusUnauthorized {
		t.Fatalf("post-logout request: expected 401, got %d: %s", w3.Code, w3.Body.String())
	}
}
