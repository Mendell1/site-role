-- ROLÊ V25.9 — o card de participação só trata o criador como organizador
-- quando a conta ainda possui o papel organizador/admin.

create or replace function private.status_participacao_v25_2_impl(p_evento uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_usuario uuid:=auth.uid();
  v_capacidade integer;
  v_criador uuid;
  v_inscritos integer;
  v_espera integer;
  v_status text;
  v_posicao integer;
begin
  select max_participantes,criador_id into v_capacidade,v_criador
  from public.eventos where id=p_evento and ativo=true;
  if not found then return null; end if;

  select count(*)::integer into v_inscritos
  from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
  select count(*)::integer into v_espera
  from public.inscricoes_eventos where evento_id=p_evento and status='espera';

  if v_usuario is not null then
    select status into v_status
    from public.inscricoes_eventos
    where evento_id=p_evento and usuario_id=v_usuario;

    if v_status='espera' then
      select count(*)::integer into v_posicao
      from public.inscricoes_eventos i
      where i.evento_id=p_evento and i.status='espera'
        and (coalesce(i.entrou_fila_em,i.criado_em),i.criado_em,i.id) <= (
          select coalesce(m.entrou_fila_em,m.criado_em),m.criado_em,m.id
          from public.inscricoes_eventos m
          where m.evento_id=p_evento and m.usuario_id=v_usuario
        );
    end if;
  end if;

  return jsonb_build_object(
    'capacidade',v_capacidade,
    'inscritos',v_inscritos,
    'espera',v_espera,
    'vagas_disponiveis',case when v_capacidade is null then null else greatest(v_capacidade-v_inscritos,0) end,
    'meu_status',coalesce(v_status,'nenhum'),
    'posicao_espera',v_posicao,
    'sou_organizador',v_usuario is not null and v_criador=v_usuario and private.pode_organizar()
  );
end;
$$;

notify pgrst,'reload schema';