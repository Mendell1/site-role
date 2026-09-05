-- ============================================================
-- ROLÊ V23 — proximidade real e métricas administrativas
-- ============================================================

create or replace function public.eventos_perto_de_mim(
  p_lat double precision,
  p_lng double precision,
  p_limite integer default 60,
  p_raio_km double precision default 100
)
returns table(evento_id uuid, distancia_km numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with distancias as (
    select e.id,
      6371.0 * 2.0 * asin(
        sqrt(
          power(sin(radians(e.latitude - p_lat) / 2.0), 2) +
          cos(radians(p_lat)) * cos(radians(e.latitude)) *
          power(sin(radians(e.longitude - p_lng) / 2.0), 2)
        )
      ) as km
    from public.eventos e
    where e.ativo = true
      and e.data_evento >= current_date
      and e.latitude is not null
      and e.longitude is not null
  )
  select d.id,
         round(d.km::numeric, 2)
  from distancias d
  where d.km <= greatest(1.0, least(coalesce(p_raio_km, 100), 500.0))
  order by d.km asc, d.id
  limit greatest(1, least(coalesce(p_limite, 60), 200));
$$;

revoke all on function public.eventos_perto_de_mim(double precision,double precision,integer,double precision) from public;
grant execute on function public.eventos_perto_de_mim(double precision,double precision,integer,double precision) to anon, authenticated;

create or replace function public.admin_metricas(p_dias integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 30), 365));
  v_inicio timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365)));
  v_resultado jsonb;
begin
  if not private.eh_admin() then
    raise exception 'Apenas administradores podem consultar as métricas';
  end if;

  select jsonb_build_object(
    'periodo_dias', v_dias,
    'totais', jsonb_build_object(
      'usuarios', (select count(*) from public.perfis),
      'eventos', (select count(*) from public.eventos),
      'eventos_ativos', (select count(*) from public.eventos where ativo = true),
      'comentarios', (select count(*) from public.comentarios),
      'interesses', (select count(*) from public.interesses),
      'denuncias', (select count(*) from public.denuncias),
      'denuncias_pendentes', (select count(*) from public.denuncias where status in ('recebida','em_analise','aguardando_info','em_recurso'))
    ),
    'periodo', jsonb_build_object(
      'usuarios', (select count(*) from public.perfis where criado_em >= v_inicio),
      'eventos', (select count(*) from public.eventos where criado_em >= v_inicio),
      'comentarios', (select count(*) from public.comentarios where criado_em >= v_inicio),
      'interesses', (select count(*) from public.interesses where criado_em >= v_inicio),
      'denuncias', (select count(*) from public.denuncias where criado_em >= v_inicio)
    ),
    'situacoes', coalesce((
      select jsonb_object_agg(x.situacao, x.qtd)
      from (
        select situacao, count(*)::bigint qtd
        from public.eventos
        group by situacao
      ) x
    ), '{}'::jsonb),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'qtd', x.qtd) order by x.qtd desc, x.nome)
      from (
        select c.id, c.nome, count(e.id)::bigint qtd
        from public.categorias c
        left join public.eventos e on e.categoria_id = c.id
        group by c.id, c.nome
      ) x
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.admin_metricas(integer) from public, anon;
grant execute on function public.admin_metricas(integer) to authenticated;
