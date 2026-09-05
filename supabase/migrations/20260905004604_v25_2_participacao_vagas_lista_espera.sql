create table if not exists public.inscricoes_eventos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  status text not null default 'inscrito',
  entrou_fila_em timestamptz,
  confirmado_em timestamptz,
  cancelado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint inscricoes_evento_usuario_unico unique (evento_id, usuario_id),
  constraint inscricoes_status_valido check (status in ('inscrito','espera','cancelado'))
);

create index if not exists inscricoes_evento_status_idx on public.inscricoes_eventos(evento_id, status, entrou_fila_em, criado_em);
create index if not exists inscricoes_usuario_status_idx on public.inscricoes_eventos(usuario_id, status, criado_em desc);

alter table public.inscricoes_eventos enable row level security;
revoke all on table public.inscricoes_eventos from anon;
revoke insert, update, delete on table public.inscricoes_eventos from authenticated;
grant select on table public.inscricoes_eventos to authenticated;

drop policy if exists inscricoes_select_v25_2 on public.inscricoes_eventos;
create policy inscricoes_select_v25_2 on public.inscricoes_eventos for select to authenticated
using (
  usuario_id = (select auth.uid())
  or exists (select 1 from public.eventos e where e.id=inscricoes_eventos.evento_id and e.criador_id=(select auth.uid()))
  or (select private.eh_admin())
);

create or replace function private.touch_inscricao_v25_2() returns trigger language plpgsql set search_path='' as $$
begin new.atualizado_em:=now(); return new; end;
$$;
revoke all on function private.touch_inscricao_v25_2() from public,anon,authenticated;
drop trigger if exists trg_touch_inscricao_v25_2 on public.inscricoes_eventos;
create trigger trg_touch_inscricao_v25_2 before update on public.inscricoes_eventos for each row execute function private.touch_inscricao_v25_2();

create or replace function private.promover_lista_espera_v25_2(p_evento uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare v_capacidade integer; v_inscritos integer; v_promovido record; v_evento_nome text; v_total integer:=0;
begin
  select max_participantes,nome into v_capacidade,v_evento_nome from public.eventos where id=p_evento;
  if not found or v_capacidade is null then return 0; end if;
  loop
    select count(*)::integer into v_inscritos from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
    exit when v_inscritos>=v_capacidade;
    select i.id,i.usuario_id into v_promovido from public.inscricoes_eventos i
      where i.evento_id=p_evento and i.status='espera'
      order by i.entrou_fila_em asc nulls last,i.criado_em asc,i.id asc for update skip locked limit 1;
    exit when not found;
    update public.inscricoes_eventos set status='inscrito',confirmado_em=now(),entrou_fila_em=null,cancelado_em=null where id=v_promovido.id;
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
      values(v_promovido.usuario_id,'Você conseguiu uma vaga','Uma vaga foi liberada em '||coalesce(v_evento_nome,'um evento')||'. Sua inscrição foi confirmada.',p_evento);
    v_total:=v_total+1;
  end loop;
  return v_total;
end;
$$;
revoke all on function private.promover_lista_espera_v25_2(uuid) from public,anon,authenticated;

create or replace function private.participar_evento_v25_2_impl(p_evento uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_evento public.eventos%rowtype; v_inscritos integer; v_status text; v_existente text; v_posicao integer;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta para se inscrever'; end if;
  if not private.conta_ativa() then raise exception 'Sua conta não está disponível para inscrições'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_evento::text,252));
  select * into v_evento from public.eventos where id=p_evento and ativo=true;
  if not found then raise exception 'Evento não encontrado'; end if;
  if v_evento.criador_id=v_usuario then raise exception 'O organizador não precisa se inscrever no próprio evento'; end if;
  if v_evento.data_evento<current_date then raise exception 'Este evento já aconteceu'; end if;
  if v_evento.situacao in ('cancelado','finalizado') then raise exception 'Este evento não aceita novas inscrições'; end if;
  select status into v_existente from public.inscricoes_eventos where evento_id=p_evento and usuario_id=v_usuario;
  if v_existente in ('inscrito','espera') then v_status:=v_existente;
  else
    select count(*)::integer into v_inscritos from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
    if v_evento.max_participantes is null or v_inscritos<v_evento.max_participantes then v_status:='inscrito'; else v_status:='espera'; end if;
    insert into public.inscricoes_eventos(evento_id,usuario_id,status,entrou_fila_em,confirmado_em,cancelado_em)
    values(p_evento,v_usuario,v_status,case when v_status='espera' then now() else null end,case when v_status='inscrito' then now() else null end,null)
    on conflict(evento_id,usuario_id) do update set status=excluded.status,entrou_fila_em=excluded.entrou_fila_em,confirmado_em=excluded.confirmado_em,cancelado_em=null;
  end if;
  if v_status='espera' then
    select count(*)::integer into v_posicao from public.inscricoes_eventos i
    where i.evento_id=p_evento and i.status='espera'
      and (coalesce(i.entrou_fila_em,i.criado_em),i.criado_em,i.id) <=
          (select coalesce(m.entrou_fila_em,m.criado_em),m.criado_em,m.id from public.inscricoes_eventos m where m.evento_id=p_evento and m.usuario_id=v_usuario);
  end if;
  select count(*)::integer into v_inscritos from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
  return jsonb_build_object('status',v_status,'capacidade',v_evento.max_participantes,'inscritos',v_inscritos,'posicao_espera',v_posicao);
end;
$$;
revoke all on function private.participar_evento_v25_2_impl(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.participar_evento_v25_2_impl(uuid) to authenticated;

create or replace function public.participar_evento_v25_2(p_evento uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.participar_evento_v25_2_impl(p_evento); $$;
revoke all on function public.participar_evento_v25_2(uuid) from public,anon;
grant execute on function public.participar_evento_v25_2(uuid) to authenticated;

create or replace function private.cancelar_participacao_v25_2_impl(p_evento uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_status text; v_promovidos integer:=0;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_evento::text,252));
  select status into v_status from public.inscricoes_eventos where evento_id=p_evento and usuario_id=v_usuario for update;
  if not found or v_status='cancelado' then return jsonb_build_object('status','cancelado','promovidos',0); end if;
  update public.inscricoes_eventos set status='cancelado',cancelado_em=now(),entrou_fila_em=null where evento_id=p_evento and usuario_id=v_usuario;
  if v_status='inscrito' then v_promovidos:=private.promover_lista_espera_v25_2(p_evento); end if;
  return jsonb_build_object('status','cancelado','promovidos',v_promovidos);
end;
$$;
revoke all on function private.cancelar_participacao_v25_2_impl(uuid) from public,anon;
grant execute on function private.cancelar_participacao_v25_2_impl(uuid) to authenticated;

create or replace function public.cancelar_participacao_v25_2(p_evento uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.cancelar_participacao_v25_2_impl(p_evento); $$;
revoke all on function public.cancelar_participacao_v25_2(uuid) from public,anon;
grant execute on function public.cancelar_participacao_v25_2(uuid) to authenticated;

create or replace function private.status_participacao_v25_2_impl(p_evento uuid) returns jsonb
language plpgsql security definer stable set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_capacidade integer; v_criador uuid; v_inscritos integer; v_espera integer; v_status text; v_posicao integer;
begin
  select max_participantes,criador_id into v_capacidade,v_criador from public.eventos where id=p_evento and ativo=true;
  if not found then return null; end if;
  select count(*)::integer into v_inscritos from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
  select count(*)::integer into v_espera from public.inscricoes_eventos where evento_id=p_evento and status='espera';
  if v_usuario is not null then
    select status into v_status from public.inscricoes_eventos where evento_id=p_evento and usuario_id=v_usuario;
    if v_status='espera' then
      select count(*)::integer into v_posicao from public.inscricoes_eventos i
      where i.evento_id=p_evento and i.status='espera'
        and (coalesce(i.entrou_fila_em,i.criado_em),i.criado_em,i.id) <=
            (select coalesce(m.entrou_fila_em,m.criado_em),m.criado_em,m.id from public.inscricoes_eventos m where m.evento_id=p_evento and m.usuario_id=v_usuario);
    end if;
  end if;
  return jsonb_build_object('capacidade',v_capacidade,'inscritos',v_inscritos,'espera',v_espera,'vagas_disponiveis',case when v_capacidade is null then null else greatest(v_capacidade-v_inscritos,0) end,'meu_status',coalesce(v_status,'nenhum'),'posicao_espera',v_posicao,'sou_organizador',v_usuario is not null and v_criador=v_usuario);
end;
$$;
revoke all on function private.status_participacao_v25_2_impl(uuid) from public,anon;
grant execute on function private.status_participacao_v25_2_impl(uuid) to authenticated;

create or replace function public.status_participacao_v25_2(p_evento uuid) returns jsonb language sql security invoker stable set search_path='' as $$ select private.status_participacao_v25_2_impl(p_evento); $$;
revoke all on function public.status_participacao_v25_2(uuid) from public,anon;
grant execute on function public.status_participacao_v25_2(uuid) to authenticated;

create or replace function private.minhas_inscricoes_v25_2_impl()
returns table(evento_id uuid,nome text,data_evento date,hora_evento time without time zone,cidade text,bairro text,imagem_url text,status text,capacidade integer,inscritos integer,posicao_espera integer)
language sql security definer stable set search_path='' as $$
select e.id,e.nome,e.data_evento,e.hora_evento,e.cidade,e.bairro,e.imagem_url,i.status,e.max_participantes,
  (select count(*)::integer from public.inscricoes_eventos x where x.evento_id=e.id and x.status='inscrito'),
  case when i.status='espera' then (select count(*)::integer from public.inscricoes_eventos q where q.evento_id=e.id and q.status='espera' and (coalesce(q.entrou_fila_em,q.criado_em),q.criado_em,q.id)<=(coalesce(i.entrou_fila_em,i.criado_em),i.criado_em,i.id)) else null end
from public.inscricoes_eventos i join public.eventos e on e.id=i.evento_id
where i.usuario_id=auth.uid() and i.status in ('inscrito','espera') and e.ativo=true
order by e.data_evento asc,e.hora_evento asc;
$$;
revoke all on function private.minhas_inscricoes_v25_2_impl() from public,anon;
grant execute on function private.minhas_inscricoes_v25_2_impl() to authenticated;

create or replace function public.minhas_inscricoes_v25_2()
returns table(evento_id uuid,nome text,data_evento date,hora_evento time without time zone,cidade text,bairro text,imagem_url text,status text,capacidade integer,inscritos integer,posicao_espera integer)
language sql security invoker stable set search_path='' as $$ select * from private.minhas_inscricoes_v25_2_impl(); $$;
revoke all on function public.minhas_inscricoes_v25_2() from public,anon;
grant execute on function public.minhas_inscricoes_v25_2() to authenticated;

create or replace function private.participantes_evento_v25_2_impl(p_evento uuid)
returns table(usuario_id uuid,nome text,foto_url text,status text,confirmado_em timestamptz,entrou_fila_em timestamptz)
language plpgsql security definer stable set search_path='' as $$
begin
  if not exists(select 1 from public.eventos e where e.id=p_evento and (e.criador_id=auth.uid() or private.eh_admin())) then raise exception 'Sem permissão para ver participantes deste evento'; end if;
  return query select p.id,p.nome,p.foto_url,i.status,i.confirmado_em,i.entrou_fila_em from public.inscricoes_eventos i join public.perfis p on p.id=i.usuario_id where i.evento_id=p_evento and i.status in ('inscrito','espera') order by case when i.status='inscrito' then 0 else 1 end,i.confirmado_em asc nulls last,i.entrou_fila_em asc nulls last,i.criado_em asc;
end;
$$;
revoke all on function private.participantes_evento_v25_2_impl(uuid) from public,anon;
grant execute on function private.participantes_evento_v25_2_impl(uuid) to authenticated;

create or replace function public.participantes_evento_v25_2(p_evento uuid)
returns table(usuario_id uuid,nome text,foto_url text,status text,confirmado_em timestamptz,entrou_fila_em timestamptz)
language sql security invoker stable set search_path='' as $$ select * from private.participantes_evento_v25_2_impl(p_evento); $$;
revoke all on function public.participantes_evento_v25_2(uuid) from public,anon;
grant execute on function public.participantes_evento_v25_2(uuid) to authenticated;

create or replace function private.ao_alterar_capacidade_v25_2() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.max_participantes is distinct from old.max_participantes and new.max_participantes is not null and (old.max_participantes is null or new.max_participantes>old.max_participantes) then
    perform pg_advisory_xact_lock(hashtextextended(new.id::text,252));
    perform private.promover_lista_espera_v25_2(new.id);
  end if;
  return new;
end;
$$;
revoke all on function private.ao_alterar_capacidade_v25_2() from public,anon,authenticated;
drop trigger if exists trg_capacidade_v25_2 on public.eventos;
create trigger trg_capacidade_v25_2 after update of max_participantes on public.eventos for each row execute function private.ao_alterar_capacidade_v25_2();

notify pgrst,'reload schema';
