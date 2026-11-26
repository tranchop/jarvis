# Jarvis — instruções para o Claude

App pessoal (PWA) de **Pedro**, único usuário. Pedro não programa: explique em linguagem simples e peça confirmação antes de criar contas, apagar dados ou mudar segurança.

## Stack
- React 19 + Vite + TypeScript, `HashRouter`, PWA via `vite-plugin-pwa`.
- Supabase (Postgres + Auth com TOTP obrigatório). Projeto: `jarvis` (sa-east-1).
- GitHub Pages em `https://tranchop.github.io/jarvis/` (deploy pelo workflow `deploy.yml`).
- Interface: tema escuro; barra lateral no PC, barra inferior no celular (≤ 860 px).

## Regras de segurança (não negociáveis)
- Toda tabela nova: `enable` + `force row level security`, `revoke all ... from anon, public`, políticas com `(select private.is_owner())`, gatilhos `touch_` e `hist_`. Veja `supabase/migrations/0002_mestrado.sql`.
- Registros principais são arquivados (`arquivado = true`), não apagados.
- Nunca colocar segredo no frontend. Chaves de API pagas (Claude API etc.) só em Edge Functions.
- Atualizar `supabase/tests/rls.test.mjs` a cada tabela nova e rodar `npm run test:db`.
- Links externos: validar domínio (ex.: `linkDriveSeguro`) e usar `rel="noopener noreferrer"`.
- Nunca renderizar HTML vindo do banco (`dangerouslySetInnerHTML` proibido).

## Áreas e fases
- [x] Fase 0 — Base: login + 2FA, layout responsivo, PWA.
- [x] Mestrado — experimentos (passo a passo de bancada, materiais, protocolos, link do Drive), protocolos versionados, tarefas com recorrência.
- [ ] Migração do Notion (protocolos e fichamentos) para o app.
- [ ] Escotismo — jovens, catálogo de progressão, conquistas, exportação em planilha.
- [ ] Alunos de inglês — horários, aulas futuras automáticas, pagamentos e bloqueio de aula.
- [ ] Pessoal — finanças, saúde, casa.
- [ ] Integrações — Google Calendar, notificações, backup semanal para o Drive.
- [ ] Claude no app (Edge Function) e entrada por voz (Atalho do iOS).

## Comandos
- `npm run dev` — rodar no PC (precisa de `.env.local`, veja `.env.example`).
- `npm run build` — build de produção.
- `npm run test:db` — testes de RLS/segurança do banco (PGlite, offline).

## Convenções do mestrado
- DMEM e DMEM/F12 são considerados o mesmo meio.
- Código de experimento: `EXP-001` (coluna `numero`).
- Resultados ficam no Google Drive; o app guarda só o link.
