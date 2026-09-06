-- ============================================================
-- ROLÊ V25.6 — Eventos recorrentes
-- Série semanal/mensal mantendo cada ocorrência como evento real.
-- Inscrições, fila, ingresso e check-in continuam independentes.
-- ============================================================

alter table public.eventos
  add column if not exists serie_id uuid,
  add column if not exists recorrencia_tipo text,
  add column if not exists recorrencia_intervalo smallint,
  add column if not exists recorrencia_ordem smallint,
  add column if not exists recorrencia_total smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.eventos'::regclass
      and conname='eventos_recorrencia_tipo_check'
  ) then
    alter table public.eventos
      add constraint eventos_recorrencia_tipo_check
      check (recorrencia_tipo is null or recorrencia_tipo in ('semanal','mensal'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.eventos'::regclass
      and conname='eventos_recorrencia_intervalo_check'
  ) then
    alter table public.eventos
      add constraint eventos_recorrencia_intervalo_check
      check (recorrencia_intervalo is null or recorrencia_intervalo between 1 and 12);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.eventos'::regclass
      and conname='eventos_recorrencia_total_check'
  ) then
    alter table public.eventos
      add constraint eventos_recorrencia_total_check
      check (recorrencia_total is null or recorrencia_total between 2 and 52);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.eventos'::regclass
      and conname='eventos_recorrencia_ordem_check'
  ) then
    alter table public.eventos
      add constraint eventos_recorrencia_ordem_check
      check (
        recorrencia_ordem is null
        or (recorrencia_ordem >= 1 and recorrencia_total is not null and recorrencia_ordem <= recorrencia_total)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.eventos'::regclass
      and conname='eventos_recorrencia_conjunto_check'
  ) then
    alter table public.eventos
      add constraint eventos_recorrencia_conjunto_check
      check (
        (serie_id is null and recorrencia_tipo is null and recorrencia_intervalo is null and recorrencia_ordem is null and recorrencia_total is null)
        or
        (serie_id is not null and recorrencia_tipo is not null and recorrencia_intervalo is not null and recorrencia_ordem is not null and recorrencia_total is not null)
      );
  end if;
end $$;

create unique index if not exists eventos_serie_ordem_uidx
  on public.eventos(serie_id, recorrencia_ordem)
  where serie_id is not null;

create index if not exists eventos_serie_data_idx
  on public.eventos(serie_id, data_evento)
  where serie_id is not null;

-- A view pública mantém o mesmo formato anterior e acrescenta
-- apenas os metadados da série no final.
create or replace view public.eventos_lista
with (security_invoker = true)
as
select
  e.id,
  e.criador_id,
  e.nome,
  e.descricao,
  e.categoria_id,
  c.nome as categoria_nome,
  c.emoji as categoria_emoji,
  e.data_evento,
  e.hora_evento,
  e.endereco,
  e.bairro,
  e.cidade,
  e.gratuito,
  e.valor,
  e.max_participantes,
  e.contato,
  e.imagem_url,
  e.ativo,
  e.criador_nome,
  e.total_interessados,
  e.latitude,
  e.longitude,
  e.numero,
  e.complemento,
  e.cep,
  e.criador_foto,
  e.situacao,
  (select count(*) from public.comentarios co where co.evento_id=e.id) as total_comentarios,
  e.data_evento=current_date as e_hoje,
  e.serie_id,
  e.recorrencia_tipo,
  e.recorrencia_intervalo,
  e.recorrencia_ordem,
  e.recorrencia_total
from public.eventos e
join public.categorias c on c.id=e.categoria_id
where e.ativo=true;

-- Cria uma série inteira em uma única transação. A função é INVOKER:
-- os INSERTs continuam passando pela RLS normal de eventos.
create or replace function public.criar_eventos_recorrentes_v25_6(
  p_evento jsonb,
  p_tipo text,
  p_intervalo integer default 1,
  p_quantidade integer default 4
)
returns table(serie_id uuid, evento_id uuid, data_evento date, ordem integer)
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_serie uuid := gen_random_uuid();
  v_inicio date;
  v_data date;
  v_id uuid;
  v_i integer;
  v_nome text;
  v_categoria text;
  v_cidade text;
  v_valor numeric;
  v_gratuito boolean;
  v_max integer;
  v_lat double precision;
  v_lng double precision;
  v_situacao text;
begin
  if v_usuario is null then
    raise exception 'Autenticação necessária';
  end if;
  if p_evento is null then
    raise exception 'Dados do evento ausentes';
  end if;

  p_tipo := lower(btrim(coalesce(p_tipo,'')));
  if p_tipo not in ('semanal','mensal') then
    raise exception 'Recorrência deve ser semanal ou mensal';
  end if;
  if p_intervalo is null or p_intervalo < 1 or p_intervalo > 12 then
    raise exception 'Intervalo da recorrência deve ficar entre 1 e 12';
  end if;
  if p_quantidade is null or p_quantidade < 2 or p_quantidade > 52 then
    raise exception 'Quantidade de ocorrências deve ficar entre 2 e 52';
  end if;

  v_nome := btrim(coalesce(p_evento->>'nome',''));
  v_categoria := nullif(btrim(coalesce(p_evento->>'categoria_id','')), '');
  v_cidade := btrim(coalesce(p_evento->>'cidade',''));
  v_inicio := nullif(p_evento->>'data_evento','')::date;
  v_valor := coalesce(nullif(p_evento->>'valor','')::numeric, 0);
  v_gratuito := coalesce(nullif(p_evento->>'gratuito','')::boolean, v_valor=0);
  v_max := nullif(p_evento->>'max_participantes','')::integer;
  v_lat := nullif(p_evento->>'latitude','')::double precision;
  v_lng := nullif(p_evento->>'longitude','')::double precision;
  v_situacao := coalesce(nullif(p_evento->>'situacao',''), 'agendado');

  if char_length(v_nome) < 3 then raise exception 'Nome muito curto'; end if;
  if v_categoria is null then raise exception 'Categoria obrigatória'; end if;
  if v_cidade = '' then raise exception 'Cidade obrigatória'; end if;
  if v_inicio is null then raise exception 'Data inicial obrigatória'; end if;
  if v_inicio < current_date then raise exception 'A primeira ocorrência não pode estar no passado'; end if;
  if v_max is not null and v_max <= 0 then raise exception 'Quantidade de vagas inválida'; end if;

  for v_i in 0..(p_quantidade-1) loop
    if p_tipo='semanal' then
      v_data := v_inicio + (v_i * p_intervalo * 7);
    else
      v_data := (v_inicio + make_interval(months => v_i * p_intervalo))::date;
    end if;

    insert into public.eventos(
      criador_id, nome, descricao, categoria_id,
      data_evento, hora_evento, endereco, numero, complemento, cep,
      bairro, cidade, gratuito, valor, max_participantes, contato,
      imagem_url, situacao, latitude, longitude,
      serie_id, recorrencia_tipo, recorrencia_intervalo,
      recorrencia_ordem, recorrencia_total
    ) values (
      v_usuario,
      v_nome,
      nullif(p_evento->>'descricao',''),
      v_categoria,
      v_data,
      coalesce(nullif(p_evento->>'hora_evento','')::time, time '19:00'),
      nullif(p_evento->>'endereco',''),
      nullif(p_evento->>'numero',''),
      nullif(p_evento->>'complemento',''),
      nullif(p_evento->>'cep',''),
      nullif(p_evento->>'bairro',''),
      v_cidade,
      v_gratuito,
      v_valor,
      v_max,
      nullif(p_evento->>'contato',''),
      nullif(p_evento->>'imagem_url',''),
      v_situacao,
      v_lat,
      v_lng,
      v_serie,
      p_tipo,
      p_intervalo::smallint,
      (v_i+1)::smallint,
      p_quantidade::smallint
    ) returning id into v_id;

    serie_id := v_serie;
    evento_id := v_id;
    data_evento := v_data;
    ordem := v_i+1;
    return next;
  end loop;
end;
$$;

revoke all on function public.criar_eventos_recorrentes_v25_6(jsonb,text,integer,integer) from public;
revoke all on function public.criar_eventos_recorrentes_v25_6(jsonb,text,integer,integer) from anon;
grant execute on function public.criar_eventos_recorrentes_v25_6(jsonb,text,integer,integer) to authenticated;

-- Uma série pode ter muitas datas, mas seguidores/alertas recebem um
-- único aviso quando a série é publicada (a primeira ocorrência).
create or replace function private.notificar_novo_evento_v25()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  nome_org text;
begin
  if not new.ativo then return new; end if;
  if new.serie_id is not null and coalesce(new.recorrencia_ordem,1) > 1 then return new; end if;

  select nome into nome_org from public.perfis where id=new.criador_id;

  insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
  select
    s.seguidor_id,
    'Novo evento de '||coalesce(nome_org,'um organizador que você segue'),
    new.nome||' · '||to_char(new.data_evento,'DD/MM/YYYY')||coalesce(' · '||nullif(new.cidade,''),''),
    new.id
  from public.seguidores_organizadores s
  join public.perfis p on p.id=s.seguidor_id
  where s.organizador_id=new.criador_id
    and p.notif_eventos=true
    and p.bloqueado=false
    and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate <= now());

  insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
  select
    a.usuario_id,
    'Evento encontrado para “'||a.nome||'”',
    new.nome||' · '||to_char(new.data_evento,'DD/MM/YYYY')||coalesce(' · '||nullif(new.cidade,''),''),
    new.id
  from public.alertas_eventos a
  join public.perfis p on p.id=a.usuario_id
  where a.ativo=true
    and p.bloqueado=false
    and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate <= now())
    and (a.categoria_id is null or a.categoria_id=new.categoria_id)
    and (a.cidade is null or btrim(a.cidade)='' or lower(btrim(a.cidade))=lower(btrim(new.cidade)))
    and (not a.somente_gratuitos or new.gratuito=true)
    and (not a.fim_de_semana or extract(isodow from new.data_evento) in (6,7))
    and (
      a.raio_km is null
      or (
        new.latitude is not null and new.longitude is not null
        and a.latitude is not null and a.longitude is not null
        and private.distancia_km_v25(a.latitude,a.longitude,new.latitude,new.longitude) <= a.raio_km
      )
    );

  return new;
end;
$$;
