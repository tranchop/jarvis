-- =====================================================================
-- Jarvis · 0004 · Integração Google Agenda (somente leitura)
-- O token de atualização do Google fica criptografado no Supabase Vault.
-- Só a Edge Function (papel service_role) lê/grava o token; o site só
-- consulta o status, e apenas o dono com 2FA.
-- =====================================================================

create table if not exists private.google_oauth_estado (
  estado    text primary key check (length(estado) between 32 and 128),
  criado_em timestamptz not null default now()
);

create table if not exists private.google_conta (
  singleton    boolean primary key default true check (singleton),
  segredo_id   uuid not null,
  email        text,
  conectado_em timestamptz not null default now()
);

alter table private.google_oauth_estado enable row level security;
alter table private.google_conta enable row level security;

-- O usuário da sessão é o dono? (usado pela Edge Function)
create or replace function public.jarvis_eh_dono(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.app_owner where user_id = p_uid);
$$;

-- Estado anti-CSRF do fluxo OAuth (vale 10 minutos, uso único)
create or replace function public.google_salvar_estado(p_estado text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from private.google_oauth_estado where criado_em < now() - interval '10 minutes';
  insert into private.google_oauth_estado (estado) values (p_estado);
end;
$$;

create or replace function public.google_consumir_estado(p_estado text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v timestamptz;
begin
  delete from private.google_oauth_estado where estado = p_estado returning criado_em into v;
  return v is not null and v > now() - interval '10 minutes';
end;
$$;

create or replace function public.google_salvar_token(p_refresh text, p_email text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select segredo_id into v_id from private.google_conta;
  if v_id is null then
    v_id := vault.create_secret(p_refresh, 'jarvis_google_refresh_' || gen_random_uuid(), 'Token de atualização da Google Agenda (Jarvis)');
    insert into private.google_conta (segredo_id, email) values (v_id, p_email);
  else
    perform vault.update_secret(v_id, p_refresh);
    update private.google_conta set email = p_email, conectado_em = now();
  end if;
end;
$$;

create or replace function public.google_ler_token()
returns text language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from vault.decrypted_secrets s
  where s.id = (select segredo_id from private.google_conta);
$$;

create or replace function public.google_remover()
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select segredo_id into v_id from private.google_conta;
  if v_id is not null then
    delete from vault.secrets where id = v_id;
    delete from private.google_conta;
  end if;
end;
$$;

-- Status para o site: só o dono com 2FA; nunca devolve o token
create or replace function public.google_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner() then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  return coalesce(
    (select jsonb_build_object('conectado', true, 'email', email, 'conectado_em', conectado_em) from private.google_conta),
    jsonb_build_object('conectado', false)
  );
end;
$$;

-- Permissões: funções de token só para o servidor (service_role)
revoke all on function public.jarvis_eh_dono(uuid) from public, anon, authenticated;
revoke all on function public.google_salvar_estado(text) from public, anon, authenticated;
revoke all on function public.google_consumir_estado(text) from public, anon, authenticated;
revoke all on function public.google_salvar_token(text, text) from public, anon, authenticated;
revoke all on function public.google_ler_token() from public, anon, authenticated;
revoke all on function public.google_remover() from public, anon, authenticated;
revoke all on function public.google_status() from public, anon;

grant execute on function public.jarvis_eh_dono(uuid) to service_role;
grant execute on function public.google_salvar_estado(text) to service_role;
grant execute on function public.google_consumir_estado(text) to service_role;
grant execute on function public.google_salvar_token(text, text) to service_role;
grant execute on function public.google_ler_token() to service_role;
grant execute on function public.google_remover() to service_role;
grant execute on function public.google_status() to authenticated;
