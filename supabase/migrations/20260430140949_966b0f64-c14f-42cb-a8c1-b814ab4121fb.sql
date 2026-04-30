-- =========================
-- PROFILES
-- =========================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  crp text,
  phone text,
  specialty text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- updated_at trigger function (reusable)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================
-- PATIENTS
-- =========================
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  birth_date date,
  notes text,
  is_active boolean not null default true,
  session_price numeric(10,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_user_id_idx on public.patients(user_id);

alter table public.patients enable row level security;

create policy "Users can view own patients"
  on public.patients for select
  using (auth.uid() = user_id);

create policy "Users can create own patients"
  on public.patients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own patients"
  on public.patients for update
  using (auth.uid() = user_id);

create policy "Users can delete own patients"
  on public.patients for delete
  using (auth.uid() = user_id);

create trigger patients_set_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

-- =========================
-- SESSIONS
-- =========================
create type public.session_status as enum ('scheduled', 'completed', 'no_show', 'rescheduled', 'cancelled');

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 50,
  status public.session_status not null default 'scheduled',
  price numeric(10,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_patient_id_idx on public.sessions(patient_id);
create index sessions_scheduled_at_idx on public.sessions(scheduled_at);

alter table public.sessions enable row level security;

create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can create own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

create trigger sessions_set_updated_at
before update on public.sessions
for each row execute function public.set_updated_at();

-- =========================
-- AVATARS STORAGE
-- =========================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Users can view own avatar"
  on storage.objects for select
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can upload own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can update own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
