-- ============================================================
-- ROLÊ — VERIFICAÇÃO PÓS-INSTALAÇÃO
-- Arquivo somente de leitura. Não altera dados.
-- Use depois da instalação/configuração para conferir a estrutura.
-- ============================================================

-- 1) Extensões essenciais
select extname, extversion
from pg_extension
where extname in ('pgcrypto','pg_trgm','pg_cron','pg_net')
order by extname;

-- 2) Tabelas principais
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in (
    'perfis','categorias','eventos','favoritos','interesses','comentarios',
    'denuncias','notificacoes','denuncia_historico','log_admin','internal_config'
  )
order by table_name;

-- 3) Views públicas/administrativas
select table_name as view_name
from information_schema.views
where table_schema='public'
  and table_name in ('eventos_lista','comentarios_lista','denuncias_lista')
order by table_name;

-- 4) Preferências de notificação V22
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public'
  and table_name='perfis'
  and column_name in ('notif_eventos','notif_comentarios','notif_denuncias','notif_resumo')
order by column_name;

-- 5) Triggers principais
select c.relname as tabela, t.tgname as trigger
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where not t.tgisinternal
  and n.nspname='public'
  and c.relname in ('eventos','comentarios','denuncias','perfis')
order by c.relname,t.tgname;

-- 6) Jobs do Cron
select jobname, schedule, active
from cron.job
where jobname like 'role_%'
order by jobname;

-- 7) Buckets do Storage usados pelo projeto
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('eventos','avatares','denuncias')
order by id;
