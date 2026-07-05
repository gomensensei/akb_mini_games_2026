begin;

-- Tool48 Fan Quest payload guards.
-- The mini game sync uses upserts and child rows, so this patch caps JSON size
-- without adding a daily insert limit that could break first-time sync.

create or replace function public.tool48_enforce_fan_quest_profile_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'tool48_fan_quest_profile_user_missing';
  end if;

  if pg_column_size(new.profile_data) > 131072 then
    raise exception 'tool48_fan_quest_profile_payload_too_large';
  end if;

  return new;
end;
$$;

create or replace function public.tool48_enforce_fan_quest_progress_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'tool48_fan_quest_progress_user_missing';
  end if;

  if pg_column_size(new.progress_data) > 131072 then
    raise exception 'tool48_fan_quest_progress_payload_too_large';
  end if;

  return new;
end;
$$;

create or replace function public.tool48_enforce_fan_quest_member_dex_payload()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    raise exception 'tool48_fan_quest_member_dex_user_missing';
  end if;

  if pg_column_size(new.card_data) > 32768 then
    raise exception 'tool48_fan_quest_member_dex_payload_too_large';
  end if;

  return new;
end;
$$;

drop trigger if exists tool48_fan_quest_profile_payload_before_write on public.fan_quest_profiles;
create trigger tool48_fan_quest_profile_payload_before_write
before insert or update on public.fan_quest_profiles
for each row execute function public.tool48_enforce_fan_quest_profile_payload();

drop trigger if exists tool48_fan_quest_progress_payload_before_write on public.fan_quest_progress;
create trigger tool48_fan_quest_progress_payload_before_write
before insert or update on public.fan_quest_progress
for each row execute function public.tool48_enforce_fan_quest_progress_payload();

drop trigger if exists tool48_fan_quest_member_dex_payload_before_write on public.fan_quest_member_dex;
create trigger tool48_fan_quest_member_dex_payload_before_write
before insert or update on public.fan_quest_member_dex
for each row execute function public.tool48_enforce_fan_quest_member_dex_payload();

notify pgrst, 'reload schema';

commit;
