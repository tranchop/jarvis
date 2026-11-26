-- =====================================================================
-- Jarvis · 0002 · Área Mestrado + tarefas (compartilhada entre áreas)
-- Regra: registros principais são ARQUIVADOS, não apagados.
-- =====================================================================

-- ---------- Tarefas (todas as áreas) ----------
create table if not exists public.tarefas (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(titulo) between 1 and 300),
  descricao    text check (length(descricao) <= 5000),
  area         text not null default 'mestrado'
               check (area in ('mestrado','alunos','escotismo','pessoal','casa')),
  categoria    text check (length(categoria) <= 60),     -- leitura, escrita, reunião…
  prazo        date,
  prioridade   smallint not null default 2 check (prioridade between 1 and 3), -- 1 alta
  status       text not null default 'pendente'
               check (status in ('pendente','feita','cancelada')),
  recorrencia  text check (recorrencia in ('diaria','semanal','mensal')),
  origem_id    uuid references public.tarefas(id) on delete set null,
  experimento_id uuid,
  concluida_em timestamptz,
  arquivado    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- Protocolos ----------
create table if not exists public.protocolos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(titulo) between 1 and 200),
  categoria   text check (length(categoria) <= 60),  -- cultura, viabilidade, molecular…
  conteudo    text not null default '' check (length(conteudo) <= 100000),
  versao      integer not null default 1 check (versao >= 1),
  arquivado   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Experimentos ----------
create sequence if not exists public.experimentos_numero_seq;

create table if not exists public.experimentos (
  id             uuid primary key default gen_random_uuid(),
  numero         integer not null unique default nextval('public.experimentos_numero_seq'),
  titulo         text not null check (length(titulo) between 1 and 200),
  objetivo       text check (length(objetivo) <= 5000),
  modelo_celular text check (length(modelo_celular) <= 120),
  data_planejada date,
  data_execucao  date,
  status         text not null default 'planejado'
                 check (status in ('planejado','em_andamento','concluido','cancelado')),
  link_drive     text check (link_drive is null or link_drive ~ '^https://(drive|docs)\.google\.com/'),
  observacoes    text check (length(observacoes) <= 20000),
  resultados     text check (length(resultados) <= 20000),
  arquivado      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter sequence public.experimentos_numero_seq owned by public.experimentos.numero;

alter table public.tarefas
  drop constraint if exists tarefas_experimento_fk,
  add constraint tarefas_experimento_fk
  foreign key (experimento_id) references public.experimentos(id) on delete set null;

create table if not exists public.experimento_passos (
  id             uuid primary key default gen_random_uuid(),
  experimento_id uuid not null references public.experimentos(id) on delete cascade,
  ordem          integer not null default 0,
  descricao      text not null check (length(descricao) between 1 and 2000),
  duracao_min    integer check (duracao_min is null or duracao_min between 0 and 100000),
  feito          boolean not null default false,
  feito_em       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.experimento_materiais (
  id             uuid primary key default gen_random_uuid(),
  experimento_id uuid not null references public.experimentos(id) on delete cascade,
  nome           text not null check (length(nome) between 1 and 200),
  quantidade     text check (length(quantidade) <= 100),
  observacao     text check (length(observacao) <= 1000),
  separado       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.experimento_protocolos (
  experimento_id uuid not null references public.experimentos(id) on delete cascade,
  protocolo_id   uuid not null references public.protocolos(id) on delete restrict,
  created_at     timestamptz not null default now(),
  primary key (experimento_id, protocolo_id)
);

-- Índices
create index if not exists tarefas_area_status_idx on public.tarefas (area, status, prazo);
create index if not exists tarefas_experimento_idx on public.tarefas (experimento_id);
create index if not exists tarefas_origem_idx on public.tarefas (origem_id);
create index if not exists experimentos_status_idx on public.experimentos (status, data_planejada);
create index if not exists passos_exp_idx on public.experimento_passos (experimento_id, ordem);
create index if not exists materiais_exp_idx on public.experimento_materiais (experimento_id);
create index if not exists exp_prot_prot_idx on public.experimento_protocolos (protocolo_id);

-- ---------- Gatilhos: updated_at + histórico ----------
do $$
declare t text;
begin
  foreach t in array array['tarefas','protocolos','experimentos','experimento_passos','experimento_materiais']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format('create trigger touch_%1$s before update on public.%1$I
                    for each row execute function private.touch_updated_at()', t);
    execute format('drop trigger if exists hist_%1$s on public.%1$I', t);
    execute format('create trigger hist_%1$s after update or delete on public.%1$I
                    for each row execute function private.registrar_historico()', t);
  end loop;
end $$;

-- Protocolo: sobe a versão quando o conteúdo muda (a anterior fica no histórico)
create or replace function private.bump_protocolo_versao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.conteudo is distinct from old.conteudo then
    new.versao = old.versao + 1;
  end if;
  return new;
end;
$$;
revoke all on function private.bump_protocolo_versao() from public, anon, authenticated;
drop trigger if exists versao_protocolos on public.protocolos;
create trigger versao_protocolos before update on public.protocolos
  for each row execute function private.bump_protocolo_versao();

-- ---------- RLS: só o dono com 2FA ----------
do $$
declare t text;
begin
  foreach t in array array['tarefas','protocolos','experimentos','experimento_passos',
                           'experimento_materiais','experimento_protocolos']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, public', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('drop policy if exists dono_select on public.%I', t);
    execute format('drop policy if exists dono_insert on public.%I', t);
    execute format('drop policy if exists dono_update on public.%I', t);
    execute format('create policy dono_select on public.%I for select to authenticated using ((select private.is_owner()))', t);
    execute format('create policy dono_insert on public.%I for insert to authenticated with check ((select private.is_owner()))', t);
    execute format('create policy dono_update on public.%I for update to authenticated using ((select private.is_owner())) with check ((select private.is_owner()))', t);
  end loop;
end $$;

-- Exclusão permitida só em itens de lista (passos, materiais, vínculos).
-- Experimentos, protocolos e tarefas são arquivados; mesmo assim, o histórico guarda tudo.
do $$
declare t text;
begin
  foreach t in array array['experimento_passos','experimento_materiais','experimento_protocolos']
  loop
    execute format('grant delete on public.%I to authenticated', t);
    execute format('drop policy if exists dono_delete on public.%I', t);
    execute format('create policy dono_delete on public.%I for delete to authenticated using ((select private.is_owner()))', t);
  end loop;
end $$;

revoke all on sequence public.experimentos_numero_seq from anon, public;
grant usage on sequence public.experimentos_numero_seq to authenticated;
