-- Pau & Tecla — base schema
-- Review in the target Supabase project before applying.

create extension if not exists pgcrypto;

DO $$ BEGIN
  create type public.player_role as enum ('PAU', 'TECLA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.game_member_role as enum ('PAU', 'TECLA', 'IN_PERSON_CONTROLLER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.game_mode as enum ('IN_PERSON', 'ONLINE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.game_status as enum ('LOBBY', 'ACTIVE', 'FINISHED', 'ABANDONED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.game_phase as enum (
    'LOBBY', 'READY', 'TURN_INTRO', 'QUESTION', 'TP_OPEN', 'TP_CLAIMED',
    'ANSWER_REVEALED', 'JUDGING', 'RESULT', 'MOVING', 'BETWEEN_TURNS', 'FINISHED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.question_pool as enum ('PAU', 'TECLA', 'TECLA_PAU', 'PAU_TECLA', 'TP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.cell_type as enum ('PERSONAL', 'CROSSED', 'TP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.cell_modifier as enum ('NONE', 'PLUS_ONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  create type public.review_status as enum ('DRAFT', 'APPROVED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.authorized_devices (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  authorized_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (couple_id, user_id)
);

create table if not exists public.couple_admins (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.questions (
  id text primary key,
  pool public.question_pool not null,
  topic text not null,
  difficulty smallint not null check (difficulty between 1 and 3),
  question_ca text not null check (length(trim(question_ca)) >= 5),
  answer_ca text not null,
  review_status public.review_status not null default 'DRAFT',
  factual_reviewed boolean not null default false,
  language_reviewed boolean not null default false,
  active boolean not null default false,
  source_type text not null default 'general_knowledge',
  notes text not null default '',
  content_version integer not null default 1 check (content_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  archived_at timestamptz,
  constraint questions_answer_word_count check (
    cardinality(regexp_split_to_array(trim(answer_ca), E'\\s+')) between 1 and 5
  ),
  constraint approved_questions_are_reviewed check (
    review_status <> 'APPROVED'
    or (factual_reviewed = true and language_reviewed = true and active = true)
  )
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  invite_code text unique,
  mode public.game_mode not null,
  status public.game_status not null default 'LOBBY',
  target_minutes integer not null check (target_minutes between 10 and 180),
  finish_position integer not null check (finish_position between 3 and 15),
  starting_player public.player_role not null,
  current_turn public.player_role not null,
  current_phase public.game_phase not null default 'LOBBY',
  current_question_id text references public.questions(id),
  current_target_cell integer,
  responding_player public.player_role,
  tp_claimant public.player_role,
  pau_position integer not null default 0 check (pau_position >= 0),
  tecla_position integer not null default 0 check (tecla_position >= 0),
  turn_number integer not null default 0 check (turn_number >= 0),
  state_version bigint not null default 0 check (state_version >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  winner public.player_role,
  last_action_at timestamptz not null default now(),
  constraint game_finished_has_winner check (
    status <> 'FINISHED' or (winner is not null and finished_at is not null)
  )
);

create table if not exists public.game_members (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role public.game_member_role not null,
  joined_at timestamptz not null default now(),
  unique (game_id, user_id)
);

create unique index if not exists game_members_unique_pau
  on public.game_members(game_id)
  where access_role = 'PAU';
create unique index if not exists game_members_unique_tecla
  on public.game_members(game_id)
  where access_role = 'TECLA';
create unique index if not exists game_members_unique_controller
  on public.game_members(game_id)
  where access_role = 'IN_PERSON_CONTROLLER';

create table if not exists public.game_cells (
  game_id uuid not null references public.games(id) on delete cascade,
  position integer not null check (position >= 1),
  cell_type public.cell_type not null,
  modifier public.cell_modifier not null default 'NONE',
  created_at timestamptz not null default now(),
  primary key (game_id, position)
);

create table if not exists public.game_question_usage (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  question_id text not null references public.questions(id),
  turn_number integer not null check (turn_number >= 0),
  responding_player public.player_role not null,
  result boolean,
  used_at timestamptz not null default now(),
  unique (game_id, question_id)
);

create table if not exists public.game_events (
  id bigint generated by default as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  state_version bigint not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  actor_role public.game_member_role,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.match_results (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null unique references public.games(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  winner public.player_role not null,
  finished_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists authorized_devices_user_idx on public.authorized_devices(user_id) where revoked_at is null;
create index if not exists games_couple_status_idx on public.games(couple_id, status);
create index if not exists games_invite_code_idx on public.games(invite_code);
create index if not exists game_members_user_idx on public.game_members(user_id, game_id);
create index if not exists game_events_game_version_idx on public.game_events(game_id, state_version);
create index if not exists match_results_couple_idx on public.match_results(couple_id, finished_at desc);
create index if not exists questions_selection_idx on public.questions(pool, review_status, active, difficulty);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

insert into public.couples (slug, display_name)
values ('pau-tecla', 'Pau & Tecla')
on conflict (slug) do update set display_name = excluded.display_name;
