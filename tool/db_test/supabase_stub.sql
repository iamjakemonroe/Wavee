-- Minimal stand-in for what a Supabase project provides before any app migration runs.
-- Run as a superuser in the throwaway test database (the harness creates the roles first).
--
-- Mirrors the parts the Wavee migrations touch:
--   * auth.users owned by supabase_auth_admin; the `postgres` role (which runs migrations, and is
--     not a superuser on Supabase) gets privileges on it but does not own it.
--   * auth.uid() / auth.role() / auth.jwt() reading the request.jwt.* settings PostgREST sets.
--   * extensions schema with pgcrypto preinstalled (0001's `create extension pgcrypto` is a no-op).
--   * storage.buckets / storage.objects so 0002/0005/0008/0012 apply.
--   * Supabase's default privileges: everything new in public is granted to anon, authenticated
--     and service_role.

create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists extensions;
create schema if not exists storage;

grant usage on schema auth to postgres, anon, authenticated, service_role;
grant usage, create on schema extensions to postgres;
grant usage on schema extensions to anon, authenticated, service_role;
grant usage on schema storage to postgres, anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create extension if not exists pgcrypto with schema extensions;

do $$
begin
  execute format('alter database %I set search_path = "$user", public, extensions', current_database());
end $$;

set role supabase_auth_admin;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255) default 'authenticated',
  role varchar(255) default 'authenticated',
  email varchar(255),
  phone text,
  encrypted_password varchar(255),
  email_confirmed_at timestamptz,
  raw_app_meta_data jsonb default '{}'::jsonb,
  raw_user_meta_data jsonb default '{}'::jsonb,
  is_anonymous boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  ), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

reset role;

grant select, insert, update, delete, references, trigger on auth.users to postgres;
grant all on auth.users to service_role;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table storage.objects enable row level security;
alter table storage.buckets owner to postgres;
alter table storage.objects owner to postgres;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
