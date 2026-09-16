-- ============================================================
-- Role-Based Facility Reservation and Approval System
-- SAD Laboratory 4 - Section B
-- Run this entire file in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

-- Clean start (safe to re-run while developing)
drop table if exists audit_logs cascade;
drop table if exists service_requests cascade;
drop table if exists reservations cascade;
drop table if exists facilities cascade;
drop table if exists app_users cascade;

-- ------------------------------------------------------------
-- Users (custom table — simple username/password auth, NOT Supabase Auth,
-- to keep the 3-hour scope focused on roles/workflow/business rules)
-- ------------------------------------------------------------
create table app_users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text not null,            -- plain text for lab scope only; see README note
  full_name text not null,
  role text not null check (role in ('Administrator','Facility Staff','Requester')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Facilities
-- ------------------------------------------------------------
create table facilities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'Active' check (status in ('Active','Maintenance','Inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Reservations
-- ------------------------------------------------------------
create table reservations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  requester_id uuid not null references app_users(id) on delete cascade,
  purpose text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'Pending'
    check (status in ('Pending','Approved','Rejected','Scheduled','In Use','Completed','Cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint valid_time_range check (start_time < end_time)
);

-- ------------------------------------------------------------
-- Service requests (Facility Staff reporting concerns/condition issues)
-- ------------------------------------------------------------
create table service_requests (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id) on delete cascade,
  staff_id uuid not null references app_users(id) on delete cascade,
  concern text not null,
  status text not null default 'Open' check (status in ('Open','Resolved')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Audit logs
-- ------------------------------------------------------------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  table_name text not null,
  record_id uuid,
  performed_by uuid references app_users(id),
  performed_by_name text,
  details text,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Row Level Security: open policies for anon key access.
-- This app enforces roles/business rules in the JS layer (client-side),
-- which is standard for this lab's scope. For production you would
-- switch to Supabase Auth + per-role RLS policies instead.
-- ------------------------------------------------------------
alter table app_users enable row level security;
alter table facilities enable row level security;
alter table reservations enable row level security;
alter table service_requests enable row level security;
alter table audit_logs enable row level security;

create policy "allow all app_users" on app_users for all using (true) with check (true);
create policy "allow all facilities" on facilities for all using (true) with check (true);
create policy "allow all reservations" on reservations for all using (true) with check (true);
create policy "allow all service_requests" on service_requests for all using (true) with check (true);
create policy "allow all audit_logs" on audit_logs for all using (true) with check (true);

-- ------------------------------------------------------------
-- Seed data — ready to log in and test immediately
-- Default passwords are plain text for lab demo purposes only.
-- ------------------------------------------------------------
insert into app_users (username, password, full_name, role) values
  ('admin', 'admin123', 'Admin User', 'Administrator'),
  ('staff', 'staff123', 'Facility Staff User', 'Facility Staff'),
  ('juan', 'juan123', 'Juan Dela Cruz', 'Requester');

insert into facilities (name, description, status) values
  ('Main Gymnasium', 'Full-size covered court for sports events', 'Active'),
  ('Conference Room A', 'Seats 20, projector and whiteboard', 'Active'),
  ('Function Hall', 'For large gatherings and seminars', 'Active'),
  ('Old Auditorium', 'Currently under repair', 'Maintenance');
