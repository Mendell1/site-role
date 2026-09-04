# Instalação do banco — Rolê V24

O arquivo `000_instalacao_completa.sql` é o baseline consolidado anterior ao login Google.
Para reproduzir o banco atual em um projeto Supabase novo, execute nesta ordem:

1. `sql/install/000_instalacao_completa.sql`
2. `sql/migrations/013_google_oauth_onboarding.sql`
3. `sql/migrations/015_recursos_sociais_localizacao_metricas_v23.sql`
4. `sql/migrations/016_consolidacao_v24.sql`
5. `sql/deployment/013_configurar_edge_cron.sql` somente depois de configurar os secrets exigidos pela Edge Function.

A pasta `supabase/migrations/` mantém as versões aplicadas no projeto conectado e deve ser a referência para deploy via Supabase CLI/GitHub integration.

Nunca coloque `service_role`, Client Secret do Google ou outros segredos em arquivos públicos do repositório.
