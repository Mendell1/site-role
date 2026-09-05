create table if not exists public.push_assinaturas_v25_4 (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint push_endpoint_tamanho_v25_4 check (char_length(endpoint) between 20 and 2048),
  constraint push_p256dh_tamanho_v25_4 check (char_length(p256dh) between 20 and 512),
  constraint push_auth_tamanho_v25_4 check (char_length(auth) between 8 and 256)
);
create index if not exists push_assinaturas_usuario_idx_v25_4 on public.push_assinaturas_v25_4(usuario_id,ativo);
alter table public.push_assinaturas_v25_4 enable row level security;
revoke all on table public.push_assinaturas_v25_4 from anon,authenticated;

create table if not exists public.push_entregas_v25_4 (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  assinatura_id uuid not null references public.push_assinaturas_v25_4(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','enviado','erro','expirado')),
  erro text,
  tentativas integer not null default 0,
  enviado_em timestamptz,
  atualizado_em timestamptz not null default now(),
  constraint push_entrega_unica_v25_4 unique(notificacao_id,assinatura_id)
);
create index if not exists push_entregas_notificacao_idx_v25_4 on public.push_entregas_v25_4(notificacao_id,status);
alter table public.push_entregas_v25_4 enable row level security;
revoke all on table public.push_entregas_v25_4 from anon,authenticated;

create table if not exists private.push_config_v25_4 (
  singleton boolean primary key default true check (singleton=true),
  public_key text,
  private_key text,
  subject text not null default 'mailto:admin@role.local',
  webhook_secret text,
  atualizado_em timestamptz not null default now()
);
revoke all on table private.push_config_v25_4 from public,anon,authenticated;
grant select,insert,update on table private.push_config_v25_4 to service_role;

create or replace function private.salvar_push_v25_4_impl(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_id uuid;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  if not private.conta_ativa() then raise exception 'Conta indisponível para notificações'; end if;
  if char_length(coalesce(p_endpoint,''))<20 or char_length(coalesce(p_endpoint,''))>2048 then raise exception 'Assinatura push inválida'; end if;
  insert into public.push_assinaturas_v25_4(usuario_id,endpoint,p256dh,auth,user_agent,ativo,atualizado_em)
  values(v_usuario,p_endpoint,p_p256dh,p_auth,left(p_user_agent,500),true,now())
  on conflict(endpoint) do update set usuario_id=excluded.usuario_id,p256dh=excluded.p256dh,auth=excluded.auth,user_agent=excluded.user_agent,ativo=true,atualizado_em=now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.salvar_push_v25_4_impl(text,text,text,text) from public,anon;
grant execute on function private.salvar_push_v25_4_impl(text,text,text,text) to authenticated;

create or replace function public.salvar_push_v25_4(p_endpoint text,p_p256dh text,p_auth text,p_user_agent text default null)
returns uuid language sql security invoker set search_path='' as $$
  select private.salvar_push_v25_4_impl(p_endpoint,p_p256dh,p_auth,p_user_agent);
$$;
revoke all on function public.salvar_push_v25_4(text,text,text,text) from public,anon;
grant execute on function public.salvar_push_v25_4(text,text,text,text) to authenticated;

create or replace function private.remover_push_v25_4_impl(p_endpoint text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_ok boolean;
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  update public.push_assinaturas_v25_4 set ativo=false,atualizado_em=now()
  where usuario_id=auth.uid() and endpoint=p_endpoint and ativo=true;
  get diagnostics v_ok = row_count;
  return coalesce(v_ok,false);
end;
$$;
revoke all on function private.remover_push_v25_4_impl(text) from public,anon;
grant execute on function private.remover_push_v25_4_impl(text) to authenticated;

create or replace function public.remover_push_v25_4(p_endpoint text) returns boolean
language sql security invoker set search_path='' as $$ select private.remover_push_v25_4_impl(p_endpoint); $$;
revoke all on function public.remover_push_v25_4(text) from public,anon;
grant execute on function public.remover_push_v25_4(text) to authenticated;

create or replace function private.status_push_v25_4_impl() returns boolean
language sql security definer stable set search_path='' as $$
  select exists(select 1 from public.push_assinaturas_v25_4 p where p.usuario_id=auth.uid() and p.ativo=true);
$$;
revoke all on function private.status_push_v25_4_impl() from public,anon;
grant execute on function private.status_push_v25_4_impl() to authenticated;

create or replace function public.status_push_v25_4() returns boolean
language sql security invoker stable set search_path='' as $$ select private.status_push_v25_4_impl(); $$;
revoke all on function public.status_push_v25_4() from public,anon;
grant execute on function public.status_push_v25_4() to authenticated;

create or replace function public.push_config_servidor_v25_4()
returns table(public_key text,private_key text,subject text,webhook_secret text)
language sql security definer stable set search_path='' as $$
  select c.public_key,c.private_key,c.subject,c.webhook_secret from private.push_config_v25_4 c where c.singleton=true;
$$;
revoke all on function public.push_config_servidor_v25_4() from public,anon,authenticated;
grant execute on function public.push_config_servidor_v25_4() to service_role;

create or replace function private.enfileirar_push_v25_4() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_secret text;
begin
  select c.webhook_secret into v_secret from private.push_config_v25_4 c where c.singleton=true;
  if v_secret is null or v_secret='' then return new; end if;
  begin
    perform net.http_post(
      url:='https://wguayxwgxjvrtyowkzyz.supabase.co/functions/v1/push-notificar-v25-4',
      headers:='{"Content-Type":"application/json"}'::jsonb,
      body:=jsonb_build_object('notificacao_id',new.id,'segredo',v_secret),
      timeout_milliseconds:=5000
    );
  exception when others then
    raise warning 'Falha ao enfileirar push V25.4: %',sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function private.enfileirar_push_v25_4() from public,anon,authenticated;
drop trigger if exists trg_notificacao_push_v25_4 on public.notificacoes;
create trigger trg_notificacao_push_v25_4 after insert on public.notificacoes for each row execute function private.enfileirar_push_v25_4();

-- As chaves VAPID e o segredo do webhook NÃO pertencem à migration.
-- Eles devem ser configurados diretamente no ambiente/estrutura privada do Supabase.
