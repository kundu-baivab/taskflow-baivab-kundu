# Overview

TaskFlow is a full-stack Kanban task management system where authenticated users can create projects, create and assign tasks, move tasks across workflow states, and collaborate with role-based permissions.

## Features

- JWT-based authentication with logout revocation.
- Project CRUD with owner-only update/delete.
- Task CRUD with owner/creator/assignee authorization rules.
- Kanban board with drag-and-drop status transitions.
- Assignee filtering and project pagination.
- Dockerized local development and integration testing.

## Tech Stack


| Layer    | Technology                                                                   |
| -------- | ---------------------------------------------------------------------------- |
| Backend  | Go 1.22, Chi router, pgx, golang-jwt, bcrypt, slog                           |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, dnd-kit |
| Database | PostgreSQL 16                                                                |
| Infra    | Docker Compose, multi-stage Dockerfiles, golang-migrate                      |


## Architecture Decisions

### Why this structure
- **Handler -> Service -> Repository**
  - Handlers manage HTTP concerns (validation, status codes, response shape).
  - Services hold business rules and authorization checks.
  - Repositories isolate SQL and DB access via pgx.
- This split keeps domain logic testable and prevents HTTP/SQL coupling.
### Frontend organization choices
- `src/api/*` contains transport-level API calls.
- `src/hooks/*` contains React Query orchestration (query keys, cache invalidation, optimistic updates).
- UI components stay focused on rendering and interaction.
### Tradeoffs made
- **No persistent same-column ordering:** task order is currently returned by backend query order (newest first).
- **No realtime sync yet:** task changes are reflected on refetch, not pushed instantly.
- **JWT revocation uses Postgres blocklist:** chosen for simplicity/correctness over Redis complexity in initial scope.
### Intentionally left out (and why)
- **Refresh-token rotation:** skipped to keep auth flow lean for assignment scope.
- **WebSocket/SSE layer:** deferred due to infra complexity and operational overhead.
- **Advanced search/audit log:** deferred to prioritize core CRUD, permissions, and security path.

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

Enums:
- `task_status`: `todo`, `in_progress`, `done`
- `task_priority`: `low`, `medium`, `high`

## Running Locally

### Prerequisites

- Docker
- Docker Compose

### 1) Configure environment

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
cp .env.example .env
```

### 2) Start the stack

```bash
docker compose up
```

Services:

- Frontend: `http://localhost:3000`
- API: `http://localhost:8080`
- PostgreSQL (host): `127.0.0.1:5433`

### 3) Stop the stack

```bash
docker compose down
```

To wipe DB volume too (optional):

```bash
docker compose down -v
```

## Migrations and Seed Data

- Migrations run automatically at API container startup via `backend/entrypoint.sh`.
- Current migrations include:
  - `000001_init` (core schema)
  - `000002_revoked_tokens` (JWT revocation blocklist table)
- Seed data is applied by backend code (`backend/internal/seed/seed.go`) after DB connection.

If you need to rerun from a clean state:
```bash
docker compose down -v
docker compose up --build
```

### Default Test Credentials

```
Email: test@example.com
Password: password123
```

## API Reference

All endpoints return JSON.  
Protected endpoints require `Authorization: Bearer <token>`.

### Auth


| Method | Endpoint             | Auth | Description                                                               |
| ------ | -------------------- | ---- | ------------------------------------------------------------------------- |
| `POST` | `/api/auth/register` | No   | Register user with `{ name, email, password }`, returns `{ token, user }` |
| `POST` | `/api/auth/login`    | No   | Login with `{ email, password }`, returns `{ token, user }`               |
| `POST` | `/api/auth/logout`   | Yes  | Revokes current JWT (`204 No Content`)                                    |

#### POST `/api/auth/register`
```json
// Request
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }

// Response 201
{
  "token": "<jwt>",
  "user": {
    "id": "a1111111-1111-1111-1111-111111111111",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "created_at": "2026-04-15T10:00:00Z"
  }
}
```

#### POST `/api/auth/logout`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Response 204
{}
```

### Users


| Method | Endpoint     | Auth | Description                                       |
| ------ | ------------ | ---- | ------------------------------------------------- |
| `GET`  | `/api/users` | Yes  | List all users (for assignment and owner display) |

#### GET `/api/users`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Response 200
{
  "users": [
    {
      "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "name": "Test User",
      "email": "test@example.com",
      "created_at": "2026-04-15T09:00:00Z"
    }
  ]
}
```

### Projects


| Method   | Endpoint                           | Auth | Description                                                                  |
| -------- | ---------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `GET`    | `/api/projects?page=<n>&limit=<n>` | Yes  | List all projects with pagination (`page` default `1`, `limit` default `10`) |
| `POST`   | `/api/projects`                    | Yes  | Create project with `{ name, description }`                                  |
| `GET`    | `/api/projects/:id`                | Yes  | Get project details and tasks                                                |
| `PATCH`  | `/api/projects/:id`                | Yes  | Update project (owner only)                                                  |
| `DELETE` | `/api/projects/:id`                | Yes  | Delete project and its tasks (owner only)                                    |

### GET `/api/projects?page=1&limit=10`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Response 200
{
  "projects": [
    {
      "id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
      "name": "Website Redesign",
      "description": "Q2 redesign of the company website",
      "owner_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      "created_at": "2026-04-15T09:10:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

#### POST `/api/projects`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Request Body
{ "name": "Mobile App", "description": "TaskFlow mobile MVP" }

// Response 201
{
  "id": "c2222222-2222-2222-2222-222222222222",
  "name": "Mobile App",
  "description": "TaskFlow mobile MVP",
  "owner_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "created_at": "2026-04-15T11:00:00Z"
}
```

#### PATCH `/api/projects/:id`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Request Body
{ "name": "Website Redesign v2", "description": "Updated scope" }

// Response 200
{
  "id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  "name": "Website Redesign v2",
  "description": "Updated scope",
  "owner_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "created_at": "2026-04-15T09:10:00Z"
}
```

#### DELETE `/api/projects/:id`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Response 204
{}
```

### Tasks


| Method   | Endpoint                                                    | Auth | Description                                                                                  |
| -------- | ----------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------- |
| `GET`    | `/api/projects/:id/tasks?status=<status>&assignee=<userId>` | Yes  | List project tasks, optional filters                                                         |
| `POST`   | `/api/projects/:id/tasks`                                   | Yes  | Create task in project; creator is the authenticated user                                    |
| `PATCH`  | `/api/tasks/:id`                                            | Yes  | Update task fields (`title`, `description`, `status`, `priority`, `assignee_id`, `due_date`) |
| `DELETE` | `/api/tasks/:id`                                            | Yes  | Delete task                                                                                  |
| `GET`    | `/api/projects/:id/stats`                                   | Yes  | Aggregated counts by status and assignee                                                     |

### PATCH `/api/tasks/:id`
```json
// Request Headers
{ "Authorization": "Bearer <jwt>" }

// Request Body
{ "status": "in_progress" }

// Response 200
{
  "id": "d3333333-3333-3333-3333-333333333333",
  "title": "Implement auth middleware",
  "description": "Add blocklist check for revoked tokens",
  "status": "in_progress",
  "priority": "high",
  "project_id": "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
  "creator_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "assignee_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "due_date": "2026-04-20",
  "created_at": "2026-04-15T12:00:00Z",
  "updated_at": "2026-04-15T12:30:00Z"
}
```

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

1. Run backend integration tests from `backend`:

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

## What I'd Do With More Time
- Persist task ordering within columns: Right now, tasks are rendered in the order returned by the backend/current query flow(newest first), so same-column drag position is not permanently saved. I prioritized status transitions and permissions first; next step would be adding a position field plus reorder API so column order persists across reloads and users.
- Upgrade JWT revocation to Redis-backed sessions: I implemented database blocklist revocation for correctness and simplicity, but not the Redis version due to time constraints. With more time, I’d move revocation/session checks to Redis for faster lookups, token rotation support, and cleaner multi-device/session invalidation at scale.
- Expand automated test coverage: I focused on integration-critical flows (including logout revocation), but I’d add deeper service-level unit tests and more authorization edge cases (owner vs creator vs assignee across update/delete/dnd).
- Realtime task updates (WebSocket/SSE): Right now users only see changes after refresh/refetch. Realtime updates would push task create/update/delete and status moves instantly to all connected clients viewing the same project, so boards stay in sync without manual reload.
- Addition of search and activity/audit timeline: Search would let users quickly filter projects/tasks by title, description, assignee, status, etc. An activity/audit timeline would record who changed what and when (created task, reassigned, moved status, deleted), improving traceability, debugging, and team accountability.
