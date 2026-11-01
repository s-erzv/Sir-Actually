-- DESTRUCTIVE: drops all app tables/functions in public and private.
-- Auth users are preserved.
begin;

drop schema if exists private cascade;
drop schema if exists public cascade;

create schema public authorization postgres;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;

commit;
