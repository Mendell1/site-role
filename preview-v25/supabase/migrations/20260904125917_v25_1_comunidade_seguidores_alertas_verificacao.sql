-- ROLÊ V25.1 — comunidade: seguir organizadores, verificação e alertas personalizados

alter table public.perfis
  add column if not exists verificado boolean not null default false,
  add column if not exists verificado_em timestamptz,
  add column if not exists verificado_por uuid references public.perfis(id) on delete set null,
  add column if not exists seguidores_total integer not null default 0;

create table if not exists public.seguidores_organizadores (
  seguidor_id uuid not null references public.perfis(id) on delete cascade,
  organizador_id uuid not null references public.perfis(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (seguidor_id, organizador_id),
  constraint seguidores_nao_seguir_si check (seguidor_id <> organizador_id)
);
create index if not exists seguidores_organizador_idx on public.seguidores_organizadores(organizador_id, criado_em desc);
alter table public.seguidores_organizadores enable row level security;
drop policy if exists seguidores_select_proprio on public.seguidores_organizadores;
drop policy if exists seguidores_insert_proprio on public.seguidores_organizadores;
drop policy if exists seguidores_delete_proprio on public.seguidores_organizadores;
create policy seguidores_select_proprio on public.seguidores_organizadores for select to authenticated using ((select auth.uid())=seguidor_id or (select auth.uid())=organizador_id);
create policy seguidores_insert_proprio on public.seguidores_organizadores for insert to authenticated with check ((select auth.uid())=seguidor_id and private.conta_ativa() and seguidor_id<>organizador_id and exists(select 1 from public.perfis p where p.id=organizador_id and p.bloqueado=false and p.exclusao_prevista is null and (p.suspenso_ate is null or p.suspenso_ate<=now())));
create policy seguidores_delete_proprio on public.seguidores_organizadores for delete to authenticated using ((select auth.uid())=seguidor_id and private.conta_ativa());

create or replace function private.atualizar_total_seguidores() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' then update public.perfis set seguidores_total=seguidores_total+1 where id=new.organizador_id; return new;
  elsif tg_op='DELETE' then update public.perfis set seguidores_total=greatest(0,seguidores_total-1) where id=old.organizador_id; return old; end if;
  return null;
end;$$;
revoke all on function private.atualizar_total_seguidores() from public,anon,authenticated;
drop trigger if exists trg_total_seguidores on public.seguidores_organizadores;
create trigger trg_total_seguidores after insert or delete on public.seguidores_organizadores for each row execute function private.atualizar_total_seguidores();
update public.perfis p set seguidores_total=(select count(*)::integer from public.seguidores_organizadores s where s.organizador_id=p.id);

create table if not exists public.alertas_eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  nome text not null,
  categoria_id text references public.categorias(id) on delete set null,
  cidade text,
  somente_gratuitos boolean not null default false,
  fim_de_semana boolean not null default false,
  raio_km integer,
  latitude double precision,
  longitude double precision,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint alerta_nome_tamanho check (char_length(btrim(nome)) between 2 and 60),
  constraint alerta_raio_valido check (raio_km is null or raio_km in (5,10,25,50)),
  constraint alerta_coords_pares check ((latitude is null)=(longitude is null)),
  constraint alerta_raio_com_coords check (raio_km is null or (latitude is not null and longitude is not null)),
  constraint alerta_lat_valida check (latitude is null or latitude between -90 and 90),
  constraint alerta_lon_valida check (longitude is null or longitude between -180 and 180)
);
create index if not exists alertas_eventos_usuario_idx on public.alertas_eventos(usuario_id,ativo,criado_em desc);
create index if not exists alertas_eventos_categoria_idx on public.alertas_eventos(categoria_id) where ativo=true;
alter table public.alertas_eventos enable row level security;
drop policy if exists alertas_select_proprio on public.alertas_eventos;
drop policy if exists alertas_insert_proprio on public.alertas_eventos;
drop policy if exists alertas_update_proprio on public.alertas_eventos;
drop policy if exists alertas_delete_proprio on public.alertas_eventos;
create policy alertas_select_proprio on public.alertas_eventos for select to authenticated using ((select auth.uid())=usuario_id);
create policy alertas_insert_proprio on public.alertas_eventos for insert to authenticated with check ((select auth.uid())=usuario_id and private.conta_ativa());
create policy alertas_update_proprio on public.alertas_eventos for update to authenticated using ((select auth.uid())=usuario_id and private.conta_ativa()) with check ((select auth.uid())=usuario_id and private.conta_ativa());
create policy alertas_delete_proprio on public.alertas_eventos for delete to authenticated using ((select auth.uid())=usuario_id and private.conta_ativa());

create or replace function private.validar_limite_alertas_v25() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (select count(*) from public.alertas_eventos where usuario_id=new.usuario_id)>=10 then raise exception 'Você pode ter no máximo 10 alertas de eventos'; end if;
  return new;
end;$$;
revoke all on function private.validar_limite_alertas_v25() from public,anon,authenticated;
drop trigger if exists trg_limite_alertas_v25 on public.alertas_eventos;
create trigger trg_limite_alertas_v25 before insert on public.alertas_eventos for each row execute function private.validar_limite_alertas_v25();

create or replace function private.touch_alerta_v25() returns trigger language plpgsql set search_path='' as $$ begin new.atualizado_em:=now(); return new; end; $$;
drop trigger if exists trg_touch_alerta_v25 on public.alertas_eventos;
create trigger trg_touch_alerta_v25 before update on public.alertas_eventos for each row execute function private.touch_alerta_v25();

create or replace function private.distancia_km_v25(lat1 double precision,lon1 double precision,lat2 double precision,lon2 double precision) returns double precision language sql immutable strict set search_path='' as $$
select 6371.0*2.0*asin(sqrt(power(sin(radians((lat2-lat1)/2.0)),2)+cos(radians(lat1))*cos(radians(lat2))*power(sin(radians((lon2-lon1)/2.0)),2)));
$$;
revoke all on function private.distancia_km_v25(double precision,double precision,double precision,double precision) from public,anon,authenticated;

create or replace function public.perfil_publico_v25(p_usuario uuid)
returns table(id uuid,nome text,foto_url text,bio text,cidade text,contato text,criado_em timestamptz,total_eventos bigint,verificado boolean,seguidores_total integer)
language sql stable security definer set search_path='' as $$
select p.id,p.nome,p.foto_url,p.bio,p.cidade,p.contato,p.criado_em,(select count(*) from public.eventos e where e.criador_id=p.id and e.ativo=true and e.data_evento>=current_date)::bigint,p.verificado,p.seguidores_total
from public.perfis p where p.id=p_usuario and p.bloqueado=false and p.exclusao_prevista is null and (p.suspenso_ate is null or p.suspenso_ate<=now());
$$;
revoke all on function public.perfil_publico_v25(uuid) from public;
grant execute on function public.perfil_publico_v25(uuid) to anon,authenticated;

create or replace function public.meus_organizadores_seguidos_v25()
returns table(id uuid,nome text,foto_url text,cidade text,verificado boolean,seguidores_total integer,seguindo_desde timestamptz)
language sql stable security definer set search_path='' as $$
select p.id,p.nome,p.foto_url,p.cidade,p.verificado,p.seguidores_total,s.criado_em from public.seguidores_organizadores s join public.perfis p on p.id=s.organizador_id where s.seguidor_id=auth.uid() and p.bloqueado=false and p.exclusao_prevista is null and (p.suspenso_ate is null or p.suspenso_ate<=now()) order by s.criado_em desc;
$$;
revoke all on function public.meus_organizadores_seguidos_v25() from public,anon;
grant execute on function public.meus_organizadores_seguidos_v25() to authenticated;

create or replace function public.admin_definir_verificacao_v25(p_usuario uuid,p_verificado boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare admin_nome text; alvo_nome text;
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem alterar a verificação'; end if;
  select nome into admin_nome from public.perfis where id=auth.uid();
  select nome into alvo_nome from public.perfis where id=p_usuario;
  if alvo_nome is null then raise exception 'Usuário não encontrado'; end if;
  update public.perfis set verificado=p_verificado,verificado_em=case when p_verificado then now() else null end,verificado_por=case when p_verificado then auth.uid() else null end where id=p_usuario;
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe) values(auth.uid(),admin_nome,case when p_verificado then 'verificar_organizador' else 'remover_verificacao' end,'usuario',p_usuario,case when p_verificado then 'Organizador verificado: '||alvo_nome else 'Verificação removida: '||alvo_nome end);
  return true;
end;$$;
revoke all on function public.admin_definir_verificacao_v25(uuid,boolean) from public,anon;
grant execute on function public.admin_definir_verificacao_v25(uuid,boolean) to authenticated;

create or replace function private.notificar_novo_evento_v25() returns trigger language plpgsql security definer set search_path='' as $$
declare nome_org text;
begin
  if not new.ativo then return new; end if;
  select nome into nome_org from public.perfis where id=new.criador_id;
  insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
  select s.seguidor_id,'Novo evento de '||coalesce(nome_org,'um organizador que você segue'),new.nome||' · '||to_char(new.data_evento,'DD/MM/YYYY')||coalesce(' · '||nullif(new.cidade,''),''),new.id
  from public.seguidores_organizadores s join public.perfis p on p.id=s.seguidor_id where s.organizador_id=new.criador_id and p.notif_eventos=true and p.bloqueado=false and p.exclusao_prevista is null and (p.suspenso_ate is null or p.suspenso_ate<=now());
  insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
  select a.usuario_id,'Evento encontrado para “'||a.nome||'”',new.nome||' · '||to_char(new.data_evento,'DD/MM/YYYY')||coalesce(' · '||nullif(new.cidade,''),''),new.id
  from public.alertas_eventos a join public.perfis p on p.id=a.usuario_id
  where a.ativo=true and p.bloqueado=false and p.exclusao_prevista is null and (p.suspenso_ate is null or p.suspenso_ate<=now()) and (a.categoria_id is null or a.categoria_id=new.categoria_id) and (a.cidade is null or btrim(a.cidade)='' or lower(btrim(a.cidade))=lower(btrim(new.cidade))) and (not a.somente_gratuitos or new.gratuito=true) and (not a.fim_de_semana or extract(isodow from new.data_evento) in (6,7)) and (a.raio_km is null or (new.latitude is not null and new.longitude is not null and a.latitude is not null and a.longitude is not null and private.distancia_km_v25(a.latitude,a.longitude,new.latitude,new.longitude)<=a.raio_km));
  return new;
end;$$;
revoke all on function private.notificar_novo_evento_v25() from public,anon,authenticated;
drop trigger if exists trg_notificar_novo_evento_v25 on public.eventos;
create trigger trg_notificar_novo_evento_v25 after insert on public.eventos for each row execute function private.notificar_novo_evento_v25();

notify pgrst,'reload schema';
