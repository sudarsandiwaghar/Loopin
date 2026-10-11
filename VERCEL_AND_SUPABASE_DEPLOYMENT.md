# Deploying Loopin on Vercel with Supabase Backend

This guide walks you through deploying **Loopin** (Multi-Tier Institutional Workflow & Governance Engine) on **Vercel** with a **Supabase** cloud PostgreSQL database in under 5 minutes.

---

## Architecture Overview

- **Frontend**: React 19 + Vite + Tailwind CSS v4 (compiled to static assets in `dist/` and hosted globally on Vercel Edge CDN).
- **Backend**: Express API running as a Vercel Serverless Function (`api/index.ts`).
- **Database**: Supabase PostgreSQL with real-time cloud persistence, relational tables, and automatic snapshot hydration.

---

## Step 1: Set Up Supabase

1. Go to [https://database.new](https://database.new) (or log in to [Supabase](https://supabase.com/)) and create a new project (e.g. `loopin-db`).
2. Once your database is provisioned, go to **SQL Editor** in the left sidebar.
3. Open [`supabase/schema.sql`](supabase/schema.sql) from this repository, copy its contents, and run it in the Supabase SQL editor.
   - This creates all necessary tables (`loopin_institutions`, `loopin_users`, `loopin_requests`, `loopin_templates`, `loopin_app_state`, etc.) and Row Level Security policies.
4. Go to **Project Settings** -> **API** and copy:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **anon / public key** (`eyJhbGciOi...`)

---

## Step 2: Seed Initial Institutional Data (Optional)

You can seed your Supabase database with the default reference institutions, users, and templates right from your terminal:

```bash
# 1. In your local .env file, add your credentials:
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# 2. Run the seeding command:
npm run supabase:seed
```

> **Note**: If you skip this step, Loopin will automatically seed Supabase on first launch when deployed!

---

## Step 3: Deploy to Vercel

### Method A: Deploy via Vercel Web Dashboard (Recommended)

1. Push your repository to GitHub: `https://github.com/sudarsandiwaghar/Loopin.git` (already configured).
2. Go to [https://vercel.com/new](https://vercel.com/new).
3. Import the `Loopin` repository.
4. Under **Environment Variables**, add:
   | Variable | Value | Description |
   |---|---|---|
   | `SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase Project URL |
   | `SUPABASE_ANON_KEY` | `eyJhbGciOi...` | Your Supabase anon public API key |
   | `GEMINI_API_KEY` | *(Optional)* | For AI risk scoring and template generation |
   | `NODE_ENV` | `production` | Production environment |
5. Click **Deploy**. Vercel will build the frontend (`npm run build`) and deploy the serverless backend (`api/index.ts`).

### Method B: Deploy via Vercel CLI

```bash
# 1. Install Vercel CLI if not already installed
npm i -g vercel

# 2. Deploy
vercel

# 3. Add Environment Variables
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY

# 4. Deploy to production
vercel --prod
```

---

## Step 4: Verification & Default Credentials

Once deployed, visit your Vercel URL (e.g., `https://loopin-xxx.vercel.app`):

1. **Verify Backend & Supabase Status**:
   - Check `https://<your-vercel-domain>/api/health`
   - Check `https://<your-vercel-domain>/api/supabase/status`
2. **Log In with Pre-configured Accounts**:

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Super Admin** | `superadmin@sairam.group` | `admin123` | Organization-wide (All Colleges, Governance, Templates) |
| **Engineering Campus Admin** | `admin@sairam.edu.in` | `admin123` | Sri Sairam Engineering College |
| **Technology Campus Admin** | `admin@saitechnology.edu.in` | `admin123` | Sri Sairam Institute of Technology |
| **Medical Campus Admin** | `admin@sairamsiddha.edu.in` | `admin123` | Sri Sairam Siddha Medical College |
| **Faculty Staff / Applicant** | `senthil.nathan@sairam.edu.in` | `staff123` | Sri Sairam Engineering College (CSE Dept) |

---

## Local Development

To run locally with Supabase:
```bash
# Install dependencies
npm install

# Build static assets
npm run build

# Start local server with hot module reload
npm run dev
```

Server runs on [http://localhost:3000](http://localhost:3000).
