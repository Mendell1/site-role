-- ============================================================
-- ROLÊ — Plataforma Comunitária de Eventos Locais
-- ETAPA 2: estrutura do banco de dados (Supabase / PostgreSQL)
--
-- COMO USAR:
--   1. Abra seu projeto no Supabase
--   2. Menu lateral > SQL Editor > New query
--   3. Cole TODO este arquivo e clique em Run
--   4. Confira em Table Editor se as 6 tabelas apareceram
--
-- Pode rodar mais de uma vez sem quebrar nada.
-- ============================================================


-- ============================================================
-- 1. PERFIS  (dados do usuário + nível de acesso)
-- O Supabase já guarda e-mail e senha na tabela auth.users.
-- Esta tabela guarda o resto: nome, papel (usuario/admin) e bloqueio.
-- ============================================================
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text,
  papel       text not null default 'usuario' check (papel in ('usuario','admin')),
  bloqueado   boolean not null default false,
  criado_em   timestamptz not null default now()
);

comment on table public.perfis is 'Perfil do usuário. papel define o nível de acesso: usuario ou admin.';


-- ============================================================
-- 2. CATEGORIAS  (lista fixa, alimenta os filtros)
-- ============================================================
create table if not exists public.categorias (
  id      text primary key,
  nome    text not null,
  emoji   text,
  ordem   int  not null default 0
);

insert into public.categorias (id, nome, emoji, ordem) values
  ('festas',       'Festas',            '🎉', 1),
  ('games',        'Games',             '🎮', 2),
  ('esportes',     'Esportes',          '⚽', 3),
  ('educacao',     'Educação',          '🎓', 4),
  ('cultura',      'Cultura',           '🎨', 5),
  ('gastronomia',  'Gastronomia',       '🍔', 6),
  ('musica',       'Música',            '🎵', 7),
  ('social',       'Ações sociais',     '❤️', 8),
  ('profissional', 'Profissional',      '💼', 9),
  ('feiras',       'Feiras e bazares',  '📦', 10),
  ('outros',       'Outros',            '📌', 11)
on conflict (id) do nothing;


-- ============================================================
-- 3. EVENTOS  (tabela central do sistema)
-- ============================================================
create table if not exists public.eventos (
  id                  uuid primary key default gen_random_uuid(),
  criador_id          uuid not null references public.perfis(id) on delete cascade,
  categoria_id        text not null references public.categorias(id),

  nome                text not null check (char_length(nome) between 3 and 120),
  descricao           text,
  imagem_url          text,

  data_evento         date not null,
  hora_evento         time not null,

  endereco            text,
  bairro              text,
  cidade              text not null,
  uf                  char(2),
  latitude            numeric(10,7),   -- usado só na Etapa 8 (mapa)
  longitude           numeric(10,7),

  gratuito            boolean not null default true,
  valor               numeric(10,2) default 0 check (valor >= 0),
  max_participantes   int check (max_participantes > 0),
  contato             text,            -- link externo, WhatsApp ou telefone

  ativo               boolean not null default true,  -- admin desativa em vez de apagar
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),

  -- se é pago, precisa ter valor maior que zero
  constraint valor_coerente check (gratuito = true or valor > 0)
);

create index if not exists idx_eventos_data      on public.eventos (data_evento);
create index if not exists idx_eventos_categoria on public.eventos (categoria_id);
create index if not exists idx_eventos_cidade    on public.eventos (cidade);
create index if not exists idx_eventos_criador   on public.eventos (criador_id);


-- ============================================================
-- 4. FAVORITOS e 5. INTERESSES
-- Relacionamento N:N entre usuário e evento.
-- A chave primária composta impede favoritar duas vezes o mesmo evento.
-- ============================================================
create table if not exists public.favoritos (
  usuario_id  uuid not null references public.perfis(id) on delete cascade,
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (usuario_id, evento_id)
);

create table if not exists public.interesses (
  usuario_id  uuid not null references public.perfis(id) on delete cascade,
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (usuario_id, evento_id)
);

create index if not exists idx_interesses_evento on public.interesses (evento_id);
create index if not exists idx_favoritos_usuario on public.favoritos (usuario_id);


-- ============================================================
-- 6. DENÚNCIAS  (alimenta o painel do administrador)
-- ============================================================
create table if not exists public.denuncias (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  usuario_id    uuid references public.perfis(id) on delete set null,
  motivo        text not null,
  descricao     text,
  status        text not null default 'aberta' check (status in ('aberta','analisada','arquivada')),
  criado_em     timestamptz not null default now()
);

create index if not exists idx_denuncias_status on public.denuncias (status);


-- ============================================================
-- 7. AUTOMAÇÕES
-- ============================================================

-- 7.1 Ao criar conta, gera o perfil automaticamente
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();


-- 7.2 Atualiza a data de modificação do evento
create or replace function public.marcar_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists ao_atualizar_evento on public.eventos;
create trigger ao_atualizar_evento
  before update on public.eventos
  for each row execute function public.marcar_atualizacao();


-- 7.3 Função auxiliar: o usuário logado é admin?
-- Fica separada para evitar recursão nas políticas de segurança.
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and papel = 'admin'
  );
$$;


-- ============================================================
-- 8. SEGURANÇA — Row Level Security
-- Aqui está o coração do controle de acesso do TCC:
-- Visitante → Usuário → Administrador
-- ============================================================
alter table public.perfis      enable row level security;
alter table public.categorias  enable row level security;
alter table public.eventos     enable row level security;
alter table public.favoritos   enable row level security;
alter table public.interesses  enable row level security;
alter table public.denuncias   enable row level security;

-- --- CATEGORIAS: qualquer um lê, ninguém altera pelo site
drop policy if exists cat_leitura on public.categorias;
create policy cat_leitura on public.categorias
  for select using (true);

-- --- PERFIS
drop policy if exists perfil_ler on public.perfis;
create policy perfil_ler on public.perfis
  for select using (true);

drop policy if exists perfil_editar_proprio on public.perfis;
create policy perfil_editar_proprio on public.perfis
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists perfil_admin_gerencia on public.perfis;
create policy perfil_admin_gerencia on public.perfis
  for all using (public.eh_admin()) with check (public.eh_admin());

-- --- EVENTOS
-- visitante (sem login) enxerga só o que está ativo
drop policy if exists evento_ler_publico on public.eventos;
create policy evento_ler_publico on public.eventos
  for select using (ativo = true or auth.uid() = criador_id or public.eh_admin());

-- usuário logado e não bloqueado pode publicar em seu próprio nome
drop policy if exists evento_criar on public.eventos;
create policy evento_criar on public.eventos
  for insert with check (
    auth.uid() = criador_id
    and not exists (select 1 from public.perfis p where p.id = auth.uid() and p.bloqueado)
  );

drop policy if exists evento_editar_proprio on public.eventos;
create policy evento_editar_proprio on public.eventos
  for update using (auth.uid() = criador_id) with check (auth.uid() = criador_id);

drop policy if exists evento_excluir_proprio on public.eventos;
create policy evento_excluir_proprio on public.eventos
  for delete using (auth.uid() = criador_id);

drop policy if exists evento_admin on public.eventos;
create policy evento_admin on public.eventos
  for all using (public.eh_admin()) with check (public.eh_admin());

-- --- FAVORITOS: cada um enxerga e mexe apenas nos seus
drop policy if exists fav_proprios on public.favoritos;
create policy fav_proprios on public.favoritos
  for all using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

-- --- INTERESSES: todos podem CONTAR, mas só o dono cria e remove o seu
drop policy if exists int_ler on public.interesses;
create policy int_ler on public.interesses
  for select using (true);

drop policy if exists int_marcar on public.interesses;
create policy int_marcar on public.interesses
  for insert with check (auth.uid() = usuario_id);

drop policy if exists int_desmarcar on public.interesses;
create policy int_desmarcar on public.interesses
  for delete using (auth.uid() = usuario_id);

-- --- DENÚNCIAS: usuário logado denuncia, só o admin lê
drop policy if exists den_criar on public.denuncias;
create policy den_criar on public.denuncias
  for insert with check (auth.uid() = usuario_id);

drop policy if exists den_admin on public.denuncias;
create policy den_admin on public.denuncias
  for all using (public.eh_admin()) with check (public.eh_admin());


-- ============================================================
-- 9. VISÃO PRONTA PARA A LISTAGEM
-- Junta evento + categoria + contagem de interessados numa consulta só.
-- No site: supabase.from('eventos_lista').select('*')
-- ============================================================
create or replace view public.eventos_lista
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


-- ============================================================
-- 10. ARMAZENAMENTO DE IMAGENS
-- Cria o bucket público onde ficam as fotos dos eventos.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('eventos', 'eventos', true)
on conflict (id) do nothing;

drop policy if exists img_ver on storage.objects;
create policy img_ver on storage.objects
  for select using (bucket_id = 'eventos');

drop policy if exists img_enviar on storage.objects;
create policy img_enviar on storage.objects
  for insert to authenticated with check (bucket_id = 'eventos');

drop policy if exists img_apagar on storage.objects;
create policy img_apagar on storage.objects
  for delete to authenticated using (bucket_id = 'eventos' and owner = auth.uid());


-- ============================================================
-- 11. PARA VIRAR ADMINISTRADOR
-- Crie sua conta pelo site (Etapa 3), depois rode a linha abaixo
-- trocando pelo seu e-mail:
--
--   update public.perfis set papel = 'admin' where email = 'voce@email.com';
-- ============================================================

-- Fim do script.
