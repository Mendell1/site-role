-- ============================================================
-- ROLÊ — Comentários, perfil completo e verificação de idade
-- Rode o arquivo inteiro no SQL Editor.
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================


-- ============================================================
-- 1. PERFIL COMPLETO
-- ============================================================
alter table public.perfis
  add column if not exists foto_url         text,
  add column if not exists bio              text,
  add column if not exists data_nascimento  date,
  add column if not exists cidade           text,
  add column if not exists contato          text,
  add column if not exists atualizado_em    timestamptz not null default now();

-- limite de tamanho da biografia
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_bio_tamanho') then
    alter table public.perfis add constraint perfis_bio_tamanho
      check (bio is null or char_length(bio) <= 300);
  end if;
end
$$;


-- ============================================================
-- 2. VERIFICAÇÃO DE IDADE (18+)
--
-- Não dá para usar CHECK aqui: a regra depende da data de hoje,
-- e o Postgres só aceita expressões imutáveis em CHECK. A idade
-- muda com o tempo, então a validação vai num gatilho.
--
-- Validar no banco importa porque a checagem do navegador pode
-- ser burlada por qualquer um que abra o console.
-- ============================================================
create or replace function public.idade_em_anos(nascimento date)
returns int
language sql
immutable
as $$
  select extract(year from age(current_date, nascimento))::int;
$$;

create or replace function public.validar_maioridade()
returns trigger
language plpgsql
as $$
begin
  if new.data_nascimento is null then
    return new;                                   -- contas antigas seguem válidas
  end if;

  if new.data_nascimento > current_date then
    raise exception 'Data de nascimento no futuro';
  end if;

  if age(current_date, new.data_nascimento) < interval '18 years' then
    raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
  end if;

  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists ao_salvar_perfil on public.perfis;
create trigger ao_salvar_perfil
  before insert or update on public.perfis
  for each row execute function public.validar_maioridade();


-- ------------------------------------------------------------
-- 2.1 Cadastro passa a gravar a data de nascimento
-- ------------------------------------------------------------
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email, data_nascimento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'data_nascimento','')::date
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ============================================================
-- 3. COMENTÁRIOS
-- ============================================================
create table if not exists public.comentarios (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  autor_id    uuid not null references public.perfis(id)  on delete cascade,
  texto       text not null check (char_length(trim(texto)) between 1 and 1000),
  criado_em   timestamptz not null default now(),
  editado_em  timestamptz
);

create index if not exists comentarios_evento_idx on public.comentarios (evento_id, criado_em);

alter table public.comentarios enable row level security;

-- qualquer visitante lê os comentários de eventos visíveis
drop policy if exists coment_ler on public.comentarios;
create policy coment_ler on public.comentarios
  for select using (
    exists (select 1 from public.eventos e where e.id = evento_id and e.ativo = true)
    or public.eh_admin()
  );

-- só quem está logado e não bloqueado comenta, e sempre em seu próprio nome
drop policy if exists coment_criar on public.comentarios;
create policy coment_criar on public.comentarios
  for insert with check (
    auth.uid() = autor_id
    and not exists (select 1 from public.perfis p where p.id = auth.uid() and p.bloqueado)
  );

drop policy if exists coment_editar on public.comentarios;
create policy coment_editar on public.comentarios
  for update using (auth.uid() = autor_id) with check (auth.uid() = autor_id);

-- o autor apaga o seu; o dono do evento também pode limpar a página dele
drop policy if exists coment_apagar on public.comentarios;
create policy coment_apagar on public.comentarios
  for delete using (
    auth.uid() = autor_id
    or exists (select 1 from public.eventos e where e.id = evento_id and e.criador_id = auth.uid())
  );

drop policy if exists coment_admin on public.comentarios;
create policy coment_admin on public.comentarios
  for all using (public.eh_admin()) with check (public.eh_admin());

-- marca a edição automaticamente
create or replace function public.marcar_edicao_comentario()
returns trigger language plpgsql as $$
begin
  if new.texto is distinct from old.texto then
    new.editado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists ao_editar_comentario on public.comentarios;
create trigger ao_editar_comentario
  before update on public.comentarios
  for each row execute function public.marcar_edicao_comentario();


-- ------------------------------------------------------------
-- 3.1 View com o nome e a foto de quem comentou
-- ------------------------------------------------------------
drop view if exists public.comentarios_lista;

create view public.comentarios_lista
with (security_invoker = true) as
select
  co.id, co.evento_id, co.autor_id, co.texto, co.criado_em, co.editado_em,
  p.nome     as autor_nome,
  p.foto_url as autor_foto
from public.comentarios co
join public.perfis p on p.id = co.autor_id;

grant select on public.comentarios_lista to anon, authenticated;


-- ============================================================
-- 4. VIEW DE EVENTOS — agora com foto de quem publicou
-- e a contagem de comentários
-- ============================================================
drop view if exists public.eventos_lista;

create view public.eventos_lista
with (security_invoker = true) as
select
  e.*,
  c.nome     as categoria_nome,
  c.emoji    as categoria_emoji,
  p.nome     as criador_nome,
  p.foto_url as criador_foto,
  (select count(*) from public.interesses  i  where i.evento_id  = e.id) as total_interessados,
  (select count(*) from public.comentarios co where co.evento_id = e.id) as total_comentarios,
  (e.data_evento = current_date) as e_hoje
from public.eventos e
join public.categorias c on c.id = e.categoria_id
join public.perfis     p on p.id = e.criador_id;

grant select on public.eventos_lista to anon, authenticated;


-- ============================================================
-- 5. FOTOS DE PERFIL
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists avatar_ver on storage.objects;
create policy avatar_ver on storage.objects
  for select using (bucket_id = 'avatares');

drop policy if exists avatar_enviar on storage.objects;
create policy avatar_enviar on storage.objects
  for insert to authenticated with check (bucket_id = 'avatares');

drop policy if exists avatar_trocar on storage.objects;
create policy avatar_trocar on storage.objects
  for update to authenticated using (bucket_id = 'avatares' and owner = auth.uid());

drop policy if exists avatar_apagar on storage.objects;
create policy avatar_apagar on storage.objects
  for delete to authenticated using (bucket_id = 'avatares' and owner = auth.uid());


-- ============================================================
-- 6. TEMPO REAL NOS COMENTÁRIOS (opcional)
-- ============================================================
do $$
begin
  alter publication supabase_realtime add table public.comentarios;
exception when duplicate_object then
  null;   -- já estava na publicação
end
$$;


-- ============================================================
-- 7. CONFERÊNCIA
-- ============================================================
select 'perfis' as tabela, column_name
from information_schema.columns where table_name = 'perfis'
union all
select 'comentarios_lista', column_name
from information_schema.columns where table_name = 'comentarios_lista'
order by 1, 2;