-- ============================================================
-- ROLÊ V25.7 — Painel do organizador + reputação objetiva
-- ============================================================

create table if not exists public.evento_metricas_v25_7 (
  evento_id uuid primary key references public.eventos(id) on delete cascade,
  visualizacoes bigint not null default 0 check (visualizacoes >= 0),
  compartilhamentos bigint not null default 0 check (compartilhamentos >= 0),
  atualizado_em timestamptz not null default now()
);

alter table public.evento_metricas_v25_7 enable row level security;
revoke all on table public.evento_metricas_v25_7 from anon, authenticated;

-- Visualização: o próprio organizador não infla a métrica ao abrir seu evento.
-- A tabela permanece inacessível diretamente; a função só incrementa um contador.
create or replace function public.registrar_visualizacao_evento_v25_7(p_evento uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_criador uuid;
begin
  if p_evento is null then return false; end if;

  select e.criador_id into v_criador
  from public.eventos e
  where e.id = p_evento and e.ativo = true;

  if not found then return false; end if;
  if auth.uid() is not null and auth.uid() = v_criador then return false; end if;

  insert into public.evento_metricas_v25_7(evento_id, visualizacoes, compartilhamentos, atualizado_em)
  values (p_evento, 1, 0, now())
  on conflict (evento_id) do update
  set visualizacoes = public.evento_metricas_v25_7.visualizacoes + 1,
      atualizado_em = now();

  return true;
end;
$$;

revoke all on function public.registrar_visualizacao_evento_v25_7(uuid) from public;
grant execute on function public.registrar_visualizacao_evento_v25_7(uuid) to anon, authenticated;

-- Compartilhamento representa intenção explícita de compartilhar/copiar/gerar QR.
create or replace function public.registrar_compartilhamento_evento_v25_7(p_evento uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_evento is null then return false; end if;
  if not exists(select 1 from public.eventos e where e.id=p_evento and e.ativo=true) then
    return false;
  end if;

  insert into public.evento_metricas_v25_7(evento_id, visualizacoes, compartilhamentos, atualizado_em)
  values (p_evento, 0, 1, now())
  on conflict (evento_id) do update
  set compartilhamentos = public.evento_metricas_v25_7.compartilhamentos + 1,
      atualizado_em = now();

  return true;
end;
$$;

revoke all on function public.registrar_compartilhamento_evento_v25_7(uuid) from public;
grant execute on function public.registrar_compartilhamento_evento_v25_7(uuid) to anon, authenticated;

-- Painel privado. SECURITY DEFINER é necessário para agregar favoritos,
-- interesses e inscrições de terceiros, mas o dono é sempre auth.uid().
create or replace function public.painel_organizador_v25_7()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_resultado jsonb;
begin
  if v_usuario is null then
    raise exception 'Autenticação necessária';
  end if;

  with meus as (
    select e.id, e.nome, e.data_evento, e.hora_evento, e.situacao,
           e.serie_id, e.recorrencia_ordem, e.recorrencia_total
    from public.eventos e
    where e.criador_id = v_usuario and e.ativo = true
  ),
  fav as (
    select f.evento_id, count(*)::bigint qtd
    from public.favoritos f
    join meus m on m.id=f.evento_id
    group by f.evento_id
  ),
  itr as (
    select i.evento_id, count(*)::bigint qtd
    from public.interesses i
    join meus m on m.id=i.evento_id
    group by i.evento_id
  ),
  ins as (
    select x.evento_id,
      count(*) filter (where x.status='inscrito')::bigint inscritos,
      count(*) filter (where x.status='espera')::bigint espera,
      count(*) filter (where x.status='inscrito' and x.checkin_em is not null)::bigint checkins
    from public.inscricoes_eventos x
    join meus m on m.id=x.evento_id
    group by x.evento_id
  ),
  met as (
    select em.evento_id, em.visualizacoes, em.compartilhamentos
    from public.evento_metricas_v25_7 em
    join meus m on m.id=em.evento_id
  ),
  linhas as (
    select m.*,
      coalesce(met.visualizacoes,0)::bigint visualizacoes,
      coalesce(met.compartilhamentos,0)::bigint compartilhamentos,
      coalesce(fav.qtd,0)::bigint favoritos,
      coalesce(itr.qtd,0)::bigint interessados,
      coalesce(ins.inscritos,0)::bigint inscritos,
      coalesce(ins.espera,0)::bigint espera,
      coalesce(ins.checkins,0)::bigint checkins
    from meus m
    left join fav on fav.evento_id=m.id
    left join itr on itr.evento_id=m.id
    left join ins on ins.evento_id=m.id
    left join met on met.evento_id=m.id
  ),
  resumo as (
    select
      count(*)::bigint eventos,
      coalesce(sum(visualizacoes),0)::bigint visualizacoes,
      coalesce(sum(compartilhamentos),0)::bigint compartilhamentos,
      coalesce(sum(favoritos),0)::bigint favoritos,
      coalesce(sum(interessados),0)::bigint interessados,
      coalesce(sum(inscritos),0)::bigint inscritos,
      coalesce(sum(espera),0)::bigint espera,
      coalesce(sum(checkins),0)::bigint checkins,
      count(*) filter (where data_evento < current_date and situacao <> 'cancelado')::bigint realizados,
      count(*) filter (where situacao='cancelado')::bigint cancelados
    from linhas
  )
  select jsonb_build_object(
    'totais', jsonb_build_object(
      'eventos', r.eventos,
      'visualizacoes', r.visualizacoes,
      'compartilhamentos', r.compartilhamentos,
      'favoritos', r.favoritos,
      'interessados', r.interessados,
      'inscritos', r.inscritos,
      'espera', r.espera,
      'checkins', r.checkins,
      'taxa_comparecimento', case when r.inscritos > 0 then round((r.checkins::numeric * 100.0 / r.inscritos),1) else null end
    ),
    'reputacao', jsonb_build_object(
      'eventos_realizados', r.realizados,
      'eventos_cancelados', r.cancelados,
      'taxa_realizacao', case when (r.realizados+r.cancelados)>0 then round((r.realizados::numeric*100.0/(r.realizados+r.cancelados)),1) else null end,
      'nivel', case
        when r.realizados >= 5 and (r.realizados+r.cancelados)>0 and (r.realizados::numeric/(r.realizados+r.cancelados)) >= 0.90 then 'Histórico consistente'
        when r.realizados >= 3 then 'Organizador frequente'
        when r.realizados >= 1 then 'Em crescimento'
        else 'Novo organizador'
      end
    ),
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l.id,
        'nome', l.nome,
        'data_evento', l.data_evento,
        'hora_evento', l.hora_evento,
        'situacao', l.situacao,
        'serie_id', l.serie_id,
        'recorrencia_ordem', l.recorrencia_ordem,
        'recorrencia_total', l.recorrencia_total,
        'visualizacoes', l.visualizacoes,
        'compartilhamentos', l.compartilhamentos,
        'favoritos', l.favoritos,
        'interessados', l.interessados,
        'inscritos', l.inscritos,
        'espera', l.espera,
        'checkins', l.checkins,
        'taxa_comparecimento', case when l.inscritos > 0 then round((l.checkins::numeric*100.0/l.inscritos),1) else null end
      ) order by l.data_evento desc, l.hora_evento desc)
      from linhas l
    ), '[]'::jsonb)
  ) into v_resultado
  from resumo r;

  return coalesce(v_resultado, jsonb_build_object('totais','{}'::jsonb,'reputacao','{}'::jsonb,'eventos','[]'::jsonb));
end;
$$;

revoke all on function public.painel_organizador_v25_7() from public, anon;
grant execute on function public.painel_organizador_v25_7() to authenticated;

-- Reputação pública usa apenas eventos ativos/publicáveis e não acessa dados
-- pessoais nem inscrições. Ela mede consistência operacional, não avaliação subjetiva.
create or replace function public.reputacao_organizador_v25_7(p_usuario uuid)
returns table(
  eventos_publicados bigint,
  eventos_realizados bigint,
  eventos_cancelados bigint,
  taxa_realizacao numeric,
  nivel text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with r as (
    select
      count(*)::bigint publicados,
      count(*) filter (where e.data_evento < current_date and e.situacao <> 'cancelado')::bigint realizados,
      count(*) filter (where e.situacao='cancelado')::bigint cancelados
    from public.eventos e
    where e.criador_id=p_usuario and e.ativo=true
  )
  select
    r.publicados,
    r.realizados,
    r.cancelados,
    case when (r.realizados+r.cancelados)>0 then round((r.realizados::numeric*100.0/(r.realizados+r.cancelados)),1) else null end,
    case
      when r.realizados >= 5 and (r.realizados+r.cancelados)>0 and (r.realizados::numeric/(r.realizados+r.cancelados)) >= 0.90 then 'Histórico consistente'
      when r.realizados >= 3 then 'Organizador frequente'
      when r.realizados >= 1 then 'Em crescimento'
      else 'Novo organizador'
    end
  from r;
$$;

revoke all on function public.reputacao_organizador_v25_7(uuid) from public;
grant execute on function public.reputacao_organizador_v25_7(uuid) to anon, authenticated;
