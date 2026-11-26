-- =====================================================================
-- Jarvis · 0003 · Área Pessoal: finanças, saúde, treinos
-- (Tarefas de casa usam public.tarefas com area = 'casa'.)
-- Dados sensíveis: mesmas regras (RLS + dono com 2FA + histórico).
-- =====================================================================

create table if not exists public.financas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('entrada','saida')),
  valor       numeric(12,2) not null check (valor > 0 and valor < 10000000),
  categoria   text not null check (length(categoria) between 1 and 40),
  data        date not null default current_date,
  descricao   text check (length(descricao) <= 300),
  pagamento_id uuid,
  arquivado   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.saude_consultas (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null default 'consulta' check (tipo in ('consulta','exame')),
  especialidade text not null check (length(especialidade) between 1 and 120),
  data_hora    timestamptz not null,
  local        text check (length(local) <= 200),
  retorno      date,
  status       text not null default 'agendada' check (status in ('agendada','realizada','cancelada')),
  observacoes  text check (length(observacoes) <= 5000),
  arquivado    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.saude_remedios (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(nome) between 1 and 120),
  dose        text check (length(dose) <= 120),
  horarios    text[] not null default '{}'
              check (array_length(horarios, 1) is null or array_length(horarios, 1) <= 12),
  inicio      date not null default current_date,
  fim         date,
  observacoes text check (length(observacoes) <= 2000),
  arquivado   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);

create table if not exists public.saude_tomadas (
  id         uuid primary key default gen_random_uuid(),
  remedio_id uuid not null references public.saude_remedios(id) on delete restrict,
  data       date not null default current_date,
  horario    text not null check (horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tomado_em  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (remedio_id, data, horario)
);

create table if not exists public.treinos (
  id          uuid primary key default gen_random_uuid(),
  data        date not null default current_date,
  tipo        text not null check (length(tipo) between 1 and 60),
  duracao_min integer check (duracao_min is null or duracao_min between 1 and 1440),
  observacao  text check (length(observacao) <= 2000),
  arquivado   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists financas_data_idx on public.financas (data desc) where not arquivado;
create index if not exists consultas_data_idx on public.saude_consultas (data_hora);
create index if not exists tomadas_data_idx on public.saude_tomadas (data, remedio_id);
create index if not exists treinos_data_idx on public.treinos (data desc);

-- Gatilhos: updated_at + histórico
do $$
declare t text;
begin
  foreach t in array array['financas','saude_consultas','saude_remedios','saude_tomadas','treinos']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format('create trigger touch_%1$s before update on public.%1$I
                    for each row execute function private.touch_updated_at()', t);
    execute format('drop trigger if exists hist_%1$s on public.%1$I', t);
    execute format('create trigger hist_%1$s after update or delete on public.%1$I
                    for each row execute function private.registrar_historico()', t);
  end loop;
end $$;

-- RLS: só o dono com 2FA
do $$
declare t text;
begin
  foreach t in array array['financas','saude_consultas','saude_remedios','saude_tomadas','treinos']
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

-- Exclusão só para desmarcar uma tomada de remédio (o histórico guarda)
grant delete on public.saude_tomadas to authenticated;
drop policy if exists dono_delete on public.saude_tomadas;
create policy dono_delete on public.saude_tomadas for delete to authenticated using ((select private.is_owner()));
