-- ROLÊ V25.3 — valida o evento junto com o QR antes de gravar o check-in
create or replace function private.checkin_ingresso_v25_3_impl(
  p_codigo uuid,
  p_evento uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operador uuid := auth.uid();
  v_inscricao public.inscricoes_eventos%rowtype;
  v_evento public.eventos%rowtype;
  v_nome text;
  v_ja boolean := false;
begin
  if v_operador is null then
    raise exception 'É preciso entrar na conta';
  end if;

  select *
    into v_inscricao
    from public.inscricoes_eventos
   where ingresso_codigo = p_codigo
     and evento_id = p_evento
   for update;

  if not found then
    if exists (select 1 from public.inscricoes_eventos where ingresso_codigo = p_codigo) then
      raise exception 'Ingresso de outro evento';
    end if;
    raise exception 'Ingresso não encontrado';
  end if;

  select * into v_evento from public.eventos where id = p_evento;
  if not found then raise exception 'Evento não encontrado'; end if;

  if not ((v_evento.criador_id = v_operador and private.pode_organizar()) or private.eh_admin()) then
    raise exception 'Somente o organizador pode realizar o check-in';
  end if;
  if v_inscricao.status <> 'inscrito' then raise exception 'Este ingresso não possui inscrição confirmada'; end if;
  if v_evento.situacao = 'cancelado' then raise exception 'O evento está cancelado'; end if;

  select nome into v_nome from public.perfis where id = v_inscricao.usuario_id;
  v_ja := v_inscricao.checkin_em is not null;

  if not v_ja then
    update public.inscricoes_eventos
       set checkin_em = now(), checkin_por = v_operador
     where id = v_inscricao.id;
    select * into v_inscricao from public.inscricoes_eventos where id = v_inscricao.id;
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
    values(v_inscricao.usuario_id,'Check-in realizado',
           'Sua presença em ' || coalesce(v_evento.nome,'um evento') || ' foi confirmada.',
           v_evento.id);
  end if;

  return jsonb_build_object(
    'ok', true,
    'ja_realizado', v_ja,
    'evento_id', v_evento.id,
    'evento_nome', v_evento.nome,
    'usuario_id', v_inscricao.usuario_id,
    'participante_nome', coalesce(v_nome,'Participante'),
    'checkin_em', v_inscricao.checkin_em
  );
end;
$function$;

create or replace function public.checkin_ingresso_v25_3(p_codigo uuid, p_evento uuid)
returns jsonb
language sql
set search_path = ''
as $function$
  select private.checkin_ingresso_v25_3_impl(p_codigo, p_evento);
$function$;

revoke all on function public.checkin_ingresso_v25_3(uuid, uuid) from public, anon;
grant execute on function public.checkin_ingresso_v25_3(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';