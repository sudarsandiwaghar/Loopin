-- ====================================================================
-- Loopin Multi-Tier Institutional Workflow Engine - Supabase Schema
-- ====================================================================
-- Compatible with PostgreSQL 15+ & Supabase
-- Paste into Supabase SQL Editor and execute.

-- 1. Unified App State Snapshot (Atomic persistence for serverless/Vercel)
create table if not exists loopin_app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- 2. Institutions
create table if not exists loopin_institutions (
  id text primary key,
  name text not null,
  category text not null,
  city text,
  email text,
  phone text,
  address text,
  request_count integer default 0,
  status text default 'Active',
  created_at timestamptz default now()
);

-- 3. Users (Super Admins, Campus Admins, Faculty/Staff)
create table if not exists loopin_users (
  id text primary key,
  email text unique not null,
  password_hash text not null,
  name text not null,
  role text not null check (role in ('super_admin', 'admin', 'staff')),
  institution_id text references loopin_institutions(id) on delete set null,
  institution_name text,
  designation text,
  department text,
  employee_code text,
  manager text,
  status text default 'Active' check (status in ('Active', 'Suspended')),
  delegation jsonb default '{"enabled": false}'::jsonb,
  preferences jsonb default '{"notifyAssigned": true, "notifyDaily": true, "notifyUrgent": true, "channel": "Email and in-app"}'::jsonb,
  created_at timestamptz default now()
);

-- 4. Staff Managerial Details
create table if not exists loopin_staff_details (
  id text primary key,
  institution_id text not null references loopin_institutions(id) on delete cascade,
  name text not null,
  role text not null,
  dept text not null,
  manager text not null,
  email text not null,
  updated_at timestamptz default now()
);

-- 5. Hierarchies / Organograms
create table if not exists loopin_hierarchies (
  institution_id text primary key references loopin_institutions(id) on delete cascade,
  tree jsonb not null,
  updated_at timestamptz default now()
);

-- 6. Hierarchy Audit Logs
create table if not exists loopin_hierarchy_logs (
  id text primary key,
  institution_id text not null references loopin_institutions(id) on delete cascade,
  institution_name text,
  action text not null,
  detail text,
  status text default 'Updated' check (status in ('Updated', 'Requested', 'Approved')),
  actor_name text,
  time text
);

-- 7. Approval Step Configurations
create table if not exists loopin_approval_flows (
  institution_id text primary key,
  steps jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- 8. Workflow Templates
create table if not exists loopin_templates (
  id text primary key,
  title text not null,
  category text not null,
  code text not null,
  turnaround text,
  purpose text,
  instructions text,
  eligible_institutions jsonb default '"all"'::jsonb,
  steps jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  fields jsonb default '[]'::jsonb,
  status text default 'Published' check (status in ('Published', 'Draft')),
  version text default '1.0',
  created_by text,
  created_at timestamptz default now()
);

-- 9. Template Nominations (Campus Admin -> Super Admin)
create table if not exists loopin_template_nominations (
  id text primary key,
  title text not null,
  category text,
  uses integer default 0,
  institution text,
  institution_id text references loopin_institutions(id) on delete set null,
  submitted_by text,
  status text default 'pending' check (status in ('pending', 'approved', 'declined')),
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  details jsonb
);

-- 10. Multi-Stage Workflow Requests
create table if not exists loopin_requests (
  id text primary key,
  template_id text not null,
  template_title text not null,
  category text,
  institution_id text not null references loopin_institutions(id) on delete cascade,
  institution_name text,
  applicant_id text not null,
  applicant_name text not null,
  applicant_role text,
  applicant_dept text,
  submitted_at timestamptz default now(),
  status text default 'Pending',
  current_stage_index integer default 0,
  current_stage_name text,
  track jsonb default '[]'::jsonb,
  stages jsonb default '[]'::jsonb,
  fields jsonb default '{}'::jsonb,
  attachments jsonb default '[]'::jsonb,
  audit_trail jsonb default '[]'::jsonb,
  ai_risk_score integer,
  priority text,
  target_resolution_date text,
  draft_meta jsonb
);

-- 11. Immutable Audit Logs
create table if not exists loopin_audit_logs (
  id text primary key,
  timestamp timestamptz default now(),
  actor_id text,
  actor_name text,
  actor_role text,
  institution_id text,
  institution_name text,
  action text not null,
  target_record text,
  details text,
  ip_address text
);

-- 12. Active Sessions
create table if not exists loopin_sessions (
  token text primary key,
  user_id text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Indexes for lightning fast lookups
create index if not exists idx_users_email on loopin_users(email);
create index if not exists idx_users_institution on loopin_users(institution_id);
create index if not exists idx_requests_institution on loopin_requests(institution_id);
create index if not exists idx_requests_applicant on loopin_requests(applicant_id);
create index if not exists idx_requests_status on loopin_requests(status);
create index if not exists idx_audit_time on loopin_audit_logs(timestamp desc);

-- Enable Row Level Security (RLS)
alter table loopin_app_state enable row level security;
alter table loopin_institutions enable row level security;
alter table loopin_users enable row level security;
alter table loopin_staff_details enable row level security;
alter table loopin_hierarchies enable row level security;
alter table loopin_hierarchy_logs enable row level security;
alter table loopin_approval_flows enable row level security;
alter table loopin_templates enable row level security;
alter table loopin_template_nominations enable row level security;
alter table loopin_requests enable row level security;
alter table loopin_audit_logs enable row level security;
alter table loopin_sessions enable row level security;

-- Permissive policies for Loopin Backend Service Role & Anon Client
do $$ 
declare
  t text;
begin
  for t in select unnest(array[
    'loopin_app_state', 'loopin_institutions', 'loopin_users', 'loopin_staff_details',
    'loopin_hierarchies', 'loopin_hierarchy_logs', 'loopin_approval_flows', 'loopin_templates',
    'loopin_template_nominations', 'loopin_requests', 'loopin_audit_logs', 'loopin_sessions'
  ]) loop
    execute format('create policy if not exists "Allow all on %I" on %I for all using (true) with check (true);', t, t);
  end loop;
end $$;
