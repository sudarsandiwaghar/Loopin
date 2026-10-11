# Loopin — Multi-Tier Institutional Workflow & Governance Engine

**Loopin** is an enterprise-grade multi-institution workflow, approval routing, and governance platform tailored for collegiate institutions and multi-campus educational trusts.

Deployed easily on **Vercel** with a **Supabase Cloud PostgreSQL** backend.

---

## Highlights

- **Multi-Tenant / Multi-Campus Scoping**: Strict isolation across campuses with group-wide oversight for Central Leadership (Trustees / CEO / Super Admin).
- **Dynamic Multi-Tier Approval Workflows**: Configurable routing chains (HOD -> Dean -> Principal -> Finance Officer -> CEO) with role delegation and SLA tracking.
- **Visual Organogram / Hierarchy Management**: Interactive organogram visualization with change request audit trail.
- **Template Governance**: Standardized approval templates published organization-wide with campus-level nominations.
- **Cloud Database Ready**: Built-in support for **Supabase PostgreSQL** cloud persistence and automated state sync.
- **Serverless & Vercel Native**: Zero-config deployment on Vercel with dedicated serverless function routing (`/api/*`).
- **Resilient Fallback**: Gracefully operates with offline local JSON storage when Supabase keys are not present.

---

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Motion
- **Backend API**: Node.js, Express, TypeScript (TSX)
- **Database**: Supabase Cloud PostgreSQL / `@supabase/supabase-js` (with local JSON fallback)
- **Hosting**: Vercel (Frontend on Edge CDN + Serverless Node.js backend)

---

## Quick Start (Local)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Add your Supabase credentials (optional for local testing, required for cloud persistence):
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Build & Run
```bash
# Verify build
npm run build

# Start dev server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

---

## Supabase Setup & Seeding

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. Run the SQL schema from [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL editor.
3. Seed the reference data from your command line:
   ```bash
   npm run supabase:seed
   ```

---

## Vercel Deployment

For full deployment instructions, see [VERCEL_AND_SUPABASE_DEPLOYMENT.md](VERCEL_AND_SUPABASE_DEPLOYMENT.md).

1. Push this repository to GitHub: `https://github.com/sudarsandiwaghar/Loopin.git`
2. In [Vercel](https://vercel.com/), click **Add New** -> **Project** -> Import `Loopin`.
3. Add Environment Variables:
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_ANON_KEY`: Your Supabase public API key
   - `NODE_ENV`: `production`
4. Click **Deploy**!

---

## Pre-Configured Demo Accounts

| Role | Email | Password | Scope |
|---|---|---|---|
| **Super Admin** | `superadmin@sairam.group` | `admin123` | Central Executive Council (Group-wide) |
| **Engineering Campus Admin** | `admin@sairam.edu.in` | `admin123` | Sri Sairam Engineering College |
| **Technology Campus Admin** | `admin@saitechnology.edu.in` | `admin123` | Sri Sairam Institute of Technology |
| **Medical Campus Admin** | `admin@sairamsiddha.edu.in` | `admin123` | Sri Sairam Siddha Medical College |
| **Faculty Staff (Applicant / Approver)** | `senthil.nathan@sairam.edu.in` | `staff123` | Department of CSE |

---

## Repository Scripts

- `npm run dev`: Start local server with Vite development middleware
- `npm run build`: Compile frontend for production (`dist/`)
- `npm run lint`: Run TypeScript type-checking (`tsc --noEmit`)
- `npm run seed`: Reset and reseed local reference storage
- `npm run supabase:seed`: Seed Supabase Cloud PostgreSQL database with reference data
