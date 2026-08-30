-- ============================================================
-- ROLÊ — endereço detalhado (número, complemento e CEP)
-- Rode o arquivo inteiro no SQL Editor.
--
-- A view precisa ser recriada porque o "e.*" é expandido no
-- momento em que ela nasce: colunas novas na tabela não entram
-- sozinhas numa view que já existe.
-- ============================================================

alter table public.eventos
  add column if not exists numero      text,
  add column if not exists complemento text,
  add column if not exists cep         text;

-- CEP guardado só com os 8 dígitos, sem hífen
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_cep_valido') then
    alter table public.eventos add constraint eventos_cep_valido
      check (cep is null or cep ~ '^[0-9]{8}$');
  end if;
end
$$;

drop view if exists public.eventos_lista;

create view public.eventos_lista
with (security_invoker = true) as
select
  e.*,
  c.nome  as categoria_nome,
  c.emoji as categoria_emoji,
  p.nome  as criador_nome,
  (select count(*) from public.interesses i where i.evento_id = e.id) as total_interessados,
  (e.data_evento = current_date) as e_hoje
from public.eventos e
join public.categorias c on c.id = e.categoria_id
join public.perfis     p on p.id = e.criador_id;

grant select on public.eventos_lista to anon, authenticated;

-- conferência: numero, complemento e cep devem aparecer na lista
select column_name
from information_schema.columns
where table_name = 'eventos_lista'
order by ordinal_position;