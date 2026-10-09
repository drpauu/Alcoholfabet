-- Tecla&Pau — private Broadcast and Presence authorization.
-- In Supabase Dashboard, disable Realtime "Allow public access".
-- Do not attempt to ALTER TABLE realtime.messages; Supabase owns it.

create or replace function public.game_id_from_realtime_topic(p_topic text)
returns uuid
language plpgsql
immutable
set search_path = public
as $$
declare
  v_value text;
begin
  if p_topic is null or p_topic !~ '^game:[0-9a-fA-F-]{36}$' then return null; end if;
  v_value := split_part(p_topic, ':', 2);
  begin return v_value::uuid; exception when invalid_text_representation then return null; end;
end;
$$;

revoke all on function public.game_id_from_realtime_topic(text) from public, anon;
grant execute on function public.game_id_from_realtime_topic(text) to authenticated;

-- Policies may already exist in a target project. Keep names project-specific.
drop policy if exists "tecla_pau_receive_game_realtime" on realtime.messages;
create policy "tecla_pau_receive_game_realtime"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension in ('broadcast','presence')
  and exists (
    select 1
    from public.game_members gm
    where gm.game_id = public.game_id_from_realtime_topic((select realtime.topic()))
      and gm.user_id = auth.uid()
      and public.is_member_of_game(gm.game_id)
  )
);

drop policy if exists "tecla_pau_send_game_realtime" on realtime.messages;
create policy "tecla_pau_send_game_realtime"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and exists (
    select 1
    from public.game_members gm
    where gm.game_id = public.game_id_from_realtime_topic((select realtime.topic()))
      and gm.user_id = auth.uid()
      and public.is_member_of_game(gm.game_id)
  )
);
