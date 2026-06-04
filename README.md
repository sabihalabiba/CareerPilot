# CareerPilot

AI-powered career co-pilot for tech job seekers in Bangladesh.
Upload your CV and get instant chat coaching, fit scoring, job recommendations,
cover letters, learning roadmaps, skill-gap analysis, and an application tracker.

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind v4
- **Backend:** FastAPI + Groq (Llama 3.3 70B) + Supabase (Postgres + REST)
- **PDF parsing:** PyMuPDF (`fitz`)

---

## Project structure

```
careerpilot/
├── backend/            # FastAPI service
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/           # Next.js 16 app
│   ├── app/
│   ├── package.json
│   └── ...
└── start.bat           # one-click dev launcher (Windows)
```

---

## Prerequisites

- **Python** 3.10 or newer
- **Node.js** 20 or newer
- **npm** 10+
- A **Groq** API key — https://console.groq.com
- A **Supabase** project — https://supabase.com
  - Two tables: `cvs`, `applications`, `goals` (see schema below)

### Supabase schema (run in SQL editor)

```sql
create table cvs (
  user_id text primary key,
  cv_text text,
  updated_at timestamp with time zone default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  job_title text not null,
  company text not null,
  status text default 'applied',
  deadline text,
  created_at timestamp with time zone default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  text text not null,
  deadline text,
  category text default 'General',
  done boolean default false,
  created_at timestamp with time zone default now()
);
```

Enable Row Level Security is **not** required for the demo — the anon key is used
directly with public REST access. Lock down policies before any real deployment.

---

## Setup

### 1. Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
# edit .env and fill in your real keys
```

### 2. Frontend

```powershell
cd ..\frontend
npm install
```

---

## Run the app

### Option A — one click (Windows)

From the project root:

```powershell
.\start.bat
```

This opens two new terminal windows: one for the FastAPI server (port 8000) and
one for the Next.js dev server (port 3000).

### Option B — manually

**Terminal 1 — backend**

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

**Terminal 2 — frontend**

```powershell
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Configuration

### Backend env vars (`backend/.env`)

| Variable        | Description                                   |
| --------------- | --------------------------------------------- |
| `GROQ_API_KEY`  | Groq API key (Llama 3.3 70B Versatile model)  |
| `SUPABASE_URL`  | Your Supabase project URL                     |
| `SUPABASE_KEY`  | Supabase `anon` public key                    |

### Frontend

The frontend hard-codes the API base URL to `http://localhost:8000` in
`app/page.tsx`. Change the `API` constant there to point at a deployed backend.

---

## Features

- **CV upload** — PDF parsed by PyMuPDF, indexed by section, stored in Supabase.
- **AI chat coach** — RAG-style retrieval over the CV with rolling 6-message memory.
- **Fit score** — extracts skills from both CV and JD, returns % match + gaps.
- **Job search** — generates 3 Bangladesh-specific job listings matched to your CV.
- **Cover letter** — personalised letter grounded in your actual CV experience.
- **Roadmap** — week-by-week learning plan using only free resources.
- **Skill gap** — compares your CV to a target role and prioritises what to learn.
- **Application tracker** — Kanban-style board across `applied → interviewing → offer → rejected`.
- **Goals tracker** — weekly goals with completion progress.
- **Dashboard** — pipeline view and roadmap progress.
- **AI nudge** — on-demand motivational message based on current activity.

---

## API reference

All routes are defined in `backend/main.py`. Quick health check:

```powershell
curl http://localhost:8000/health
# {"status":"ok"}
```

Full route list:

- `GET  /` — service banner
- `GET  /health` — health probe
- `POST /upload-cv/{user_id}` — multipart PDF upload
- `POST /chat` — RAG chat with memory
- `POST /fit-score` — CV vs JD match analysis
- `POST /search-jobs` — generate job listings
- `POST /cover-letter` — generate cover letter
- `POST /roadmap` — generate learning roadmap
- `POST /skill-gap` — analyse skill gap
- `POST /nudge` — motivational nudge
- `POST /add-application` — add tracked application
- `GET  /applications/{user_id}` — list applications
- `PATCH /applications/{app_id}` — update application status
- `POST /add-goal` — add goal
- `GET  /goals/{user_id}` — list goals
- `PATCH /goals/{goal_id}?done=true|false` — toggle goal
- `GET  /dashboard/{user_id}` — dashboard summary
- `DELETE /memory/{user_id}` — clear chat memory

---

## Demo user

The frontend ships with a hard-coded `USER_ID = "demo-user"` for simplicity.
**Authentication is not implemented** — all data is scoped to this single demo
user. To support multiple users, add a real auth layer (Supabase Auth, NextAuth,
etc.) and pass the resolved `user_id` from the client instead of the constant.

---

## Deployment notes

- The backend is a single-file FastAPI app — works on any Python 3.10+ host
  (Render, Fly.io, Railway, a small VM).
- The frontend is a standard Next.js 16 app — deploys to Vercel with `npm run build`.
- For self-hosted frontend, set `output: "standalone"` in `next.config.ts` and
  run `node .next/standalone/server.js`.
- Set restrictive CORS origins in `main.py` before going to production
  (`allow_origins=["*"]` is dev-only).

---

## License

Internal demo project. Not licensed for redistribution.
