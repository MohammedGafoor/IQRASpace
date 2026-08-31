-- IqraSpace Quran — initial user-data schema.
--
-- Scope is deliberately narrow (ARCHITECTURE.md §5, Readme.md §25): only
-- what a signed-in user needs for cross-device sync of things that work
-- anonymously/locally by default (Phase 1-4). No table here is required
-- for reading, listening, searching, or bookmarking on a single device —
-- that all works with zero rows in this database (Readme.md §9).
--
-- Unlike the tutoring app's schema (supabase/migrations at the repo root),
-- there is no multi-tenant ownership chain here (no classes/students/
-- tutors) — every row is scoped to exactly one auth.uid(), so the simple
-- `using (auth.uid() = user_id)` policies below need none of that schema's
-- STABLE SECURITY DEFINER recursion workarounds.

-- One row per bookmarked ayah.
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  surah_number smallint not null check (surah_number between 1 and 114),
  ayah_number smallint not null check (ayah_number > 0),
  created_at timestamptz not null default now(),
  unique (user_id, surah_number, ayah_number)
);
create index idx_bookmarks_user on public.bookmarks(user_id);

-- Single "last read position" per user (Continue Reading, Readme.md §16).
-- One row per user — upserted on every position change, not a history log
-- (see reading_history below for that).
create table public.reading_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  surah_number smallint not null check (surah_number between 1 and 114),
  ayah_number smallint not null check (ayah_number > 0),
  updated_at timestamptz not null default now()
);

-- Reader preferences (Readme.md §11) — one row per user, synced across
-- devices once signed in. Locally, the same shape lives in localStorage
-- for anonymous users; signing in upgrades local values into this table
-- rather than discarding them (ARCHITECTURE.md §5, Phase 5).
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  arabic_font_scale numeric(3,2) not null default 1.00,
  translation_font_scale numeric(3,2) not null default 1.00,
  line_spacing numeric(3,2) not null default 1.00,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  reading_width text not null default 'comfortable' check (reading_width in ('narrow', 'comfortable', 'wide')),
  translation_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Lightweight reading history (Readme.md §17) — append-only log of
-- sessions, kept separate from reading_progress (current position) so
-- history can grow without ever being read on the hot "continue reading"
-- path. Deliberately minimal for Phase 1-4; not indexed for analytics
-- queries that don't exist yet (avoid speculative indexes, Readme.md §41).
create table public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  surah_number smallint not null check (surah_number between 1 and 114),
  ayah_number smallint not null check (ayah_number > 0),
  read_at timestamptz not null default now()
);
create index idx_reading_history_user on public.reading_history(user_id, read_at desc);

-- Row Level Security: deny-by-default, then one policy per table scoping
-- every operation to the row's own owner. No cross-table checks needed
-- (see header note above), so this is intentionally simpler than the
-- tutoring app's RLS.
alter table public.bookmarks enable row level security;
alter table public.reading_progress enable row level security;
alter table public.user_preferences enable row level security;
alter table public.reading_history enable row level security;

create policy bookmarks_own_rows on public.bookmarks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy reading_progress_own_row on public.reading_progress
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_preferences_own_row on public.user_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy reading_history_own_rows on public.reading_history
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
