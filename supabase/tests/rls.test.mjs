import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'

const db = new PGlite()
const mig = (f) => readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8')

// Simula o ambiente Supabase: papéis, schema auth, auth.uid()/auth.jwt()
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt()->>'sub','')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`)
await db.exec(mig('0001_base_seguranca.sql'))
await db.exec(mig('0002_mestrado.sql'))
await db.exec(mig('0003_pessoal.sql'))

const DONO = '11111111-1111-1111-1111-111111111111'
const INTRUSO = '22222222-2222-2222-2222-222222222222'
let falhas = 0
const check = (nome, cond) => { console.log(`${cond ? 'OK  ' : 'FALHOU'} ${nome}`); if (!cond) falhas++ }
async function tenta(sql) { try { return { r: await db.query(sql) } } catch (e) { return { e: e.message } } }

async function como(papel, claims, sql) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false); set role ${papel};`)
  const r = await tenta(sql)
  await db.exec('reset role')
  return r
}

// 1. Primeiro usuário vira dono; segundo é bloqueado
check('primeiro cadastro aceito', !(await tenta(`insert into auth.users values ('${DONO}','pedro@x.com')`)).e)
const seg = await tenta(`insert into auth.users values ('${INTRUSO}','hacker@x.com')`)
check('segundo cadastro bloqueado', Boolean(seg.e) && seg.e.includes('único usuário'))

const aal2 = { sub: DONO, role: 'authenticated', aal: 'aal2' }
const aal1 = { sub: DONO, role: 'authenticated', aal: 'aal1' }
const outro = { sub: INTRUSO, role: 'authenticated', aal: 'aal2' }

// 2. Dono com 2FA lê e grava
let r = await como('authenticated', aal2, `insert into public.experimentos (titulo) values ('MTT SH-SY5Y') returning id, numero`)
check('dono aal2 cria experimento', !r.e && r.r.rows[0].numero === 1)
const expId = r.r?.rows[0].id
r = await como('authenticated', aal2, `insert into public.experimento_passos (experimento_id, descricao) values ('${expId}','Semear 1e4 cel/poço') returning id`)
check('dono aal2 cria passo', !r.e)
const passoId = r.r?.rows[0].id
r = await como('authenticated', aal2, `select count(*)::int n from public.experimentos`)
check('dono aal2 lê', r.r?.rows[0].n === 1)

// 3. Sem 2FA, outro usuário ou anônimo não veem nada
r = await como('authenticated', aal1, `select count(*)::int n from public.experimentos`)
check('dono SEM 2FA não lê', r.r?.rows[0].n === 0)
r = await como('authenticated', aal1, `insert into public.experimentos (titulo) values ('x')`)
check('dono SEM 2FA não grava', Boolean(r.e))
r = await como('authenticated', outro, `select count(*)::int n from public.experimentos`)
check('outro usuário não lê', r.r?.rows[0].n === 0)
r = await como('authenticated', outro, `update public.experimentos set titulo='hack'`)
check('outro usuário não altera', !r.e && r.r.affectedRows === 0)
r = await como('anon', {}, `select * from public.experimentos`)
check('anônimo sem permissão', Boolean(r.e))
r = await como('anon', {}, `select * from public.tarefas`)
check('anônimo sem permissão (tarefas)', Boolean(r.e))
r = await como('authenticated', aal2, `select * from private.app_owner`)
check('tabela do dono inacessível', Boolean(r.e))
r = await como('authenticated', aal2, `select * from private.historico`)
check('histórico inacessível pela API', Boolean(r.e))

// 4. Não apagar experimentos; histórico guarda versões
r = await como('authenticated', aal2, `delete from public.experimentos where id='${expId}'`)
check('dono não apaga experimento (só arquiva)', Boolean(r.e))
r = await como('authenticated', aal2, `update public.experimentos set titulo='MTT SH-SY5Y 24h' where id='${expId}'`)
check('dono edita', !r.e && r.r.affectedRows === 1)
r = await como('authenticated', aal2, `delete from public.experimento_passos where id='${passoId}'`)
check('dono remove passo', !r.e && r.r.affectedRows === 1)
r = await db.query(`select tabela, operacao from private.historico order by id`)
check('histórico registrou edição e exclusão', r.rows.length === 2 && r.rows[1].operacao === 'DELETE')

// 5. Protocolo sobe versão
r = await como('authenticated', aal2, `insert into public.protocolos (titulo, conteudo) values ('MTT','v1') returning id`)
const pid = r.r.rows[0].id
await como('authenticated', aal2, `update public.protocolos set conteudo='v2' where id='${pid}'`)
r = await como('authenticated', aal2, `select versao from public.protocolos where id='${pid}'`)
check('versão do protocolo sobe', r.r.rows[0].versao === 2)

// 6. Link do Drive validado
r = await como('authenticated', aal2, `update public.experimentos set link_drive='javascript:alert(1)' where id='${expId}'`)
check('link malicioso rejeitado', Boolean(r.e))

// 7. Usuário autenticado não executa funções internas
r = await como('authenticated', aal2, `select private.registrar_historico()`)
check('função interna bloqueada', Boolean(r.e))

// 8. Área Pessoal: dados sensíveis com as mesmas regras
for (const t of ['financas', 'saude_consultas', 'saude_remedios', 'saude_tomadas', 'treinos']) {
  r = await como('anon', {}, `select * from public.${t}`)
  check(`anônimo sem acesso a ${t}`, Boolean(r.e))
}
r = await como('authenticated', aal2, `insert into public.financas (tipo, valor, categoria) values ('saida', 25.5, 'Alimentação') returning id`)
check('dono lança gasto', !r.e)
const finId = r.r?.rows[0].id
r = await como('authenticated', aal1, `select count(*)::int n from public.financas`)
check('finanças invisíveis sem 2FA', r.r?.rows[0].n === 0)
r = await como('authenticated', outro, `select count(*)::int n from public.financas`)
check('finanças invisíveis para outro usuário', r.r?.rows[0].n === 0)
r = await como('authenticated', aal2, `delete from public.financas where id='${finId}'`)
check('lançamento não é apagado (só arquivado)', Boolean(r.e))
r = await como('authenticated', aal2, `insert into public.financas (tipo, valor, categoria) values ('saida', -5, 'x')`)
check('valor negativo rejeitado', Boolean(r.e))
r = await como('authenticated', aal2, `insert into public.saude_remedios (nome, horarios) values ('Vitamina D', '{08:00}') returning id`)
check('dono cadastra remédio', !r.e)
const remId = r.r?.rows[0].id
r = await como('authenticated', aal2, `insert into public.saude_tomadas (remedio_id, horario) values ('${remId}', '08:00') returning id`)
check('dono registra tomada', !r.e)
r = await como('authenticated', aal2, `insert into public.saude_tomadas (remedio_id, horario) values ('${remId}', '08:00')`)
check('tomada duplicada no mesmo horário rejeitada', Boolean(r.e))
r = await como('authenticated', aal2, `insert into public.saude_tomadas (remedio_id, horario) values ('${remId}', '25:99')`)
check('horário inválido rejeitado', Boolean(r.e))
r = await como('authenticated', aal2, `delete from public.saude_tomadas where remedio_id='${remId}'`)
check('dono desmarca tomada', !r.e && r.r.affectedRows === 1)
r = await como('authenticated', aal2, `delete from public.saude_remedios where id='${remId}'`)
check('remédio não é apagado (só arquivado)', Boolean(r.e))
r = await como('authenticated', aal2, `insert into public.tarefas (titulo, area, recorrencia) values ('Lavar roupa', 'casa', 'semanal')`)
check('tarefa de casa aceita', !r.e)

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os testes passaram')
process.exit(falhas ? 1 : 0)
