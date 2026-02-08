# Dominator Training

> A premium Rocket League AI training platform with a game-like player experience and an admin AI Ops dashboard for model lifecycle management.

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOMINATOR TRAINING                          │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐ │
│  │  Next.js  │──▶│  FastAPI  │──▶│ Postgres │   │    Redis    │ │
│  │   :3000   │   │   :8000   │   │  :5432   │   │   :6379     │ │
│  └──────────┘   └────┬─────┘   └──────────┘   └──────┬──────┘ │
│                      │                                │         │
│                      │         ┌──────────┐           │         │
│                      └────────▶│ RQ Worker │◀──────────┘         │
│                                └──────────┘                     │
│                                                                 │
│  Player: Train → Live Session → Summary → Drill Recommendation  │
│  Admin:  Models → Runs → Evals → Gates → Promote                │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Clone and start everything with Docker Compose
cd infra
docker compose up --build

# In another terminal — run migrations and seed demo data
docker compose exec api alembic upgrade head
docker compose exec api python -c "
import sys; sys.path.insert(0, '/app')
exec(open('/app/../../../scripts/seed_demo_data.py').read())
"

# Or seed from the host (requires Python + deps):
cd scripts
pip install sqlalchemy psycopg2-binary passlib[bcrypt]
python seed_demo_data.py
```

**Open the app:**
- Frontend: http://localhost:3000
- API docs: http://localhost:8000/api/docs
- Admin: sign in as `admin@dominator.gg` / `admin123`
- Player: sign in as `player@dominator.gg` / `player123`

## Architecture

### Monorepo Layout

```
repo/
├── apps/
│   ├── web/                 # Next.js 14 (App Router)
│   │   ├── src/
│   │   │   ├── app/         # Pages (file-based routing)
│   │   │   ├── components/  # UI components
│   │   │   ├── hooks/       # React hooks (auth, theme)
│   │   │   ├── lib/         # API client, utilities
│   │   │   ├── styles/      # Global CSS + Tailwind
│   │   │   └── types/       # TypeScript interfaces
│   │   └── ...
│   └── api/                 # FastAPI (Python)
│       ├── app/
│       │   ├── api/routes/  # Endpoint handlers
│       │   ├── core/        # Config, security
│       │   ├── db/          # SQLAlchemy models, session
│       │   ├── jobs/        # RQ background jobs
│       │   ├── middleware/   # Auth middleware
│       │   └── schemas/     # Pydantic v2 schemas
│       ├── migrations/      # Alembic migrations
│       └── tests/           # pytest tests
├── packages/
│   └── shared/              # Shared TypeScript types
├── infra/
│   └── docker-compose.yml   # Full dev environment
├── scripts/
│   ├── seed_demo_data.py    # Seed database with demo data
│   ├── ingest_training_jsonl.py  # Ingest JSONL logs
│   └── simulate_training_run.py  # Generate simulated log
└── data/
    └── artifacts/           # Local artifact storage
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, TailwindCSS, Recharts, TanStack Query |
| Backend | FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 + RQ (Redis Queue) |
| Auth | JWT (HTTP-only cookies) with bcrypt password hashing |
| Streaming | Server-Sent Events (SSE) via sse-starlette |

### Design System

Dark theme by default with Apple-premium + game-like aesthetics:

- **Base**: `#0B0D12` — near-black background
- **Surface**: `#111522` — card backgrounds
- **Accent**: `#00D4FF` — electric cyan for primary actions
- **Typography**: Outfit (display) + DM Sans (body) + JetBrains Mono (code)
- **Components**: Card, HUDPanel, Badge, StatChip, DifficultySlider, SegmentedControl, ModelTagBadge, HealthIndicator

## Environment Variables

### Backend (`apps/api`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://dominator:dominator_dev@localhost:5432/dominator` | Async Postgres URL |
| `DATABASE_URL_SYNC` | `postgresql://dominator:dominator_dev@localhost:5432/dominator` | Sync Postgres URL (for workers/scripts) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `SECRET_KEY` | `dev-secret-key-change-in-production` | JWT signing key |
| `ARTIFACTS_DIR` | `./data/artifacts` | Local artifact storage path |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated CORS origins |

### Frontend (`apps/web`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

## API Documentation

Full OpenAPI docs available at `http://localhost:8000/api/docs` when running.

### Key Endpoints

#### Auth
```
POST /api/auth/register  { email, password, role? }  → { access_token, user }
POST /api/auth/login     { email, password }          → { access_token, user }
POST /api/auth/logout                                 → { ok }
GET  /api/auth/me                                     → User
```

#### Models
```
GET    /api/models                              → Model[]
POST   /api/models          { name, version }   → Model
PATCH  /api/models/{id}     { tag? }            → Model
POST   /api/models/{id}/promote                 → Model (candidate→stable)
```

#### Training Runs
```
POST /api/training-runs/start     { model_id, config_json }  → TrainingRun
POST /api/training-runs/{id}/stop                             → TrainingRun
GET  /api/training-runs                                       → TrainingRun[]
GET  /api/training-runs/{id}                                  → TrainingRunDetail
GET  /api/training-runs/{id}/checkpoints                      → Checkpoint[]
```

#### SSE Streaming
```
GET /api/stream/training-runs/{id}   → SSE: { step, avg_reward, entropy, loss_pi, loss_v }
GET /api/stream/evals/{id}           → SSE: { percent, status }
```

#### Evals
```
GET  /api/eval-suites                → EvalSuite[]
POST /api/eval-suites    { name }    → EvalSuite
POST /api/evals/run      { checkpoint_id, suite_id }  → EvalResult
GET  /api/evals/{id}                 → EvalResult
GET  /api/evals/compare?base_checkpoint_id=...&candidate_checkpoint_id=...  → EvalCompare
```

#### Sessions (Player)
```
POST /api/sessions/start       { mode, difficulty, opponent_style }  → Session
POST /api/sessions/{id}/event  { t_ms, type, payload_json }         → SessionEvent
POST /api/sessions/{id}/end    { score_json }                       → Session
GET  /api/sessions                                                   → Session[]
GET  /api/sessions/{id}/summary                                      → SessionSummary
```

## SSE Streaming

The API uses Server-Sent Events for real-time updates:

```javascript
// Client-side usage
const source = new EventSource('/api/stream/training-runs/{id}');
source.addEventListener('metrics', (e) => {
  const data = JSON.parse(e.data);
  // { step, avg_reward, entropy, loss_pi, loss_v }
});
source.addEventListener('done', () => source.close());
```

Backend implementation uses `sse-starlette`:
```python
from sse_starlette.sse import EventSourceResponse

async def stream_run(run_id):
    async def generator():
        yield {"event": "metrics", "data": json.dumps({...})}
    return EventSourceResponse(generator())
```

## How to Add New Eval Metrics

1. Add column to `EvalResult` model in `apps/api/app/db/models.py`
2. Add field to `EvalResultResponse` schema in `apps/api/app/schemas/__init__.py`
3. Create Alembic migration: `alembic revision --autogenerate -m "add_new_metric"`
4. Update `run_eval_job` in `apps/api/app/jobs/eval_job.py` to compute the metric
5. Add to compare view in `apps/web/src/app/admin/evals/page.tsx`
6. Optionally add as a gate check

## How to Add New Session Insight Events

1. Define new event type string (e.g., `"wall_read"`)
2. Client sends: `POST /api/sessions/{id}/event { t_ms, type: "wall_read", payload_json: {...} }`
3. Add insight generation logic to `_generate_summary()` in `apps/api/app/api/routes/sessions.py`
4. Display in session summary page timeline

## Scripts

```bash
# Seed demo data
python scripts/seed_demo_data.py

# Generate simulated JSONL training log
python scripts/simulate_training_run.py [output_path]

# Ingest a JSONL log into a training run
python scripts/ingest_training_jsonl.py <run_id> <path_to_jsonl>
```

## Testing

```bash
# Backend tests
cd apps/api
pytest tests/ -v

# Frontend tests
cd apps/web
npm test
```

## Deployment Guide (Self-Host)

### Prerequisites
- Docker + Docker Compose
- Domain with SSL certificate (for production)

### Steps

1. **Reverse Proxy**: Set up nginx/Caddy in front of the API (port 8000) and web (port 3000)

2. **Environment**: Set production values:
   ```env
   SECRET_KEY=<generate-a-strong-secret>
   DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/dominator
   CORS_ORIGINS=https://yourdomain.com
   ```

3. **Migrations**: `docker compose exec api alembic upgrade head`

4. **Worker Scaling**: Scale RQ workers horizontally:
   ```yaml
   worker:
     deploy:
       replicas: 3
   ```

5. **Storage**: For production, swap local filesystem to S3/MinIO by updating the artifact storage abstraction in the API.

6. **Monitoring**: The `/api/health` endpoint can be used for load balancer health checks.

## License

Internal use only.
