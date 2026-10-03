-- CI ONLY. Disposable PostgreSQL bootstrap for validating privacy-first shadow DDL.
-- This file is never intended for production execution.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$$;

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key
);
