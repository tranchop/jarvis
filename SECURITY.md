# Segurança do Jarvis

O Jarvis é de **um único usuário** (Pedro). O código é público; os dados não.

## Camadas de proteção

| Camada | O que faz |
|---|---|
| Dono único no banco | O primeiro usuário criado vira o dono. Qualquer outro cadastro é recusado pelo próprio Postgres (gatilho em `auth.users`), mesmo que o cadastro público fique ligado por engano. |
| 2 fatores obrigatório | O app só libera as telas depois do código do autenticador (TOTP). O banco exige `aal2` no token: sem o 2º fator, nenhuma linha é lida ou gravada, mesmo com a senha certa. |
| RLS em todas as tabelas | `enable` + `force row level security`. Políticas usam `private.is_owner()` (dono + aal2). O papel `anon` não tem permissão em nenhuma tabela. |
| Sem exclusão de registros principais | Experimentos, protocolos e tarefas são arquivados. Itens de lista podem ser removidos. |
| Histórico | Toda alteração/exclusão grava a versão anterior em `private.historico` (fora da API). |
| Sem segredos no site | Só a URL e a chave publicável vão para o build. O app recusa iniciar se detectar uma chave secreta. |
| CSP | O navegador só executa scripts do próprio site e só conversa com o Supabase do Jarvis. |
| Service worker | Guarda só os arquivos do app. Dados do banco nunca ficam em cache. |
| Sessão | Logout automático após 2 h sem uso. Bloqueio de abertura dentro de outro site (iframe). |
| Testes | `npm run test:db` verifica as regras acima a cada publicação. |

## Configuração obrigatória no painel do Supabase

1. Authentication → Sign In / Providers → **desligar "Allow new users to sign up"**.
2. Authentication → Multi-Factor → **TOTP ligado**.
3. Authentication → Users → **Add user** (seu e-mail, senha forte de 12+ caracteres, "Auto Confirm").
4. Authentication → Attack Protection → ligar **proteção contra senhas vazadas** e CAPTCHA, se disponível.
5. Authentication → URL Configuration → Site URL `https://tranchop.github.io/jarvis/`.

## Nunca

- Colar a `service_role` / `sb_secret_` em qualquer arquivo do repositório.
- Criar tabela sem RLS. Toda tabela nova repete o bloco de políticas da migração `0002`.
