-- Pau & Tecla — RLS and helper predicates

create or replace function public.is_authorized_for_couple(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.authorized_devices d
    where d.couple_id = p_couple_id
      and d.user_id = auth.uid()
      and d.revoked_at is null
  );
$$;

create or replace function public.is_member_of_game(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.game_members gm
    join public.games g on g.id = gm.game_id
    where gm.game_id = p_game_id
      and gm.user_id = auth.uid()
      and public.is_authorized_for_couple(g.couple_id)
  );
$$;

create or replace function public.is_admin_for_couple(p_couple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_admins ca
    where ca.couple_id = p_couple_id
      and ca.user_id = auth.uid()
  );
$$;

alter table public.couples enable row level security;
alter table public.authorized_devices enable row level security;
alter table public.couple_admins enable row level security;
alter table public.questions enable row level security;
alter table public.games enable row level security;
alter table public.game_members enable row level security;
alter table public.game_cells enable row level security;
alter table public.game_question_usage enable row level security;
alter table public.game_events enable row level security;
alter table public.match_results enable row level security;

-- Read access only. Mutations are performed through reviewed SECURITY DEFINER RPCs or Edge Functions.

drop policy if exists couples_select_authorized on public.couples;
create policy couples_select_authorized on public.couples
for select to authenticated
using (public.is_authorized_for_couple(id));

drop policy if exists devices_select_self on public.authorized_devices;
create policy devices_select_self on public.authorized_devices
for select to authenticated
using (user_id = auth.uid());

drop policy if exists admins_select_self on public.couple_admins;
create policy admins_select_self on public.couple_admins
for select to authenticated
using (user_id = auth.uid());

-- No regular SELECT policy on questions: clients must use get_game_view.
-- Admin access may be added through a dedicated RPC or a narrowly scoped policy.

drop policy if exists games_select_members on public.games;
create policy games_select_members on public.games
for select to authenticated
using (public.is_member_of_game(id));

drop policy if exists game_members_select_same_game on public.game_members;
create policy game_members_select_same_game on public.game_members
for select to authenticated
using (public.is_member_of_game(game_id));

drop policy if exists game_cells_select_members on public.game_cells;
create policy game_cells_select_members on public.game_cells
for select to authenticated
using (public.is_member_of_game(game_id));

drop policy if exists usage_select_members on public.game_question_usage;
create policy usage_select_members on public.game_question_usage
for select to authenticated
using (public.is_member_of_game(game_id));

drop policy if exists events_select_members on public.game_events;
create policy events_select_members on public.game_events
for select to authenticated
using (public.is_member_of_game(game_id));

drop policy if exists results_select_authorized on public.match_results;
create policy results_select_authorized on public.match_results
for select to authenticated
using (public.is_authorized_for_couple(couple_id));

revoke all on public.questions from anon, authenticated;
revoke insert, update, delete on public.games from anon, authenticated;
revoke insert, update, delete on public.game_members from anon, authenticated;
revoke insert, update, delete on public.game_cells from anon, authenticated;
revoke insert, update, delete on public.game_question_usage from anon, authenticated;
revoke insert, update, delete on public.game_events from anon, authenticated;
revoke insert, update, delete on public.match_results from anon, authenticated;
revoke insert, update, delete on public.authorized_devices from anon, authenticated;
revoke insert, update, delete on public.couples, public.couple_admins from anon, authenticated;
revoke all on function public.is_authorized_for_couple(uuid), public.is_member_of_game(uuid), public.is_admin_for_couple(uuid) from public, anon;
grant execute on function public.is_authorized_for_couple(uuid), public.is_member_of_game(uuid), public.is_admin_for_couple(uuid) to authenticated;
grant select on public.couples, public.authorized_devices, public.couple_admins, public.games,
  public.game_members, public.game_cells, public.game_question_usage, public.game_events, public.match_results to authenticated;
