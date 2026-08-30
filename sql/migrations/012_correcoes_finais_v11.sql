-- ============================================================
-- ROLÊ V11 FINAL — correções para um projeto que já está na V10
-- No projeto atual estas alterações já foram aplicadas.
-- ============================================================

-- pg_cron usa o próprio schema cron. pg_net usa o schema net.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove o contador de login customizado. A proteção fica no Supabase Auth
-- (rate limits/CAPTCHA), evitando bloqueio abusivo por e-mail.
drop function if exists public.checar_bloqueio_login(text);
drop function if exists public.registrar_falha_login(text);
drop function if exists public.limpar_falhas_login(text);
drop table if exists public.tentativas_login;

-- Segredo interno compartilhado apenas entre o banco e a Edge Function.
create table if not exists public.internal_config (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.internal_config enable row level security;
revoke all on public.internal_config from public, anon, authenticated;
grant select on public.internal_config to service_role;
drop policy if exists internal_config_service_role on public.internal_config;
create policy internal_config_service_role
on public.internal_config for select to service_role using (true);

insert into public.internal_config(chave,valor)
values('maintenance_secret',
  replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''))
on conflict(chave) do nothing;

-- O banco finaliza eventos passados e arquiva denúncias vencidas.
-- A conta Auth é apagada somente pela Edge Function, depois da Storage API.
create or replace function private.rotina_manutencao_role()
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.eventos set situacao='finalizado'
  where situacao in ('agendado','esgotado') and data_evento<current_date;
  perform private.arquivar_denuncias_vencidas_job();
end $$;

drop function if exists public.processar_exclusoes_vencidas();
drop function if exists private.processar_exclusoes_vencidas_job();

do $$ begin
  if exists(select 1 from cron.job where jobname='role_manutencao_diaria') then
    perform cron.unschedule('role_manutencao_diaria');
  end if;
end $$;
select cron.schedule('role_manutencao_diaria','15 3 * * *',
  $cron$select private.rotina_manutencao_role();$cron$);

-- Depois de publicar a Edge Function role-maintenance, rode
-- 13-CONFIGURAR-EDGE-CRON.sql preenchendo os dois valores solicitados.