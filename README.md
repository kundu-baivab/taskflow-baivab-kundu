# TaskFlow

A full-stack Kanban task management application with JWT auth, PostgreSQL, role-aware permissions, project pagination, and drag-and-drop task workflow.

## Features

- Secure authentication with register/login/logout and JWT token revocation (DB blocklist).
- Project management with ownership controls (owner-only update/delete).
- Task management with granular permissions:
  - Any authenticated user can create tasks in any project.
  - Task update allowed for project owner, task creator, or assignee.
  - Task delete allowed for project owner or task creator.
- Kanban board with drag-and-drop status transitions (`todo`, `in_progress`, `done`).
- Non-draggable task UX for unauthorized users (lock icon + blocked drag handle).
- Assignee support end-to-end (assign task to any user, filter by assignee).
- Project list pagination with user page-size preference (`5`, `10`, `15`) persisted in local storage.
- Themed UI (light/dark), themed scrollbars, and column-level scrolling for Kanban.
- React Query hooks-based API layer with optimistic updates for task moves.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go 1.22, Chi router, pgx, golang-jwt, bcrypt, slog |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, dnd-kit |
| Database | PostgreSQL 16 |
| Infra | Docker Compose, multi-stage Dockerfiles, golang-migrate |

## Architecture

- Backend follows `Handler -> Service -> Repository`.
  - Handlers: request parsing, validation, HTTP response mapping.
  - Services: business logic and authorization rules.
  - Repositories: SQL access via pgx (no ORM).
- Frontend uses model-scoped API clients and query/mutation hooks:
  - `frontend/src/api/*` for HTTP functions.
  - `frontend/src/hooks/*` for React Query orchestration.

## Database Schema

### Basic Data Model
```
- users
  - id (UUID, PK)
  - name (TEXT)
  - email (TEXT, UNIQUE)
  - password (TEXT, bcrypt hash)
  - created_at (TIMESTAMPTZ)

- projects
  - id (UUID, PK)
  - name (TEXT)
  - description (TEXT)
  - owner_id (UUID, FK -> users.id)
  - created_at (TIMESTAMPTZ)

- tasks
  - id (UUID, PK)
  - title (TEXT)
  - description (TEXT)
  - status (task_status)
  - priority (task_priority)
  - project_id (UUID, FK -> projects.id)
  - creator_id (UUID, FK -> users.id, nullable)
  - assignee_id (UUID, FK -> users.id, nullable)
  - due_date (DATE, nullable)
  - created_at (TIMESTAMPTZ)
  - updated_at (TIMESTAMPTZ)

- revoked_tokens
  - jti (TEXT, PK)
  - expires_at (TIMESTAMPTZ)
```

### Relationships

- One user can own many projects.
- One project can have many tasks.
- One user can create many tasks.
- One user can be assigned many tasks.
- `revoked_tokens` stores invalidated JWT IDs until expiration.

Enums:
- `task_status`: `todo`, `in_progress`, `done`
- `task_priority`: `low`, `medium`, `high`

## Getting Started (Docker)

### Prerequisites

- Docker
- Docker Compose

### 1) Configure environment

```bash
cp .env.example .env
```

### 2) Start the stack

```bash
docker compose up --build
```

Services:
- Frontend: `http://localhost:3000`
- API: `http://localhost:8080`
- PostgreSQL (host): `127.0.0.1:5433`

### 3) Stop the stack

```bash
docker compose down
```

To wipe DB volume too:

```bash
docker compose down -v
```

## Environment Variables

Defined in `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `POSTGRES_USER` | Yes | PostgreSQL username for container bootstrap |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password for container bootstrap |
| `POSTGRES_DB` | Yes | Initial database name |
| `DATABASE_URL` | Yes | Backend DB connection string (inside Docker network uses host `db`) |
| `JWT_SECRET` | Yes | HMAC secret for signing JWT tokens |
| `API_PORT` | No | Backend HTTP port (defaults to `8080`) |
| `TEST_DATABASE_URL` | For tests | Host-side DB URL for integration tests (`127.0.0.1:5433`) |

## Migrations and Seed Data

- Migrations run automatically at API container startup via `backend/entrypoint.sh`.
- Current migrations include:
  - `000001_init` (core schema)
  - `000002_revoked_tokens` (JWT revocation blocklist table)
- Seed data is applied by backend code (`backend/internal/seed/seed.go`) after DB connection.

### Default Test Credentials

```
Email: test@example.com
Password: password123
```

## API Reference

All endpoints return JSON.  
Protected endpoints require `Authorization: Bearer <token>`.

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Register user with `{ name, email, password }`, returns `{ token, user }` |
| `POST` | `/api/auth/login` | No | Login with `{ email, password }`, returns `{ token, user }` |
| `POST` | `/api/auth/logout` | Yes | Revokes current JWT (`204 No Content`) |

### Users

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/users` | Yes | List all users (for assignment and owner display) |

### Projects

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects?page=<n>&limit=<n>` | Yes | List all projects with pagination (`page` default `1`, `limit` default `10`) |
| `POST` | `/api/projects` | Yes | Create project with `{ name, description }` |
| `GET` | `/api/projects/:id` | Yes | Get project details and tasks |
| `PATCH` | `/api/projects/:id` | Yes | Update project (owner only) |
| `DELETE` | `/api/projects/:id` | Yes | Delete project and its tasks (owner only) |

### Tasks

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/projects/:id/tasks?status=<status>&assignee=<userId>` | Yes | List project tasks, optional filters |
| `POST` | `/api/projects/:id/tasks` | Yes | Create task in project; creator is the authenticated user |
| `PATCH` | `/api/tasks/:id` | Yes | Update task fields (`title`, `description`, `status`, `priority`, `assignee_id`, `due_date`) |
| `DELETE` | `/api/tasks/:id` | Yes | Delete task |
| `GET` | `/api/projects/:id/stats` | Yes | Aggregated counts by status and assignee |

## Authorization Model

### Project Rules

- View project/list projects: any authenticated user.
- Create project: any authenticated user (creator becomes owner).
- Update/Delete project: owner only.

### Task Rules

- View tasks: any authenticated user (project must exist).
- Create task: any authenticated user in any project.
- Update task (including drag status change): project owner OR task creator OR assignee.
- Delete task: project owner OR task creator.

## JWT Revocation

- JWT includes a unique `jti` claim.
- On logout, backend stores `{ jti, expires_at }` in `revoked_tokens`.
- Auth middleware rejects requests with revoked `jti`.
- A background purge job periodically deletes expired revoked-token rows.

## Running Tests Locally

### Backend integration tests (recommended flow)

1. Start Docker services (at least DB, usually full stack is easiest):

```bash
docker compose up -d
```

2. Run backend integration tests from `backend`:

```bash
cd backend
export TEST_DATABASE_URL="postgres://taskflow:taskflow@127.0.0.1:5433/taskflow?sslmode=disable"
go test -v ./internal/handler
```

On PowerShell (Windows):

```powershell
cd backend
$env:TEST_DATABASE_URL="postgres://taskflow:taskflow@127.0.0.1:5433/taskflow?sslmode=disable"
go test -v ./internal/handler
```

## Project Structure

```text
.
├─ backend/
│  ├─ cmd/server/                 # backend entrypoint package
│  ├─ internal/
│  │  ├─ config/                  # env loading
│  │  ├─ handler/                 # HTTP handlers + integration tests
│  │  ├─ middleware/              # auth + logging middleware
│  │  ├─ model/                   # domain structs
│  │  ├─ repository/              # SQL data access
│  │  ├─ service/                 # business logic and permissions
│  │  └─ seed/                    # runtime seed data
│  ├─ migrations/                 # SQL migrations
│  ├─ entrypoint.sh               # container startup script (run migrations, then start server)
│  └─ Dockerfile                  # builds Go API image for Docker Compose
├─ frontend/
│  ├─ index.html                  # Vite HTML entry document
│  ├─ src/
│  │  ├─ main.tsx                 # frontend app entrypoint (mounts React app)
│  │  ├─ App.tsx                  # root app routing/layout shell
│  │  ├─ api/                     # HTTP API calls
│  │  ├─ hooks/                   # React Query hooks
│  │  ├─ components/              # UI components
│  │  ├─ context/                 # auth/theme context
│  │  ├─ pages/                   # route pages
│  │  └─ types/                   # shared TS types
│  ├─ nginx.conf                  # Nginx runtime config for serving built frontend
│  └─ Dockerfile                  # multi-stage frontend build + Nginx serve image
├─ docker-compose.yml
├─ .env.example
└─ README.md
```

### Key Entry and Infra Files

- `backend/cmd/server/main.go`: backend runtime entrypoint; wires repositories/services/handlers, routes, middleware, and background purge job.
- `backend/entrypoint.sh`: container entry script; runs DB migrations before starting the API binary.
- `backend/Dockerfile`: builds the backend image used by `docker-compose`.
- `frontend/src/main.tsx`: frontend runtime entrypoint; bootstraps React and providers.
- `frontend/Dockerfile`: builds static frontend assets and serves them through Nginx in the final container.
- `frontend/nginx.conf`: controls frontend container web serving behavior.
- `docker-compose.yml`: orchestrates `db`, `api`, and `frontend` services with networking, env vars, health checks, and ports.
