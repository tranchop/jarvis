-- =====================================================================
-- Jarvis · 0001 · Base de segurança
-- App de um único dono. Regras:
--  1. Só existe UM usuário: o primeiro cadastro vira dono; qualquer outro
--     cadastro é bloqueado no próprio banco (mesmo se o cadastro público
--     estiver ligado por engano no painel).
--  2. Toda tabela tem RLS e só o dono, com login em 2 fatores (aal2), lê/grava.
--  3. Nada é perdido: toda alteração e exclusão guarda a versão anterior.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- Dono único ----------
create table if not exists private.app_owner (
  singleton boolean primary key default true check (singleton),
  user_id   uuid not null unique,
  created_at timestamptz not null default now()
);

create or replace function private.block_extra_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.app_owner) then
    raise exception 'Cadastro desativado: o Jarvis tem um único usuário.'
      using errcode = '42501';
  end if;
  insert into private.app_owner (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists jarvis_single_owner on auth.users;
create trigger jarvis_single_owner
  before insert on auth.users
  for each row execute function private.block_extra_users();

-- Verdadeiro só para o dono autenticado com 2º fator (aal2)
create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.app_owner o where o.user_id = (select auth.uid())
  )
  and coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;

revoke all on function private.is_owner() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_owner() to authenticated;
revoke all on function private.block_extra_users() from public, anon, authenticated;

-- ---------- Utilidades ----------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Histórico: guarda a linha antiga em toda alteração/exclusão
create table if not exists private.historico (
  id         bigint generated always as identity primary key,
  tabela     text not null,
  registro_id uuid,
  operacao   text not null,
  dados_antigos jsonb not null,
  feito_por  uuid,
  feito_em   timestamptz not null default now()
);

create or replace function private.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.historico (tabela, registro_id, operacao, dados_antigos, feito_por)
  values (tg_table_name, old.id, tg_op, to_jsonb(old), (select auth.uid()));
  return coalesce(new, old);
end;
$$;
revoke all on function private.registrar_historico() from public, anon, authenticated;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

-- Tabelas internas: RLS ligado sem políticas = nenhum acesso pela API
alter table private.app_owner enable row level security;
alter table private.historico enable row level security;

-- Dados nunca ficam acessíveis ao papel anônimo
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon, public;
