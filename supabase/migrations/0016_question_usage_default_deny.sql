-- Remove the old member-readable policy as well as the privilege: descriptive
-- fact identifiers stay server-only even if a SELECT grant is added later.
drop policy if exists usage_select_members on public.game_question_usage;
revoke all on public.game_question_usage from public,anon,authenticated;
