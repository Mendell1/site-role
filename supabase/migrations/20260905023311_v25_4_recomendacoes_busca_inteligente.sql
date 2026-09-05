create or replace function private.normalizar_busca_v25_4(p_texto text)
returns text
language sql
immutable
set search_path=''
as $$
  select lower(translate(coalesce(p_texto,''),
    'áàâãäéèêëíìîïóòôõöúùûüç',
    'aaaaaeeeeiiiiooooouuuuc'));
$$;
revoke all on function private.normalizar_busca_v25_4(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.normalizar_busca_v25_4(text) to anon, authenticated;

create or replace function public.buscar_eventos_inteligente_v25_4(
  p_consulta text,
  p_limite integer default 24
)
returns table(
  id uuid,
  criador_id uuid,
  nome text,
  descricao text,
  categoria_id text,
  categoria_nome text,
  categoria_emoji text,
  data_evento date,
  hora_evento time without time zone,
  endereco text,
  bairro text,
  cidade text,
  gratuito boolean,
  valor numeric,
  max_participantes integer,
  contato text,
  imagem_url text,
  ativo boolean,
  criador_nome text,
  total_interessados bigint,
  latitude double precision,
  longitude double precision,
  numero text,
  complemento text,
  cep text,
  criador_foto text,
  situacao text,
  total_comentarios bigint,
  e_hoje boolean,
  pontuacao numeric,
  interpretacao jsonb
)
language plpgsql
security invoker
stable
set search_path=''
as $$
declare
  v_q text := private.normalizar_busca_v25_4(p_consulta);
  v_cat text := null;
  v_gratis boolean := false;
  v_periodo text := null;
  v_local text := null;
  v_ini date := null;
  v_fim date := null;
  v_target integer := null;
  v_dow integer := extract(dow from current_date)::integer;
  v_tem_filtro boolean := false;
begin
  if length(btrim(v_q)) < 2 then
    return;
  end if;

  v_cat := case
    when v_q ~ '(gastronomia|gastronomico|comida|culinaria)' then 'gastronomia'
    when v_q ~ '(musica|show|samba|funk|pagode|rock|sertanejo|forro)' then 'musica'
    when v_q ~ '(esporte|futebol|corrida|campeonato|volei|basquete|skate)' then 'esportes'
    when v_q ~ '(game|games|jogo|jogos|e-sport|esport)' then 'games'
    when v_q ~ '(educacao|curso|aula|palestra|oficina)' then 'educacao'
    when v_q ~ '(cultura|cinema|teatro|exposicao|museu|arte)' then 'cultura'
    when v_q ~ '(feira|bazar)' then 'feiras'
    when v_q ~ '(festa|baile|balada)' then 'festas'
    when v_q ~ '(emprego|carreira|networking|profissional)' then 'profissional'
    when v_q ~ '(mutirao|voluntario|comunidade|social)' then 'social'
    else null
  end;

  v_gratis := v_q ~ '(gratis|gratuito|gratuita|de graca|sem pagar)';

  if v_q ~ '(a noite|de noite|noturno|noturna)' then
    v_periodo := 'noite';
  elsif v_q ~ '(de manha|pela manha|manha)' then
    v_periodo := 'manha';
  elsif v_q ~ '(a tarde|pela tarde|tarde)' then
    v_periodo := 'tarde';
  end if;

  if v_q like '%hoje%' then
    v_ini := current_date; v_fim := current_date;
  elsif v_q like '%amanha%' then
    v_ini := current_date + 1; v_fim := current_date + 1;
  elsif v_q like '%fim de semana%' then
    v_ini := current_date + ((6 - v_dow + 7) % 7);
    v_fim := v_ini + 1;
  else
    v_target := case
      when v_q like '%segunda%' then 1
      when v_q like '%terca%' then 2
      when v_q like '%quarta%' then 3
      when v_q like '%quinta%' then 4
      when v_q like '%sexta%' then 5
      when v_q like '%sabado%' then 6
      when v_q like '%domingo%' then 0
      else null
    end;
    if v_target is not null then
      v_ini := current_date + ((v_target - v_dow + 7) % 7);
      v_fim := v_ini;
    end if;
  end if;

  if v_q like '%perto de %' then
    v_local := split_part(v_q,'perto de ',2);
  elsif v_q like '%no bairro %' then
    v_local := split_part(v_q,'no bairro ',2);
  elsif v_q like '%na regiao de %' then
    v_local := split_part(v_q,'na regiao de ',2);
  end if;

  if v_local is not null then
    v_local := regexp_replace(v_local,
      '\s+(hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|fim de semana|a noite|de noite|de manha|pela manha|a tarde|pela tarde).*$',
      '', 'g');
    v_local := btrim(regexp_replace(v_local,'[[:punct:]]+$','','g'));
    if length(v_local) < 2 then v_local := null; end if;
  end if;

  v_tem_filtro := v_cat is not null or v_gratis or v_periodo is not null or v_ini is not null or v_local is not null;

  return query
  with candidatos as (
    select e.*,
      (
        case when v_cat is not null and e.categoria_id=v_cat then 5 else 0 end +
        case when v_gratis and e.gratuito then 3 else 0 end +
        case when v_local is not null and private.normalizar_busca_v25_4(coalesce(e.bairro,'')||' '||coalesce(e.cidade,'')) like '%'||v_local||'%' then 5 else 0 end +
        case when v_ini is not null and e.data_evento between v_ini and coalesce(v_fim,v_ini) then 3 else 0 end +
        case when v_periodo='manha' and e.hora_evento < time '12:00' then 2
             when v_periodo='tarde' and e.hora_evento >= time '12:00' and e.hora_evento < time '18:00' then 2
             when v_periodo='noite' and e.hora_evento >= time '18:00' then 2 else 0 end +
        least(coalesce(e.total_interessados,0),20)::numeric / 10 +
        extensions.similarity(
          private.normalizar_busca_v25_4(coalesce(e.nome,'')||' '||coalesce(e.descricao,'')||' '||coalesce(e.bairro,'')||' '||coalesce(e.cidade,'')),
          v_q
        ) * 4
      )::numeric as score
    from public.eventos_lista e
    where e.ativo=true
      and e.data_evento >= current_date
      and coalesce(e.situacao,'agendado') not in ('cancelado','finalizado')
      and (v_cat is null or e.categoria_id=v_cat)
      and (not v_gratis or e.gratuito=true)
      and (v_ini is null or e.data_evento between v_ini and coalesce(v_fim,v_ini))
      and (v_periodo is null
        or (v_periodo='manha' and e.hora_evento < time '12:00')
        or (v_periodo='tarde' and e.hora_evento >= time '12:00' and e.hora_evento < time '18:00')
        or (v_periodo='noite' and e.hora_evento >= time '18:00'))
      and (v_local is null or private.normalizar_busca_v25_4(coalesce(e.bairro,'')||' '||coalesce(e.cidade,'')) like '%'||v_local||'%')
      and (
        v_tem_filtro
        or private.normalizar_busca_v25_4(coalesce(e.nome,'')||' '||coalesce(e.descricao,'')||' '||coalesce(e.bairro,'')||' '||coalesce(e.cidade,'')) like '%'||v_q||'%'
        or extensions.similarity(
          private.normalizar_busca_v25_4(coalesce(e.nome,'')||' '||coalesce(e.descricao,'')||' '||coalesce(e.bairro,'')||' '||coalesce(e.cidade,'')),
          v_q
        ) > 0.08
      )
  )
  select c.id,c.criador_id,c.nome,c.descricao,c.categoria_id,c.categoria_nome,c.categoria_emoji,
    c.data_evento,c.hora_evento,c.endereco,c.bairro,c.cidade,c.gratuito,c.valor,c.max_participantes,
    c.contato,c.imagem_url,c.ativo,c.criador_nome,c.total_interessados,c.latitude,c.longitude,c.numero,
    c.complemento,c.cep,c.criador_foto,c.situacao,c.total_comentarios,c.e_hoje,c.score,
    jsonb_strip_nulls(jsonb_build_object(
      'categoria',v_cat,
      'gratuito',case when v_gratis then true else null end,
      'data_inicio',v_ini,
      'data_fim',v_fim,
      'periodo',v_periodo,
      'local',v_local
    ))
  from candidatos c
  order by c.score desc,c.data_evento asc,c.hora_evento asc nulls last
  limit least(greatest(coalesce(p_limite,24),1),50);
end;
$$;
revoke all on function public.buscar_eventos_inteligente_v25_4(text,integer) from public;
grant execute on function public.buscar_eventos_inteligente_v25_4(text,integer) to anon, authenticated;

create or replace function private.recomendacoes_v25_4_impl(p_limite integer default 12)
returns table(
  id uuid,
  criador_id uuid,
  nome text,
  descricao text,
  categoria_id text,
  categoria_nome text,
  categoria_emoji text,
  data_evento date,
  hora_evento time without time zone,
  endereco text,
  bairro text,
  cidade text,
  gratuito boolean,
  valor numeric,
  max_participantes integer,
  contato text,
  imagem_url text,
  ativo boolean,
  criador_nome text,
  total_interessados bigint,
  latitude double precision,
  longitude double precision,
  numero text,
  complemento text,
  cep text,
  criador_foto text,
  situacao text,
  total_comentarios bigint,
  e_hoje boolean,
  pontuacao numeric,
  motivos text[]
)
language sql
security definer
stable
set search_path=''
as $$
with usuario as (
  select p.id,p.cidade
  from public.perfis p
  where p.id=auth.uid()
), sinais_categoria as (
  select s.categoria_id,sum(s.peso)::numeric as peso
  from (
    select e.categoria_id,3::numeric as peso
    from public.favoritos f join public.eventos e on e.id=f.evento_id
    where f.usuario_id=auth.uid()
    union all
    select e.categoria_id,2::numeric
    from public.interesses i join public.eventos e on e.id=i.evento_id
    where i.usuario_id=auth.uid()
    union all
    select a.categoria_id,2::numeric
    from public.alertas_eventos a
    where a.usuario_id=auth.uid() and a.ativo=true and a.categoria_id is not null
  ) s
  where s.categoria_id is not null
  group by s.categoria_id
), ranqueados as (
  select e.*,
    (
      coalesce(sc.peso,0) +
      case when u.cidade is not null and lower(e.cidade)=lower(u.cidade) then 3 else 0 end +
      case when exists(
        select 1 from public.seguidores_organizadores so
        where so.seguidor_id=auth.uid() and so.organizador_id=e.criador_id
      ) then 5 else 0 end +
      case when exists(
        select 1 from public.alertas_eventos a
        where a.usuario_id=auth.uid() and a.ativo=true
          and (a.categoria_id is null or a.categoria_id=e.categoria_id)
          and (a.cidade is null or lower(a.cidade)=lower(e.cidade))
          and (not coalesce(a.somente_gratuitos,false) or e.gratuito=true)
          and (not coalesce(a.fim_de_semana,false) or extract(isodow from e.data_evento) in (6,7))
      ) then 5 else 0 end +
      case when e.gratuito then 0.5 else 0 end +
      case when e.data_evento <= current_date+7 then 1 else 0 end +
      least(coalesce(e.total_interessados,0),20)::numeric/10
    )::numeric as score,
    array_remove(array[
      case when coalesce(sc.peso,0)>0 then 'Categoria que combina com seus interesses' end,
      case when u.cidade is not null and lower(e.cidade)=lower(u.cidade) then 'Na sua cidade' end,
      case when exists(select 1 from public.seguidores_organizadores so where so.seguidor_id=auth.uid() and so.organizador_id=e.criador_id) then 'Organizador que você segue' end,
      case when exists(
        select 1 from public.alertas_eventos a
        where a.usuario_id=auth.uid() and a.ativo=true
          and (a.categoria_id is null or a.categoria_id=e.categoria_id)
          and (a.cidade is null or lower(a.cidade)=lower(e.cidade))
          and (not coalesce(a.somente_gratuitos,false) or e.gratuito=true)
          and (not coalesce(a.fim_de_semana,false) or extract(isodow from e.data_evento) in (6,7))
      ) then 'Combina com um alerta seu' end,
      case when e.gratuito then 'Evento gratuito' end
    ]::text[],null) as razoes
  from public.eventos_lista e
  cross join usuario u
  left join sinais_categoria sc on sc.categoria_id=e.categoria_id
  where e.ativo=true
    and e.data_evento>=current_date
    and coalesce(e.situacao,'agendado') not in ('cancelado','finalizado')
    and e.criador_id<>auth.uid()
)
select r.id,r.criador_id,r.nome,r.descricao,r.categoria_id,r.categoria_nome,r.categoria_emoji,
  r.data_evento,r.hora_evento,r.endereco,r.bairro,r.cidade,r.gratuito,r.valor,r.max_participantes,
  r.contato,r.imagem_url,r.ativo,r.criador_nome,r.total_interessados,r.latitude,r.longitude,r.numero,
  r.complemento,r.cep,r.criador_foto,r.situacao,r.total_comentarios,r.e_hoje,r.score,r.razoes
from ranqueados r
order by r.score desc,r.data_evento asc,r.hora_evento asc nulls last
limit least(greatest(coalesce(p_limite,12),1),30);
$$;
revoke all on function private.recomendacoes_v25_4_impl(integer) from public,anon;
grant execute on function private.recomendacoes_v25_4_impl(integer) to authenticated;

create or replace function public.recomendacoes_v25_4(p_limite integer default 12)
returns table(
  id uuid,
  criador_id uuid,
  nome text,
  descricao text,
  categoria_id text,
  categoria_nome text,
  categoria_emoji text,
  data_evento date,
  hora_evento time without time zone,
  endereco text,
  bairro text,
  cidade text,
  gratuito boolean,
  valor numeric,
  max_participantes integer,
  contato text,
  imagem_url text,
  ativo boolean,
  criador_nome text,
  total_interessados bigint,
  latitude double precision,
  longitude double precision,
  numero text,
  complemento text,
  cep text,
  criador_foto text,
  situacao text,
  total_comentarios bigint,
  e_hoje boolean,
  pontuacao numeric,
  motivos text[]
)
language sql
security invoker
stable
set search_path=''
as $$
  select * from private.recomendacoes_v25_4_impl(p_limite);
$$;
revoke all on function public.recomendacoes_v25_4(integer) from public,anon;
grant execute on function public.recomendacoes_v25_4(integer) to authenticated;
