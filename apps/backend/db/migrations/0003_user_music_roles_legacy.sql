-- If an older migration added a single music_role (text) column, merge it into music_roles and drop it.
alter table public.users
  add column if not exists music_roles text[] not null default '{}';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'music_role'
  ) then
    update public.users
    set music_roles = case
      when music_role is not null then array[music_role]::text[]
      else '{}'::text[]
    end;
    alter table public.users drop constraint if exists users_music_role_check;
    alter table public.users drop column music_role;
  end if;
end $$;

alter table public.users
  drop constraint if exists users_music_roles_check;

alter table public.users
  add constraint users_music_roles_check
  check (
    music_roles <@ array[
      'artist',
      'songwriter',
      'producer',
      'audio_engineer',
      'manager'
    ]::text[]
  );
