-- ============================================================
-- ROLÊ — Etapa 8 (VERSÃO CORRIGIDA)
--
-- O script anterior falhava ao recriar a view eventos_lista e,
-- como o SQL Editor roda tudo em uma transação, o erro desfazia
-- também a criação das colunas latitude/longitude.
--
-- Duas correções:
--   1. criador_nome e total_interessados voltam a ser CALCULADOS
--      (join com perfis e contagem em interesses). Eles nunca
--      existiram como colunas da tabela eventos.
--   2. DROP VIEW antes de criar. "create or replace view" não
--      aceita mudar a lista de colunas de uma view existente.
--
-- Rode o arquivo inteiro no SQL Editor.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Coordenadas do evento
-- ------------------------------------------------------------
alter table public.eventos
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_latitude_valida') then
    alter table public.eventos add constraint eventos_latitude_valida
      check (latitude is null or latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'eventos_longitude_valida') then
    alter table public.eventos add constraint eventos_longitude_valida
      check (longitude is null or longitude between -180 and 180);
  end if;
end
$$;


-- ------------------------------------------------------------
-- 2. Índices de busca (Etapa 5)
-- pg_trgm permite buscar pedaços de palavra com ILIKE usando índice
-- ------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

create index if not exists eventos_nome_trgm_idx
  on public.eventos using gin (nome extensions.gin_trgm_ops);

create index if not exists eventos_descricao_trgm_idx
  on public.eventos using gin (descricao extensions.gin_trgm_ops);

create index if not exists eventos_localizacao_idx
  on public.eventos (latitude, longitude)
  where latitude is not null and longitude is not null;


-- ------------------------------------------------------------
-- 3. View da listagem
-- Precisa sair e entrar de novo porque a lista de colunas mudou.
-- ------------------------------------------------------------
drop view if exists public.eventos_lista;

create view public.eventos_lista
with (security_invoker = true) as
select
  e.*,                                    -- inclui latitude e longitude
  c.nome  as categoria_nome,
  c.emoji as categoria_emoji,
  p.nome  as criador_nome,                -- vem da tabela perfis
  (select count(*) from public.interesses i where i.evento_id = e.id) as total_interessados,
  (e.data_evento = current_date) as e_hoje
from public.eventos e
join public.categorias c on c.id = e.categoria_id
join public.perfis     p on p.id = e.criador_id;

grant select on public.eventos_lista to anon, authenticated;


-- ------------------------------------------------------------
-- 4. Conferência
-- Rode e veja se latitude e longitude aparecem na lista.
-- ------------------------------------------------------------
select column_name
from information_schema.columns
where table_name = 'eventos_lista'
order by ordinal_position;
