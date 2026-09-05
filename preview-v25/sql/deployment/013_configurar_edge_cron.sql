-- ============================================================
-- PASSO FINAL PARA UM SUPABASE NOVO
-- 1) Publique supabase/functions/role-maintenance
-- 2) Substitua os dois valores abaixo. A publishable key pode ficar no cliente.
-- 3) Rode este arquivo uma vez.
-- ============================================================

-- TROQUE AQUI:
-- https://SEU-PROJECT-REF.supabase.co
-- SUA_PUBLISHABLE_KEY

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if 'https://SEU-PROJECT-REF.supabase.co' like '%SEU-PROJECT-REF%' then
    raise exception 'Edite a URL do projeto antes de executar';
  end if;
  if not ('SUA_PUBLISHABLE_KEY' like 'sb_publishable_%' or 'SUA_PUBLISHABLE_KEY' like 'eyJ%') then
    raise exception 'Edite a publishable key antes de executar';
  end if;
end $$;

do $$ begin
  if exists(select 1 from cron.job where jobname='role_exclusao_storage_diaria') then
    perform cron.unschedule('role_exclusao_storage_diaria');
  end if;
end $$;

select cron.schedule(
  'role_exclusao_storage_diaria',
  '5 3 * * *',
  $cron$
  select net.http_post(
    url := 'https://SEU-PROJECT-REF.supabase.co/functions/v1/role-maintenance',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','SUA_PUBLISHABLE_KEY',
      'x-role-cron-secret',(
        select valor from public.internal_config where chave='maintenance_secret'
      )
    ),
    body := jsonb_build_object('origem','pg_cron'),
    timeout_milliseconds := 10000
  );
  $cron$
);
