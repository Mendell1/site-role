alter table public.inscricoes_eventos
  add column if not exists ingresso_codigo uuid,
  add column if not exists checkin_em timestamptz,
  add column if not exists checkin_por uuid references public.perfis(id) on delete set null;

update public.inscricoes_eventos set ingresso_codigo=gen_random_uuid() where ingresso_codigo is null;
alter table public.inscricoes_eventos alter column ingresso_codigo set default gen_random_uuid(), alter column ingresso_codigo set not null;
create unique index if not exists inscricoes_ingresso_codigo_uq on public.inscricoes_eventos(ingresso_codigo);
create index if not exists inscricoes_evento_checkin_idx on public.inscricoes_eventos(evento_id,checkin_em) where status='inscrito';

create or replace function private.meu_ingresso_v25_3_impl(p_evento uuid) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_result jsonb;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  select jsonb_build_object('evento_id',e.id,'evento_nome',e.nome,'data_evento',e.data_evento,'hora_evento',e.hora_evento,'cidade',e.cidade,'bairro',e.bairro,'participante_nome',p.nome,'ingresso_codigo',i.ingresso_codigo,'qr_payload','ROLE:'||i.ingresso_codigo::text,'confirmado_em',i.confirmado_em,'checkin_em',i.checkin_em) into v_result
  from public.inscricoes_eventos i join public.eventos e on e.id=i.evento_id join public.perfis p on p.id=i.usuario_id
  where i.evento_id=p_evento and i.usuario_id=v_usuario and i.status='inscrito';
  return v_result;
end;$$;
revoke all on function private.meu_ingresso_v25_3_impl(uuid) from public,anon;
grant execute on function private.meu_ingresso_v25_3_impl(uuid) to authenticated;
create or replace function public.meu_ingresso_v25_3(p_evento uuid) returns jsonb language sql security invoker stable set search_path='' as $$ select private.meu_ingresso_v25_3_impl(p_evento); $$;
revoke all on function public.meu_ingresso_v25_3(uuid) from public,anon;
grant execute on function public.meu_ingresso_v25_3(uuid) to authenticated;

create or replace function private.checkin_ingresso_v25_3_impl(p_codigo uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_operador uuid:=auth.uid(); v_inscricao public.inscricoes_eventos%rowtype; v_evento public.eventos%rowtype; v_nome text; v_ja boolean:=false;
begin
  if v_operador is null then raise exception 'É preciso entrar na conta'; end if;
  select * into v_inscricao from public.inscricoes_eventos where ingresso_codigo=p_codigo for update;
  if not found then raise exception 'Ingresso não encontrado'; end if;
  select * into v_evento from public.eventos where id=v_inscricao.evento_id;
  if not found then raise exception 'Evento não encontrado'; end if;
  if not (v_evento.criador_id=v_operador or private.eh_admin()) then raise exception 'Somente o organizador pode realizar o check-in'; end if;
  if v_inscricao.status<>'inscrito' then raise exception 'Este ingresso não possui inscrição confirmada'; end if;
  if v_evento.situacao='cancelado' then raise exception 'O evento está cancelado'; end if;
  select nome into v_nome from public.perfis where id=v_inscricao.usuario_id;
  v_ja:=v_inscricao.checkin_em is not null;
  if not v_ja then
    update public.inscricoes_eventos set checkin_em=now(),checkin_por=v_operador where id=v_inscricao.id;
    select * into v_inscricao from public.inscricoes_eventos where id=v_inscricao.id;
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id) values(v_inscricao.usuario_id,'Check-in realizado','Sua presença em '||coalesce(v_evento.nome,'um evento')||' foi confirmada.',v_evento.id);
  end if;
  return jsonb_build_object('ok',true,'ja_realizado',v_ja,'evento_id',v_evento.id,'evento_nome',v_evento.nome,'usuario_id',v_inscricao.usuario_id,'participante_nome',coalesce(v_nome,'Participante'),'checkin_em',v_inscricao.checkin_em);
end;$$;
revoke all on function private.checkin_ingresso_v25_3_impl(uuid) from public,anon;
grant execute on function private.checkin_ingresso_v25_3_impl(uuid) to authenticated;
create or replace function public.checkin_ingresso_v25_3(p_codigo uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.checkin_ingresso_v25_3_impl(p_codigo); $$;
revoke all on function public.checkin_ingresso_v25_3(uuid) from public,anon;
grant execute on function public.checkin_ingresso_v25_3(uuid) to authenticated;

create or replace function private.painel_evento_v25_3_impl(p_evento uuid) returns jsonb language plpgsql security definer stable set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_evento public.eventos%rowtype; v_inscritos integer; v_espera integer; v_presentes integer; v_taxa numeric;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  select * into v_evento from public.eventos where id=p_evento;
  if not found then raise exception 'Evento não encontrado'; end if;
  if not (v_evento.criador_id=v_usuario or private.eh_admin()) then raise exception 'Sem permissão para acessar o painel deste evento'; end if;
  select count(*)::integer into v_inscritos from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
  select count(*)::integer into v_espera from public.inscricoes_eventos where evento_id=p_evento and status='espera';
  select count(*)::integer into v_presentes from public.inscricoes_eventos where evento_id=p_evento and status='inscrito' and checkin_em is not null;
  v_taxa:=case when v_inscritos=0 then 0 else round((v_presentes::numeric*100.0)/v_inscritos,1) end;
  return jsonb_build_object('evento_id',v_evento.id,'evento_nome',v_evento.nome,'data_evento',v_evento.data_evento,'hora_evento',v_evento.hora_evento,'capacidade',v_evento.max_participantes,'inscritos',v_inscritos,'espera',v_espera,'presentes',v_presentes,'ausentes',greatest(v_inscritos-v_presentes,0),'taxa_comparecimento',v_taxa);
end;$$;
revoke all on function private.painel_evento_v25_3_impl(uuid) from public,anon;
grant execute on function private.painel_evento_v25_3_impl(uuid) to authenticated;
create or replace function public.painel_evento_v25_3(p_evento uuid) returns jsonb language sql security invoker stable set search_path='' as $$ select private.painel_evento_v25_3_impl(p_evento); $$;
revoke all on function public.painel_evento_v25_3(uuid) from public,anon;
grant execute on function public.painel_evento_v25_3(uuid) to authenticated;

create or replace function private.participantes_evento_v25_3_impl(p_evento uuid) returns table(usuario_id uuid,nome text,foto_url text,status text,confirmado_em timestamptz,entrou_fila_em timestamptz,checkin_em timestamptz) language plpgsql security definer stable set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  if not exists(select 1 from public.eventos e where e.id=p_evento and (e.criador_id=auth.uid() or private.eh_admin())) then raise exception 'Sem permissão para ver participantes deste evento'; end if;
  return query select p.id,p.nome,p.foto_url,i.status,i.confirmado_em,i.entrou_fila_em,i.checkin_em from public.inscricoes_eventos i join public.perfis p on p.id=i.usuario_id where i.evento_id=p_evento and i.status in ('inscrito','espera') order by case when i.status='inscrito' then 0 else 1 end,i.checkin_em desc nulls last,i.confirmado_em asc nulls last,i.entrou_fila_em asc nulls last,i.criado_em asc;
end;$$;
revoke all on function private.participantes_evento_v25_3_impl(uuid) from public,anon;
grant execute on function private.participantes_evento_v25_3_impl(uuid) to authenticated;
create or replace function public.participantes_evento_v25_3(p_evento uuid) returns table(usuario_id uuid,nome text,foto_url text,status text,confirmado_em timestamptz,entrou_fila_em timestamptz,checkin_em timestamptz) language sql security invoker stable set search_path='' as $$ select * from private.participantes_evento_v25_3_impl(p_evento); $$;
revoke all on function public.participantes_evento_v25_3(uuid) from public,anon;
grant execute on function public.participantes_evento_v25_3(uuid) to authenticated;

create or replace function private.desfazer_checkin_v25_3_impl(p_evento uuid,p_usuario uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_operador uuid:=auth.uid(); v_nome text;
begin
  if v_operador is null then raise exception 'É preciso entrar na conta'; end if;
  if not exists(select 1 from public.eventos e where e.id=p_evento and (e.criador_id=v_operador or private.eh_admin())) then raise exception 'Sem permissão para alterar check-in deste evento'; end if;
  if not exists(select 1 from public.inscricoes_eventos i where i.evento_id=p_evento and i.usuario_id=p_usuario and i.status='inscrito' and i.checkin_em is not null) then raise exception 'Check-in não encontrado'; end if;
  update public.inscricoes_eventos set checkin_em=null,checkin_por=null where evento_id=p_evento and usuario_id=p_usuario;
  select nome into v_nome from public.perfis where id=p_usuario;
  return jsonb_build_object('ok',true,'participante_nome',coalesce(v_nome,'Participante'));
end;$$;
revoke all on function private.desfazer_checkin_v25_3_impl(uuid,uuid) from public,anon;
grant execute on function private.desfazer_checkin_v25_3_impl(uuid,uuid) to authenticated;
create or replace function public.desfazer_checkin_v25_3(p_evento uuid,p_usuario uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.desfazer_checkin_v25_3_impl(p_evento,p_usuario); $$;
revoke all on function public.desfazer_checkin_v25_3(uuid,uuid) from public,anon;
grant execute on function public.desfazer_checkin_v25_3(uuid,uuid) to authenticated;

create or replace function private.cancelar_participacao_v25_2_impl(p_evento uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_usuario uuid:=auth.uid(); v_status text; v_checkin timestamptz; v_promovidos integer:=0;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_evento::text,252));
  select status,checkin_em into v_status,v_checkin from public.inscricoes_eventos where evento_id=p_evento and usuario_id=v_usuario for update;
  if not found or v_status='cancelado' then return jsonb_build_object('status','cancelado','promovidos',0); end if;
  if v_checkin is not null then raise exception 'Não é possível cancelar depois do check-in'; end if;
  update public.inscricoes_eventos set status='cancelado',cancelado_em=now(),entrou_fila_em=null where evento_id=p_evento and usuario_id=v_usuario;
  if v_status='inscrito' then v_promovidos:=private.promover_lista_espera_v25_2(p_evento); end if;
  return jsonb_build_object('status','cancelado','promovidos',v_promovidos);
end;$$;
revoke all on function private.cancelar_participacao_v25_2_impl(uuid) from public,anon;
grant execute on function private.cancelar_participacao_v25_2_impl(uuid) to authenticated;

notify pgrst,'reload schema';
