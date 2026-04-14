# Taskflow

Kanban-style task board built with React + Supabase.

**Live:** (https://taskflow-brown-six.vercel.app/)

## Features

- 4-column board (To Do, In Progress, In Review, Done)
- Drag-and-drop between columns
- Task creation with title, description, priority, due date
- Labels/tags with board-level filtering
- Due date indicators (overdue, today, soon)
- Anonymous auth with per-user data isolation (RLS)
- Search by task title

## Tech

- **Frontend:** React (Vite)
- **Database & Auth:** Supabase (Postgres + Anonymous Auth + RLS)
- **Hosting:** Vercel

## Setup

```bash
git clone (https://github.com/TalaalMaxood05/taskflow.git)
cd taskflow
npm install
```

Create `.env`:

```
VITE_SUPABASE_URL= your_supabase_url
VITE_SUPABASE_ANON_KEY= your_anon_key
```

Run the SQL schema in Supabase SQL Editor (see `schema.sql` or the deliverable doc), enable Anonymous Auth in Supabase dashboard, then:

```bash
npm run dev
```