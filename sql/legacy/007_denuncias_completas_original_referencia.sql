-- ============================================================
-- ROLÊ — Termos, exclusão programada, denúncias completas
--        e auditoria administrativa
-- Rode o arquivo inteiro no SQL Editor. Pode repetir sem quebrar.
-- ============================================================


-- ============================================================
-- 1. TERMOS ACEITOS (versão e data)
--
-- Guardar a versão importa: quando os termos mudarem, dá para
-- saber quem aceitou qual texto e pedir novo aceite só a quem
-- ficou para trás.
-- ============================================================
alter table public.perfis
  add column if not exists termos_versao      text,
  add column if not exists termos_aceitos_em  timestamptz,
  add column if not exists suspenso_ate       timestamptz,
  add column if not exists advertencias       int not null default 0,
  add column if not exists exclusao_pedida_em timestamptz,
  add column if not exists exclusao_prevista  timestamptz;

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  aceite  boolean := coalesce((new.raw_user_meta_data->>'aceitou_regras')::boolean, false);
  versao  text    := nullif(new.raw_user_meta_data->>'termos_versao','');
begin
  insert into public.perfis (
    id, nome, email, data_nascimento,
    aceitou_regras, regras_aceitas_em, termos_versao, termos_aceitos_em
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    nullif(new.raw_user_meta_data->>'data_nascimento','')::date,
    aceite,
    case when aceite then now() end,
    versao,
    case when versao is not null then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


-- ============================================================
-- 2. PROTEÇÃO CONTRA TENTATIVAS SEGUIDAS DE LOGIN
--
-- O bloqueio é por e-mail e mora no servidor. Contar no
-- navegador não adianta: basta abrir uma aba anônima.
--
-- A tabela não é legível por ninguém — só as funções abaixo,
-- que rodam como dono e devolvem apenas o essencial.
-- ============================================================
create table if not exists public.tentativas_login (
  email        text primary key,
  falhas       int not null default 0,
  ultima_falha timestamptz,
  bloqueado_ate timestamptz
);

alter table public.tentativas_login enable row level security;
-- sem políticas: nenhum cliente lê ou escreve direto

create or replace function public.checar_bloqueio_login(p_email text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  restante int;
begin
  select greatest(0, ceil(extract(epoch from (bloqueado_ate - now()))))::int
    into restante
  from public.tentativas_login
  where email = lower(trim(p_email)) and bloqueado_ate > now();

  return coalesce(restante, 0);   -- segundos restantes; 0 = liberado
end;
$$;

create or replace function public.registrar_falha_login(p_email text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  atual public.tentativas_login;
  limite constant int := 5;
begin
  insert into public.tentativas_login (email, falhas, ultima_falha)
  values (lower(trim(p_email)), 1, now())
  on conflict (email) do update
    set falhas = case
                   when public.tentativas_login.ultima_falha < now() - interval '15 minutes'
                   then 1                                   -- esfriou, recomeça
                   else public.tentativas_login.falhas + 1
                 end,
        ultima_falha = now()
  returning * into atual;

  if atual.falhas >= limite then
    update public.tentativas_login
       set bloqueado_ate = now() + interval '15 minutes',
           falhas = 0
     where email = atual.email;
    return -1;                                              -- acabou de bloquear
  end if;

  return limite - atual.falhas;                             -- tentativas restantes
end;
$$;

create or replace function public.limpar_falhas_login(p_email text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.tentativas_login where email = lower(trim(p_email));
end;
$$;

grant execute on function public.checar_bloqueio_login(text)  to anon, authenticated;
grant execute on function public.registrar_falha_login(text)  to anon, authenticated;
grant execute on function public.limpar_falhas_login(text)    to anon, authenticated;


-- ============================================================
-- 3. EXCLUSÃO DE CONTA COM ARREPENDIMENTO DE 7 DIAS
--
-- Pedir para sair não apaga nada na hora: marca a data e
-- desativa. Entrar de novo dentro do prazo cancela o pedido.
-- Passados os 7 dias, a conta é apagada de verdade.
-- ============================================================
create or replace function public.solicitar_exclusao_conta()
returns timestamptz
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
  prazo timestamptz := now() + interval '7 days';
begin
  if eu is null then raise exception 'Nenhuma sessão ativa'; end if;

  update public.perfis
     set exclusao_pedida_em = now(),
         exclusao_prevista  = prazo
   where id = eu;

  return prazo;
end;
$$;

create or replace function public.cancelar_exclusao_conta()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  eu uuid := auth.uid();
begin
  if eu is null then raise exception 'Nenhuma sessão ativa'; end if;

  update public.perfis
     set exclusao_pedida_em = null,
         exclusao_prevista  = null
   where id = eu;
end;
$$;

-- apaga de verdade as contas cujo prazo venceu.
-- denuncias.usuario_id é ON DELETE SET NULL, então o histórico
-- administrativo sobrevive sem apontar para ninguém.
create or replace function public.processar_exclusoes_vencidas()
returns integer
language plpgsql
security definer set search_path = public, auth
as $$
declare
  removidas integer := 0;
  alvo uuid;
begin
  for alvo in
    select id from public.perfis
    where exclusao_prevista is not null and exclusao_prevista < now()
  loop
    delete from auth.users where id = alvo;
    removidas := removidas + 1;
  end loop;

  return removidas;
end;
$$;

grant execute on function public.solicitar_exclusao_conta()      to authenticated;
grant execute on function public.cancelar_exclusao_conta()       to authenticated;
grant execute on function public.processar_exclusoes_vencidas()  to authenticated;


-- ============================================================
-- 4. DENÚNCIAS COMPLETAS
-- ============================================================
alter table public.denuncias
  add column if not exists categoria      text,
  add column if not exists alvo_tipo      text not null default 'evento',
  add column if not exists denunciado_id  uuid references public.perfis(id) on delete set null,
  add column if not exists evidencia_url  text,
  add column if not exists admin_id       uuid references public.perfis(id) on delete set null,
  add column if not exists decisao        text,
  add column if not exists medida         text,
  add column if not exists resolvida_em   timestamptz,
  add column if not exists prazo_recurso  timestamptz,
  add column if not exists recurso_texto  text,
  add column if not exists recurso_em     timestamptz,
  add column if not exists autor_apelido  text;      -- retrato do nome na hora da denúncia

-- ----- status novos -----
alter table public.denuncias drop constraint if exists denuncias_status_check;

update public.denuncias set status = 'resolvida' where status = 'finalizada';

alter table public.denuncias
  add constraint denuncias_status_check
  check (status in ('recebida','em_analise','aguardando_info','resolvida','arquivada'));

alter table public.denuncias alter column status set default 'recebida';

alter table public.denuncias drop constraint if exists denuncias_decisao_check;
alter table public.denuncias
  add constraint denuncias_decisao_check
  check (decisao is null or decisao in
    ('violacao_confirmada','sem_violacao','evidencia_insuficiente','duplicada'));

alter table public.denuncias drop constraint if exists denuncias_medida_check;
alter table public.denuncias
  add constraint denuncias_medida_check
  check (medida is null or medida in
    ('nenhuma','advertencia','remocao','suspensao','banimento'));

alter table public.denuncias drop constraint if exists denuncias_alvo_check;
alter table public.denuncias
  add constraint denuncias_alvo_check
  check (alvo_tipo in ('evento','comentario','usuario'));

create index if not exists denuncias_status_idx    on public.denuncias (status, criado_em desc);
create index if not exists denuncias_categoria_idx on public.denuncias (categoria);
create index if not exists denuncias_admin_idx     on public.denuncias (admin_id);

-- quem denuncia pode enviar recurso na própria denúncia, dentro do prazo
drop policy if exists den_recurso on public.denuncias;
create policy den_recurso on public.denuncias
  for update using (
    auth.uid() = usuario_id and status = 'resolvida'
    and prazo_recurso is not null and prazo_recurso > now()
  ) with check (auth.uid() = usuario_id);


-- ------------------------------------------------------------
-- 4.1 Histórico de cada denúncia
-- ------------------------------------------------------------
create table if not exists public.denuncia_historico (
  id          uuid primary key default gen_random_uuid(),
  denuncia_id uuid not null references public.denuncias(id) on delete cascade,
  ator_id     uuid references public.perfis(id) on delete set null,
  ator_nome   text,
  acao        text not null,
  detalhe     text,
  criado_em   timestamptz not null default now()
);

create index if not exists den_hist_idx on public.denuncia_historico (denuncia_id, criado_em);

alter table public.denuncia_historico enable row level security;

drop policy if exists hist_admin on public.denuncia_historico;
create policy hist_admin on public.denuncia_historico
  for all using (public.eh_admin()) with check (public.eh_admin());

-- o autor da denúncia acompanha o andamento da sua
drop policy if exists hist_autor on public.denuncia_historico;
create policy hist_autor on public.denuncia_historico
  for select using (
    exists (select 1 from public.denuncias d
            where d.id = denuncia_id and d.usuario_id = auth.uid())
  );


-- ------------------------------------------------------------
-- 4.2 Auditoria geral do administrador
-- ------------------------------------------------------------
create table if not exists public.log_admin (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid references public.perfis(id) on delete set null,
  admin_nome text,
  acao       text not null,
  alvo_tipo  text,
  alvo_id    uuid,
  detalhe    text,
  criado_em  timestamptz not null default now()
);

create index if not exists log_admin_idx on public.log_admin (criado_em desc);

alter table public.log_admin enable row level security;

drop policy if exists log_ler on public.log_admin;
create policy log_ler on public.log_admin
  for select using (public.eh_admin());
-- ninguém escreve direto: só os gatilhos, que rodam como dono

create or replace function public.anotar_log(
  p_acao text, p_alvo_tipo text, p_alvo_id uuid, p_detalhe text
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  quem text;
begin
  select nome into quem from public.perfis where id = auth.uid();

  insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
  values (auth.uid(), quem, p_acao, p_alvo_tipo, p_alvo_id, p_detalhe);
end;
$$;

grant execute on function public.anotar_log(text,text,uuid,text) to authenticated;


-- ------------------------------------------------------------
-- 4.3 Gatilhos: histórico, notificação e auditoria
-- ------------------------------------------------------------
create or replace function public.acompanhar_denuncia()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  texto  text;
  quem   text;
  rotulo text;
begin
  select nome into quem from public.perfis where id = auth.uid();

  if new.status is distinct from old.status then
    new.admin_id := coalesce(auth.uid(), new.admin_id);

    if new.status = 'resolvida' then
      new.resolvida_em  := now();
      new.prazo_recurso := now() + interval '7 days';
    end if;

    rotulo := case new.status
      when 'em_analise'      then 'Em análise'
      when 'aguardando_info' then 'Aguardando informações'
      when 'resolvida'       then 'Resolvida'
      when 'arquivada'       then 'Arquivada'
      else 'Recebida'
    end;

    insert into public.denuncia_historico (denuncia_id, ator_id, ator_nome, acao, detalhe)
    values (new.id, auth.uid(), quem, 'status', 'Passou para: ' || rotulo);

    insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
    values (auth.uid(), quem, 'denuncia_status', 'denuncia', new.id,
            'Denúncia #' || new.numero || ' → ' || rotulo);

    texto := case new.status
      when 'em_analise'      then 'Sua denúncia está sendo analisada pela moderação.'
      when 'aguardando_info' then 'A moderação precisa de mais informações sobre sua denúncia.'
      when 'resolvida'       then 'Sua denúncia foi analisada e resolvida. Você tem 7 dias para consultar o resultado e enviar um recurso.'
      when 'arquivada'       then 'Sua denúncia foi arquivada.'
      else 'Sua denúncia foi recebida e entrou na fila de análise.'
    end;

    if new.resposta is not null and length(trim(new.resposta)) > 0 then
      texto := texto || ' Resposta da moderação: ' || new.resposta;
    end if;

    if new.usuario_id is not null then
      insert into public.notificacoes (usuario_id, titulo, mensagem, denuncia_id)
      values (new.usuario_id, 'Denúncia nº ' || new.numero, texto, new.id);
    end if;
  end if;

  if new.medida is distinct from old.medida and new.medida is not null then
    insert into public.denuncia_historico (denuncia_id, ator_id, ator_nome, acao, detalhe)
    values (new.id, auth.uid(), quem, 'medida', 'Medida aplicada: ' || new.medida);
  end if;

  if new.decisao is distinct from old.decisao and new.decisao is not null then
    insert into public.denuncia_historico (denuncia_id, ator_id, ator_nome, acao, detalhe)
    values (new.id, auth.uid(), quem, 'decisao', 'Decisão: ' || new.decisao);
  end if;

  if new.recurso_texto is distinct from old.recurso_texto and new.recurso_texto is not null then
    new.recurso_em := now();
    insert into public.denuncia_historico (denuncia_id, ator_id, ator_nome, acao, detalhe)
    values (new.id, auth.uid(), quem, 'recurso', new.recurso_texto);
  end if;

  return new;
end;
$$;

drop trigger if exists ao_mudar_status_denuncia on public.denuncias;
drop trigger if exists ao_acompanhar_denuncia   on public.denuncias;
create trigger ao_acompanhar_denuncia
  before update on public.denuncias
  for each row execute function public.acompanhar_denuncia();


-- abertura da denúncia: retrato do autor, histórico e aviso de recebida
create or replace function public.abrir_denuncia()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quem text;
begin
  select nome into quem from public.perfis where id = new.usuario_id;
  new.autor_apelido := quem;

  insert into public.denuncia_historico (denuncia_id, ator_id, ator_nome, acao, detalhe)
  values (new.id, new.usuario_id, quem, 'abertura', 'Denúncia registrada');

  if new.usuario_id is not null then
    insert into public.notificacoes (usuario_id, titulo, mensagem, denuncia_id)
    values (new.usuario_id, 'Denúncia nº ' || new.numero,
            'Recebemos sua denúncia. Você será avisado a cada mudança.', new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists ao_abrir_denuncia on public.denuncias;
create trigger ao_abrir_denuncia
  after insert on public.denuncias
  for each row execute function public.abrir_denuncia();


-- auditoria automática de eventos e contas
create or replace function public.auditar_evento()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quem text;
begin
  if not public.eh_admin() then return coalesce(new, old); end if;
  select nome into quem from public.perfis where id = auth.uid();

  if tg_op = 'DELETE' then
    insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
    values (auth.uid(), quem, 'evento_excluido', 'evento', old.id, old.nome);
    return old;
  end if;

  if new.ativo is distinct from old.ativo then
    insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
    values (auth.uid(), quem,
            case when new.ativo then 'evento_republicado' else 'evento_ocultado' end,
            'evento', new.id, new.nome);
  end if;
  return new;
end;
$$;

drop trigger if exists auditar_evento_trg on public.eventos;
create trigger auditar_evento_trg
  after update or delete on public.eventos
  for each row execute function public.auditar_evento();

create or replace function public.auditar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  quem text;
begin
  if not public.eh_admin() or auth.uid() = new.id then return new; end if;
  select nome into quem from public.perfis where id = auth.uid();

  if new.bloqueado is distinct from old.bloqueado then
    insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
    values (auth.uid(), quem,
            case when new.bloqueado then 'conta_banida' else 'conta_liberada' end,
            'usuario', new.id, new.nome);
  end if;

  if new.papel is distinct from old.papel then
    insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
    values (auth.uid(), quem, 'papel_alterado', 'usuario', new.id, new.nome || ' → ' || new.papel);
  end if;

  if new.suspenso_ate is distinct from old.suspenso_ate and new.suspenso_ate is not null then
    insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
    values (auth.uid(), quem, 'conta_suspensa', 'usuario', new.id,
            new.nome || ' até ' || to_char(new.suspenso_ate, 'DD/MM/YYYY'));
  end if;

  return new;
end;
$$;

drop trigger if exists auditar_perfil_trg on public.perfis;
create trigger auditar_perfil_trg
  after update on public.perfis
  for each row execute function public.auditar_perfil();


-- ============================================================
-- 5. MEDIDAS DISCIPLINARES
-- Uma função só, para o painel aplicar a punição escolhida.
-- ============================================================
create or replace function public.aplicar_medida(
  p_denuncia uuid, p_medida text, p_dias int default 7
) returns void
language plpgsql
security definer set search_path = public
as $$
declare
  d public.denuncias;
  quem text;
begin
  if not public.eh_admin() then
    raise exception 'Apenas administradores aplicam medidas';
  end if;

  select * into d from public.denuncias where id = p_denuncia;
  if not found then raise exception 'Denúncia não encontrada'; end if;
  select nome into quem from public.perfis where id = auth.uid();

  if p_medida = 'remocao' and d.evento_id is not null then
    update public.eventos set ativo = false where id = d.evento_id;

  elsif p_medida = 'advertencia' and d.denunciado_id is not null then
    update public.perfis set advertencias = advertencias + 1 where id = d.denunciado_id;
    insert into public.notificacoes (usuario_id, titulo, mensagem)
    values (d.denunciado_id, 'Advertência da moderação',
            'Uma publicação sua foi denunciada e a moderação registrou uma advertência. Reveja as regras de convivência.');

  elsif p_medida = 'suspensao' and d.denunciado_id is not null then
    update public.perfis set suspenso_ate = now() + (p_dias || ' days')::interval
     where id = d.denunciado_id;
    insert into public.notificacoes (usuario_id, titulo, mensagem)
    values (d.denunciado_id, 'Conta suspensa',
            'Sua conta ficará suspensa por ' || p_dias || ' dia(s) por descumprimento das regras.');

  elsif p_medida = 'banimento' and d.denunciado_id is not null then
    update public.perfis set bloqueado = true where id = d.denunciado_id;
  end if;

  update public.denuncias set medida = p_medida where id = p_denuncia;

  insert into public.log_admin (admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe)
  values (auth.uid(), quem, 'medida_' || p_medida, 'denuncia', p_denuncia,
          'Denúncia #' || d.numero);
end;
$$;

grant execute on function public.aplicar_medida(uuid,text,int) to authenticated;


-- ============================================================
-- 6. ARQUIVAMENTO AUTOMÁTICO (não exclusão)
--
-- Passados 7 dias da resolução, a denúncia sai da fila ativa
-- mas continua no sistema. Reincidência precisa de memória.
-- ============================================================
drop function if exists public.limpar_denuncias_antigas();

create or replace function public.arquivar_denuncias_vencidas()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  total integer;
begin
  update public.denuncias
     set status = 'arquivada'
   where status = 'resolvida'
     and prazo_recurso is not null
     and prazo_recurso < now();

  get diagnostics total = row_count;
  return total;
end;
$$;

grant execute on function public.arquivar_denuncias_vencidas() to authenticated;

-- Opcional, com pg_cron:
--   select cron.schedule('rotinas-diarias', '0 3 * * *', $$
--     select public.arquivar_denuncias_vencidas();
--     select public.processar_exclusoes_vencidas();
--   $$);


-- ============================================================
-- 7. VIEW DO PAINEL
-- ============================================================
drop view if exists public.denuncias_lista;

create view public.denuncias_lista
with (security_invoker = true) as
select
  d.id, d.numero, d.evento_id, d.usuario_id, d.denunciado_id, d.admin_id,
  d.categoria, d.motivo, d.descricao, d.status, d.decisao, d.medida,
  d.resposta, d.evidencia_url, d.alvo_tipo,
  d.criado_em, d.resolvida_em, d.prazo_recurso, d.recurso_texto, d.recurso_em,
  e.nome  as evento_nome,
  e.ativo as evento_ativo,
  coalesce(p.nome, d.autor_apelido, 'conta removida') as autor_nome,
  dn.nome as denunciado_nome,
  ad.nome as admin_nome,
  case
    when d.status = 'resolvida' and d.prazo_recurso is not null
    then greatest(0, ceil(extract(epoch from (d.prazo_recurso - now())) / 86400))::int
  end as dias_de_prazo,
  (d.status in ('recebida','em_analise','aguardando_info')
   and d.criado_em < now() - interval '3 days') as urgente
from public.denuncias d
left join public.eventos e  on e.id  = d.evento_id
left join public.perfis  p  on p.id  = d.usuario_id
left join public.perfis  dn on dn.id = d.denunciado_id
left join public.perfis  ad on ad.id = d.admin_id;

grant select on public.denuncias_lista to authenticated;


-- ============================================================
-- 8. EVIDÊNCIAS (anexos das denúncias)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('denuncias', 'denuncias', true)
on conflict (id) do nothing;

drop policy if exists evid_enviar on storage.objects;
create policy evid_enviar on storage.objects
  for insert to authenticated with check (bucket_id = 'denuncias');

drop policy if exists evid_ver on storage.objects;
create policy evid_ver on storage.objects
  for select using (bucket_id = 'denuncias');


-- ============================================================
-- 9. PERMISSÕES DAS FUNÇÕES USADAS PELAS POLÍTICAS
-- ============================================================
grant execute on function public.eh_admin() to anon, authenticated;
grant select on public.eventos_lista     to anon, authenticated;
grant select on public.comentarios_lista to anon, authenticated;


-- ============================================================
-- 10. CONFERÊNCIA
-- ============================================================
select status, count(*) from public.denuncias group by status order by 1;