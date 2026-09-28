# SIWES Outreach Tracker

A personal tool for tracking outreach to Nigerian Cloud/DevOps companies. It has a pipeline board, an interaction timeline, AI-drafted follow ups (never sent automatically), response analytics, and push reminders. It installs on your phone as a PWA.

```
backend/   Django REST Framework API (Postgres on Render, SQLite locally)
frontend/  React + Vite PWA (Vercel)
           backend/data/companies.csv holds the 50 researched companies (seed data)
```

## Run it locally

```bash
# Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env              # add LLM_API_KEY to enable drafting
.venv/bin/python manage.py migrate
.venv/bin/python manage.py import_companies data/companies.csv
.venv/bin/python manage.py runserver

# Frontend (second terminal)
cd frontend
npm install
npm run dev                       # http://localhost:5173
```

Run the tests with `.venv/bin/python manage.py test tracker`.

## How it behaves

- **Status moves forward on its own.** Logging a sent message moves a company from Not Contacted to Sent. Logging a reply moves it to Opened/Replied. Everything after that (In Conversation, Interview, Closed) you set yourself, either with the dropdown on a card or by dragging the card to another column.
- **Follow ups.** The daily check creates a follow up (with an AI draft) for any company that has sat in Sent for more than `FOLLOWUP_AFTER_DAYS` (default 7) with no reply. You can also press **Draft follow up** on a company. Edit the draft, copy it, send it yourself, then press **I sent this**. That logs it on the timeline and restarts the silence timer.
- **Drafting voice** uses a fixed tone instruction (warm, professional, no dashes), plus your three most recent sent messages as style examples. The more real messages you log, the more drafts sound like you.
- **Analytics** are all computed from the interaction log. A company counts as "responded" once any reply is logged. Response rate by channel counts only replies on the same channel the message went out on.
- **Importing again** with `import_companies` updates companies by name. It never duplicates them and never touches their status.

## Deploy

### Backend on Render
1. Push this folder to a GitHub repo, then in Render choose **New > Blueprint** and pick the repo. `render.yaml` creates the web service and a free Postgres database.
2. Fill in the env vars it asks for:
   - `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL`: your Vercel URL, e.g. `https://siwes-tracker.vercel.app`
   - `LLM_API_KEY`: your Groq (`gsk_…`), xAI (`xai-…`) or Anthropic (`sk-ant-…`) key. The provider is picked from the prefix. `LLM_MODEL` is optional.
   - `ACCESS_KEY`: any long random string. **Set this.** The API has no accounts, so without it anyone who finds the URL can read your data and spend your LLM credits. The app asks for the key once per device.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: generate them with `python manage.py generate_vapid_keys`
3. Load the companies once, from your own machine. In Render, open the database and copy its **External Database URL**, then run:
   ```bash
   cd backend
   DATABASE_URL='<external database url>' .venv/bin/python manage.py import_companies data/companies.csv
   ```

Note: Render's free Postgres expires after 30 days unless you upgrade it. Export a backup before then, or move to a paid plan.

### Frontend on Vercel
Import the repo, set **Root Directory** to `frontend`, and add `VITE_API_URL=https://<your-render-service>.onrender.com`. `vercel.json` handles client-side routes and makes sure the service worker is never served stale.

### Daily follow-up check
`.github/workflows/daily-check.yml` calls `POST /api/cron/daily/` every day at 08:00 Lagos time. It is free and also wakes the sleeping Render service. Add two repo secrets: `API_URL` (the Render URL) and `CRON_SECRET` (copy the value Render generated). To run it by hand, use `python manage.py check_followups`, or `--no-draft` to skip the API calls.

### Notifications on your phone
Open the Vercel URL on your phone and choose **Add to Home Screen**. Open the app from the home screen, then tap **Turn on notifications**. On iPhone, push only works from the installed home-screen app (iOS 16.4+), not from a Safari tab.
