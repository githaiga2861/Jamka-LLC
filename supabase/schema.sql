-- Jamka LLC Books — Supabase schema
-- Run this in Supabase: SQL Editor -> New query -> paste -> Run.

-- 1) App settings (holds the universal PIN, hashed)
create table if not exists settings (
  id int primary key default 1,
  pin_hash text not null,
  updated_at timestamptz default now()
);

-- 2) Trips (one row per rate confirmation)
create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  broker text not null,                 -- company offering the rate con
  load_number text,                     -- load / reference number on the rate con
  ratecon_date date not null,           -- date James received the rate con
  gross_pay numeric not null default 0, -- amount before the 20% cut
  net_pay numeric not null default 0,   -- gross * 0.80
  loaded_miles numeric not null default 0,
  empty_miles numeric not null default 0,
  legs jsonb not null default '[]',     -- per-leg mileage breakdown
  first_pickup timestamptz,
  last_delivery timestamptz,
  created_at timestamptz default now()
);

-- 3) Stops (pickups and deliveries for a trip)
create table if not exists stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  kind text not null check (kind in ('pickup','delivery')),
  at timestamptz not null,              -- exact date + time
  address text not null,                -- address typed by the user
  resolved text,                        -- address the map service matched
  state text,                           -- US state code for list display
  lat double precision,
  lon double precision,
  position int not null default 0
);

-- 4) Expenses (fuel + all other categories)
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in
    ('fuel','toll','repairs','wash','weighing','penalty','insurance','escrow')),
  amount numeric not null,
  at timestamptz not null,              -- exact date + time it was paid
  location text,
  trip_id uuid references trips(id) on delete set null, -- auto-matched by date
  fuel_type text check (fuel_type in ('diesel','reefer')),
  paid_with text check (paid_with in ('own','broker_card')),
  note text,
  created_at timestamptz default now()
);

-- 5) Income entries (net pay is derived from trips; this holds discounts + refunds)
create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('fuel_discount','refund')),
  amount numeric not null,
  on_date date not null,                -- receipts show date only, no time
  load_number text,                     -- how UT LLC labels discounts
  trip_id uuid references trips(id) on delete set null,
  note text,
  created_at timestamptz default now()
);

-- 6) Documents metadata (files live in the storage bucket)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  section text not null check (section in
    ('ratecon','fuel_receipt','broker_receipt','own_fuel_receipt','expense_receipt','other')),
  name text not null,
  path text not null,                   -- storage path
  uploaded_at timestamptz default now()
);

-- 7) Storage bucket for documents
insert into storage.buckets (id, name, public)
values ('jamka-docs', 'jamka-docs', false)
on conflict (id) do nothing;

-- 8) Access: the app is a single-owner tool gated by a PIN, so the anon key
--    gets full access. Keep your project URL + anon key private.
alter table settings  enable row level security;
alter table trips     enable row level security;
alter table stops     enable row level security;
alter table expenses  enable row level security;
alter table incomes   enable row level security;
alter table documents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','trips','stops','expenses','incomes','documents'] loop
    execute format('drop policy if exists "anon all" on %I', t);
    execute format('create policy "anon all" on %I for all using (true) with check (true)', t);
  end loop;
end $$;

drop policy if exists "docs all" on storage.objects;
create policy "docs all" on storage.objects
  for all using (bucket_id = 'jamka-docs') with check (bucket_id = 'jamka-docs');

-- 9) Set the starting PIN to 1234 (SHA-256). Change it from the app later.
insert into settings (id, pin_hash)
values (1, '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
on conflict (id) do update set pin_hash = excluded.pin_hash;
