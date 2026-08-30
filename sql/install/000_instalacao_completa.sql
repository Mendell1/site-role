-- ============================================================
-- ROLÊ — INSTALAÇÃO COMPLETA DO BANCO (snapshot atual até V22)
-- Para um projeto Supabase NOVO, rode APENAS este arquivo.
-- Depois dele, siga o README para publicar a Edge Function de manutenção e configurar o Cron de Storage.
-- ============================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;

-- ============================================================
-- TABELAS
-- ============================================================
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  papel text not null default 'usuario' check (papel in ('usuario','admin')),
  bloqueado boolean not null default false,
  criado_em timestamptz not null default now(),
  foto_url text,
  bio text,
  data_nascimento date,
  cidade text,
  contato text,
  atualizado_em timestamptz not null default now(),
  aceitou_regras boolean not null default false,
  regras_aceitas_em timestamptz,
  termos_versao text,
  termos_aceitos_em timestamptz,
  suspenso_ate timestamptz,
  advertencias int not null default 0,
  exclusao_pedida_em timestamptz,
  exclusao_prevista timestamptz,
  constraint perfis_bio_tamanho check (bio is null or char_length(bio) <= 300)
);

create table if not exists public.categorias (
  id text primary key,
  nome text not null,
  emoji text,
  ordem int not null default 0
);

insert into public.categorias(id,nome,emoji,ordem) values
 ('festas','Festas','🎉',1),
 ('games','Games','🎮',2),
 ('esportes','Esportes','⚽',3),
 ('educacao','Educação','📚',4),
 ('cultura','Cultura','🎭',5),
 ('gastronomia','Gastronomia','🍔',6),
 ('musica','Música','🎵',7),
 ('social','Social','🤝',8),
 ('profissional','Profissional','💼',9),
 ('feiras','Feiras','🛍️',10),
 ('outros','Outros','📌',11)
on conflict (id) do update set nome=excluded.nome, emoji=excluded.emoji, ordem=excluded.ordem;

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  criador_id uuid not null references public.perfis(id) on delete cascade,
  nome text not null check (char_length(trim(nome)) >= 3),
  descricao text,
  categoria_id text not null references public.categorias(id),
  data_evento date not null,
  hora_evento time not null default '19:00',
  endereco text,
  bairro text,
  cidade text not null,
  gratuito boolean not null default true,
  valor numeric not null default 0,
  max_participantes int check (max_participantes is null or max_participantes > 0),
  contato text,
  imagem_url text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criador_nome text,
  total_interessados bigint not null default 0,
  latitude double precision,
  longitude double precision,
  numero text,
  complemento text,
  cep text,
  criador_foto text,
  constraint valor_coerente check ((gratuito=true and valor=0) or (gratuito=false and valor>0)),
  constraint eventos_latitude_valida check (latitude is null or latitude between -90 and 90),
  constraint eventos_longitude_valida check (longitude is null or longitude between -180 and 180)
);

create table if not exists public.favoritos (
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key(usuario_id,evento_id)
);

create table if not exists public.interesses (
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  evento_id uuid not null references public.eventos(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key(usuario_id,evento_id)
);

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  autor_id uuid not null references public.perfis(id) on delete cascade,
  texto text not null check (char_length(trim(texto)) between 1 and 1000),
  criado_em timestamptz not null default now(),
  editado_em timestamptz,
  autor_nome text,
  autor_foto text
);

create table if not exists public.denuncias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.eventos(id) on delete set null,
  usuario_id uuid references public.perfis(id) on delete set null,
  motivo text not null check (char_length(trim(motivo)) >= 3),
  descricao text,
  status text not null default 'recebida' check (status in ('recebida','em_analise','aguardando_info','resolvida','em_recurso','arquivada')),
  criado_em timestamptz not null default now(),
  numero bigint generated by default as identity,
  finalizada_em timestamptz,
  resposta text,
  categoria text,
  alvo_tipo text not null default 'evento' check (alvo_tipo in ('evento','comentario','usuario')),
  denunciado_id uuid references public.perfis(id) on delete set null,
  evidencia_url text,
  admin_id uuid references public.perfis(id) on delete set null,
  decisao text check (decisao is null or decisao in ('violacao_confirmada','sem_violacao','evidencia_insuficiente','duplicada')),
  medida text check (medida is null or medida in ('nenhuma','advertencia','remocao','suspensao','banimento')),
  resolvida_em timestamptz,
  prazo_recurso timestamptz,
  recurso_texto text,
  recurso_em timestamptz,
  autor_apelido text,
  info_solicitada text,
  info_resposta text,
  info_respondida_em timestamptz,
  recurso_decisao text check (recurso_decisao is null or recurso_decisao in ('aceito','negado')),
  recurso_resposta text,
  recurso_decidido_em timestamptz
);

create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  titulo text not null,
  mensagem text not null,
  denuncia_id uuid references public.denuncias(id) on delete cascade,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

create table if not exists public.denuncia_historico (
  id uuid primary key default gen_random_uuid(),
  denuncia_id uuid not null references public.denuncias(id) on delete cascade,
  ator_id uuid references public.perfis(id) on delete set null,
  ator_nome text,
  acao text not null,
  detalhe text,
  criado_em timestamptz not null default now()
);

create table if not exists public.log_admin (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.perfis(id) on delete set null,
  admin_nome text,
  acao text not null,
  alvo_tipo text,
  alvo_id uuid,
  detalhe text,
  criado_em timestamptz not null default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists eventos_categoria_idx on public.eventos(categoria_id);
create index if not exists eventos_cidade_idx on public.eventos(cidade);
create index if not exists eventos_criador_idx on public.eventos(criador_id);
create index if not exists eventos_data_hora_idx on public.eventos(data_evento,hora_evento);
create index if not exists eventos_localizacao_idx on public.eventos(latitude,longitude) where latitude is not null and longitude is not null;
create index if not exists eventos_nome_trgm_idx on public.eventos using gin(nome extensions.gin_trgm_ops);
create index if not exists eventos_descricao_trgm_idx on public.eventos using gin(descricao extensions.gin_trgm_ops);
create index if not exists favoritos_evento_idx on public.favoritos(evento_id);
create index if not exists interesses_evento_idx on public.interesses(evento_id);
create index if not exists comentarios_evento_idx on public.comentarios(evento_id,criado_em);
create unique index if not exists denuncias_numero_idx on public.denuncias(numero);
create index if not exists denuncias_evento_idx on public.denuncias(evento_id);
create index if not exists denuncias_usuario_idx on public.denuncias(usuario_id);
create index if not exists denuncias_status_idx on public.denuncias(status,criado_em desc);
create index if not exists denuncias_categoria_idx on public.denuncias(categoria);
create index if not exists denuncias_admin_idx on public.denuncias(admin_id);
create index if not exists notificacoes_usuario_idx on public.notificacoes(usuario_id,lida,criado_em desc);
create index if not exists den_hist_idx on public.denuncia_historico(denuncia_id,criado_em);
create index if not exists log_admin_idx on public.log_admin(criado_em desc);

-- ============================================================
-- HELPERS PRIVADOS
-- ============================================================
create or replace function private.conta_ativa()
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.perfis p
    where p.id=auth.uid() and p.bloqueado=false
      and (p.suspenso_ate is null or p.suspenso_ate<=now())
      and p.exclusao_prevista is null
  );
$$;

create or replace function private.eh_admin()
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.perfis p
    where p.id=auth.uid() and p.papel='admin' and p.bloqueado=false
      and (p.suspenso_ate is null or p.suspenso_ate<=now())
      and p.exclusao_prevista is null
  );
$$;

create or replace function public.idade_em_anos(nascimento date)
returns integer language sql stable set search_path=''
as $$ select extract(year from age(current_date,nascimento))::int; $$;

create or replace function public.validar_maioridade()
returns trigger language plpgsql set search_path=''
as $$
begin
  if tg_op='UPDATE' and old.data_nascimento is not null and new.data_nascimento is null then
    raise exception 'A data de nascimento não pode ser removida';
  end if;
  if new.data_nascimento is not null then
    if new.data_nascimento>current_date then raise exception 'Data de nascimento no futuro'; end if;
    if age(current_date,new.data_nascimento)<interval '18 years' then
      raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
    end if;
  end if;
  new.atualizado_em=now();
  return new;
end;
$$;

create or replace function public.criar_perfil()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  aceite boolean:=coalesce((new.raw_user_meta_data->>'aceitou_regras')::boolean,false);
  versao text:=coalesce(nullif(new.raw_user_meta_data->>'termos_versao',''),'1.0');
  nascimento date;
begin
  if not aceite then raise exception 'É necessário aceitar as regras de convivência'; end if;
  nascimento:=nullif(new.raw_user_meta_data->>'data_nascimento','')::date;
  if nascimento is null then raise exception 'Informe a data de nascimento'; end if;
  if nascimento>current_date or age(current_date,nascimento)<interval '18 years' then
    raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
  end if;
  insert into public.perfis(id,nome,email,data_nascimento,aceitou_regras,regras_aceitas_em,termos_versao,termos_aceitos_em)
  values(new.id,coalesce(nullif(new.raw_user_meta_data->>'nome',''),split_part(new.email,'@',1)),new.email,nascimento,true,now(),versao,now())
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users for each row execute function public.criar_perfil();

drop trigger if exists ao_salvar_perfil on public.perfis;
create trigger ao_salvar_perfil before insert or update on public.perfis for each row execute function public.validar_maioridade();

create or replace function public.tocar_atualizado_em()
returns trigger language plpgsql set search_path=''
as $$ begin new.atualizado_em=now(); return new; end; $$;

drop trigger if exists eventos_tocar_atualizado_em on public.eventos;
create trigger eventos_tocar_atualizado_em before update on public.eventos for each row execute function public.tocar_atualizado_em();

create or replace function public.preencher_criador_nome_evento()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  select p.nome,p.foto_url into new.criador_nome,new.criador_foto from public.perfis p where p.id=new.criador_id;
  if new.criador_nome is null then raise exception 'Perfil do criador não encontrado'; end if;
  return new;
end;
$$;

drop trigger if exists eventos_preencher_criador_nome on public.eventos;
create trigger eventos_preencher_criador_nome before insert or update of criador_id on public.eventos for each row execute function public.preencher_criador_nome_evento();

create or replace function public.atualizar_total_interessados()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='INSERT' then
    update public.eventos set total_interessados=total_interessados+1 where id=new.evento_id; return new;
  elsif tg_op='DELETE' then
    update public.eventos set total_interessados=greatest(0,total_interessados-1) where id=old.evento_id; return old;
  end if;
  return null;
end;
$$;

drop trigger if exists interesses_atualizar_total on public.interesses;
create trigger interesses_atualizar_total after insert or delete on public.interesses for each row execute function public.atualizar_total_interessados();

create or replace function private.preencher_autor_comentario()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  select p.nome,p.foto_url into new.autor_nome,new.autor_foto from public.perfis p where p.id=new.autor_id;
  if new.autor_nome is null then raise exception 'Perfil do autor não encontrado'; end if;
  return new;
end;
$$;

create or replace function public.marcar_edicao_comentario()
returns trigger language plpgsql set search_path=''
as $$ begin if new.texto is distinct from old.texto then new.editado_em=now(); end if; return new; end; $$;

drop trigger if exists comentarios_preencher_autor on public.comentarios;
create trigger comentarios_preencher_autor before insert or update of autor_id on public.comentarios for each row execute function private.preencher_autor_comentario();
drop trigger if exists ao_editar_comentario on public.comentarios;
create trigger ao_editar_comentario before update on public.comentarios for each row execute function public.marcar_edicao_comentario();

create or replace function private.sincronizar_perfil_publico()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.nome is distinct from old.nome or new.foto_url is distinct from old.foto_url then
    update public.eventos set criador_nome=new.nome,criador_foto=new.foto_url where criador_id=new.id;
    update public.comentarios set autor_nome=new.nome,autor_foto=new.foto_url where autor_id=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sincronizar_perfil_publico on public.perfis;
create trigger sincronizar_perfil_publico after update of nome,foto_url on public.perfis for each row execute function private.sincronizar_perfil_publico();

create or replace function private.proteger_campos_sistema_perfil()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid()=old.id and not private.eh_admin() then
    if new.papel is distinct from old.papel or new.bloqueado is distinct from old.bloqueado
       or new.email is distinct from old.email or new.id is distinct from old.id
       or new.criado_em is distinct from old.criado_em
       or new.aceitou_regras is distinct from old.aceitou_regras
       or new.regras_aceitas_em is distinct from old.regras_aceitas_em
       or new.termos_versao is distinct from old.termos_versao
       or new.termos_aceitos_em is distinct from old.termos_aceitos_em
       or new.suspenso_ate is distinct from old.suspenso_ate
       or new.advertencias is distinct from old.advertencias
       or new.exclusao_pedida_em is distinct from old.exclusao_pedida_em
       or new.exclusao_prevista is distinct from old.exclusao_prevista then
      raise exception 'Campos internos do perfil não podem ser alterados';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_campos_sistema_perfil on public.perfis;
create trigger proteger_campos_sistema_perfil before update on public.perfis for each row execute function private.proteger_campos_sistema_perfil();

create or replace function private.proteger_notificacao_usuario()
returns trigger language plpgsql set search_path=''
as $$
begin
  if auth.uid()=old.usuario_id then
    if new.id is distinct from old.id or new.usuario_id is distinct from old.usuario_id
       or new.titulo is distinct from old.titulo or new.mensagem is distinct from old.mensagem
       or new.denuncia_id is distinct from old.denuncia_id or new.criado_em is distinct from old.criado_em then
      raise exception 'Somente o estado de leitura pode ser alterado';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_notificacao_usuario on public.notificacoes;
create trigger proteger_notificacao_usuario before update on public.notificacoes for each row execute function private.proteger_notificacao_usuario();

-- ============================================================
-- DENÚNCIAS / HISTÓRICO / AUDITORIA
-- ============================================================
create or replace function private.preparar_denuncia()
returns trigger language plpgsql security definer set search_path=''
as $$ begin select p.nome into new.autor_apelido from public.perfis p where p.id=new.usuario_id; return new; end; $$;

drop trigger if exists preparar_denuncia on public.denuncias;
create trigger preparar_denuncia before insert on public.denuncias for each row execute function private.preparar_denuncia();

create or replace function private.registrar_abertura_denuncia()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
  values(new.id,new.usuario_id,new.autor_apelido,'abertura','Denúncia registrada');
  if new.usuario_id is not null then
    insert into public.notificacoes(usuario_id,titulo,mensagem,denuncia_id)
    values(new.usuario_id,'Denúncia nº '||new.numero,'Recebemos sua denúncia. Você será avisado a cada mudança.',new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ao_abrir_denuncia on public.denuncias;
create trigger ao_abrir_denuncia after insert on public.denuncias for each row execute function private.registrar_abertura_denuncia();

create or replace function private.proteger_recurso_denuncia()
returns trigger language plpgsql set search_path=''
as $$
declare eh_recurso boolean:=false; eh_info boolean:=false;
begin
  if private.eh_admin() then return new; end if;
  if auth.uid()=old.usuario_id then
    eh_recurso:=old.status='resolvida' and new.status='em_recurso' and old.recurso_texto is null and new.recurso_texto is not null and new.recurso_em is not null;
    eh_info:=old.status='aguardando_info' and new.status='em_analise' and new.info_resposta is not null and new.info_respondida_em is not null;
    if not eh_recurso and not eh_info then raise exception 'Alteração de denúncia não permitida'; end if;
    if new.id is distinct from old.id or new.numero is distinct from old.numero
       or new.evento_id is distinct from old.evento_id or new.usuario_id is distinct from old.usuario_id
       or new.motivo is distinct from old.motivo or new.descricao is distinct from old.descricao
       or new.resposta is distinct from old.resposta or new.criado_em is distinct from old.criado_em
       or new.finalizada_em is distinct from old.finalizada_em or new.categoria is distinct from old.categoria
       or new.alvo_tipo is distinct from old.alvo_tipo or new.denunciado_id is distinct from old.denunciado_id
       or new.evidencia_url is distinct from old.evidencia_url or new.admin_id is distinct from old.admin_id
       or new.decisao is distinct from old.decisao or new.medida is distinct from old.medida
       or new.resolvida_em is distinct from old.resolvida_em or new.autor_apelido is distinct from old.autor_apelido
       or new.recurso_decisao is distinct from old.recurso_decisao or new.recurso_resposta is distinct from old.recurso_resposta
       or new.recurso_decidido_em is distinct from old.recurso_decidido_em or new.info_solicitada is distinct from old.info_solicitada then
      raise exception 'Campos internos da denúncia não podem ser alterados';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteger_recurso_denuncia on public.denuncias;
create trigger proteger_recurso_denuncia before update on public.denuncias for each row execute function private.proteger_recurso_denuncia();

create or replace function private.acompanhar_denuncia()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  texto text; quem text; rotulo text; transicao_recurso boolean:=false; transicao_info boolean:=false;
begin
  select p.nome into quem from public.perfis p where p.id=auth.uid();
  transicao_recurso:=auth.uid()=old.usuario_id and old.status='resolvida' and new.status='em_recurso' and new.recurso_texto is not null;
  transicao_info:=auth.uid()=old.usuario_id and old.status='aguardando_info' and new.status='em_analise' and new.info_resposta is not null;

  if new.status is distinct from old.status then
    if transicao_recurso then
      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'recurso','Recurso enviado pelo denunciante');
    elsif transicao_info then
      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'informacoes','Informações adicionais enviadas pelo denunciante');
    else
      if not private.eh_admin() then raise exception 'Apenas administradores podem alterar o status'; end if;
      new.admin_id:=coalesce(auth.uid(),new.admin_id);
      if new.status='resolvida' then
        new.resolvida_em:=now();
        if old.status='em_recurso' and new.recurso_decisao='negado' then new.prazo_recurso:=now();
        elsif new.recurso_texto is null then new.prazo_recurso:=now()+interval '7 days'; end if;
      elsif new.status in ('em_analise','aguardando_info') and old.status='em_recurso' then new.prazo_recurso:=null;
      end if;
      rotulo:=case new.status when 'em_analise' then 'Em análise' when 'aguardando_info' then 'Aguardando informações'
        when 'resolvida' then 'Resolvida' when 'em_recurso' then 'Em recurso' when 'arquivada' then 'Arquivada' else 'Recebida' end;
      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'status','Passou para: '||rotulo);
      insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
      values(auth.uid(),quem,'denuncia_status','denuncia',new.id,'Denúncia #'||new.numero||' → '||rotulo);
      texto:=case new.status when 'em_analise' then 'Sua denúncia está sendo analisada pela moderação.'
        when 'aguardando_info' then 'A moderação precisa de mais informações sobre sua denúncia.'
        when 'resolvida' then case when new.recurso_texto is null then 'Sua denúncia foi analisada e resolvida. Você tem 7 dias para consultar o resultado e enviar um recurso.' else 'O recurso da sua denúncia foi analisado.' end
        when 'arquivada' then 'Sua denúncia foi arquivada.' else 'Sua denúncia foi recebida e entrou na fila de análise.' end;
      if new.info_solicitada is not null and new.status='aguardando_info' then texto:=texto||' Solicitação: '||trim(new.info_solicitada); end if;
      if new.resposta is not null and length(trim(new.resposta))>0 then texto:=texto||' Resposta da moderação: '||trim(new.resposta); end if;
      if new.usuario_id is not null then insert into public.notificacoes(usuario_id,titulo,mensagem,denuncia_id) values(new.usuario_id,'Denúncia nº '||new.numero,texto,new.id); end if;
    end if;
  end if;

  if new.medida is distinct from old.medida and new.medida is not null then
    if not private.eh_admin() then raise exception 'Apenas administradores podem aplicar medidas'; end if;
    insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe) values(new.id,auth.uid(),quem,'medida','Medida aplicada: '||new.medida);
  end if;
  if new.decisao is distinct from old.decisao and new.decisao is not null then
    if not private.eh_admin() then raise exception 'Apenas administradores podem registrar decisões'; end if;
    insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe) values(new.id,auth.uid(),quem,'decisao','Decisão: '||new.decisao);
  end if;
  return new;
end;
$$;

drop trigger if exists ao_acompanhar_denuncia on public.denuncias;
create trigger ao_acompanhar_denuncia before update on public.denuncias for each row execute function private.acompanhar_denuncia();

create or replace function private.auditar_evento()
returns trigger language plpgsql security definer set search_path=''
as $$
declare quem text;
begin
  if not private.eh_admin() then return coalesce(new,old); end if;
  select p.nome into quem from public.perfis p where p.id=auth.uid();
  if tg_op='DELETE' then
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe) values(auth.uid(),quem,'evento_excluido','evento',old.id,old.nome); return old;
  end if;
  if new.ativo is distinct from old.ativo then
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
    values(auth.uid(),quem,case when new.ativo then 'evento_republicado' else 'evento_ocultado' end,'evento',new.id,new.nome);
  end if;
  return new;
end;
$$;

drop trigger if exists auditar_evento_trg on public.eventos;
create trigger auditar_evento_trg after update or delete on public.eventos for each row execute function private.auditar_evento();

create or replace function private.auditar_perfil()
returns trigger language plpgsql security definer set search_path=''
as $$
declare quem text;
begin
  if not private.eh_admin() or auth.uid()=new.id then return new; end if;
  select p.nome into quem from public.perfis p where p.id=auth.uid();
  if new.bloqueado is distinct from old.bloqueado then
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
    values(auth.uid(),quem,case when new.bloqueado then 'conta_banida' else 'conta_liberada' end,'usuario',new.id,new.nome);
  end if;
  if new.papel is distinct from old.papel then
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe) values(auth.uid(),quem,'papel_alterado','usuario',new.id,new.nome||' → '||new.papel);
  end if;
  if new.suspenso_ate is distinct from old.suspenso_ate and new.suspenso_ate is not null then
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe) values(auth.uid(),quem,'conta_suspensa','usuario',new.id,new.nome||' até '||to_char(new.suspenso_ate,'DD/MM/YYYY'));
  end if;
  return new;
end;
$$;

drop trigger if exists auditar_perfil_trg on public.perfis;
create trigger auditar_perfil_trg after update on public.perfis for each row execute function private.auditar_perfil();

-- ============================================================
-- RPCs DE CONTA / ADMIN / LOGIN / DENÚNCIA
-- ============================================================
create or replace function public.solicitar_exclusao_conta()
returns timestamptz language plpgsql security definer set search_path=''
as $$ declare eu uuid:=auth.uid(); prazo timestamptz:=now()+interval '7 days'; begin if eu is null then raise exception 'Nenhuma sessão ativa'; end if; update public.perfis set exclusao_pedida_em=now(),exclusao_prevista=prazo where id=eu; return prazo; end; $$;

create or replace function public.cancelar_exclusao_conta()
returns void language plpgsql security definer set search_path=''
as $$ declare eu uuid:=auth.uid(); begin if eu is null then raise exception 'Nenhuma sessão ativa'; end if; update public.perfis set exclusao_pedida_em=null,exclusao_prevista=null where id=eu; end; $$;

create or replace function public.admin_definir_bloqueio(p_usuario uuid,p_bloqueado boolean)
returns void language plpgsql security definer set search_path=''
as $$ begin if not private.eh_admin() then raise exception 'Apenas administradores podem alterar bloqueios'; end if; if p_usuario is null or p_usuario=auth.uid() then raise exception 'Operação inválida para esta conta'; end if; update public.perfis set bloqueado=coalesce(p_bloqueado,false) where id=p_usuario; if not found then raise exception 'Conta não encontrada'; end if; end; $$;

create or replace function public.admin_definir_papel(p_usuario uuid,p_papel text)
returns void language plpgsql security definer set search_path=''
as $$
declare alvo public.perfis; outros_admins int;
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem alterar permissões'; end if;
  if p_papel not in ('usuario','admin') then raise exception 'Papel inválido'; end if;
  if p_usuario is null or p_usuario=auth.uid() then raise exception 'Você não pode alterar seu próprio papel pelo painel'; end if;
  select * into alvo from public.perfis where id=p_usuario; if not found then raise exception 'Conta não encontrada'; end if;
  if alvo.papel='admin' and p_papel='usuario' then
    select count(*)::int into outros_admins from public.perfis p where p.papel='admin' and p.id<>p_usuario and p.bloqueado=false and (p.suspenso_ate is null or p.suspenso_ate<=now()) and p.exclusao_prevista is null;
    if outros_admins<1 then raise exception 'Não é possível remover o último administrador ativo'; end if;
  end if;
  update public.perfis set papel=p_papel where id=p_usuario;
end;
$$;

create or replace function public.admin_excluir_conta(p_usuario uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare alvo public.perfis; admin_nome text; outros_admins int;
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  if not private.eh_admin() then raise exception 'Apenas administradores podem excluir contas'; end if;
  if p_usuario is null or p_usuario=auth.uid() then raise exception 'Você não pode excluir sua própria conta pelo painel administrativo'; end if;
  select * into alvo from public.perfis where id=p_usuario; if not found then raise exception 'Conta não encontrada'; end if;
  if alvo.papel='admin' then
    select count(*)::int into outros_admins from public.perfis p where p.papel='admin' and p.id<>p_usuario and p.bloqueado=false and (p.suspenso_ate is null or p.suspenso_ate<=now()) and p.exclusao_prevista is null;
    if outros_admins<1 then raise exception 'Não é possível excluir o último administrador ativo'; end if;
  end if;
  select p.nome into admin_nome from public.perfis p where p.id=auth.uid();
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe) values(auth.uid(),admin_nome,'conta_excluida','usuario',alvo.id,coalesce(alvo.nome,'usuário')||' · '||coalesce(alvo.email,'sem e-mail'));
  delete from auth.users where id=p_usuario; if not found then raise exception 'Não foi possível excluir a conta de autenticação'; end if;
  return jsonb_build_object('ok',true,'usuario_id',p_usuario,'nome',alvo.nome,'email',alvo.email);
end;
$$;

create or replace function public.enviar_recurso_denuncia(p_denuncia uuid,p_texto text)
returns void language plpgsql security definer set search_path=''
as $$
declare d public.denuncias; texto text:=trim(coalesce(p_texto,''));
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  if char_length(texto)<10 or char_length(texto)>1500 then raise exception 'O recurso deve ter entre 10 e 1500 caracteres'; end if;
  select * into d from public.denuncias where id=p_denuncia for update;
  if not found or d.usuario_id is distinct from auth.uid() then raise exception 'Denúncia não encontrada'; end if;
  if d.status<>'resolvida' then raise exception 'Esta denúncia não aceita recurso agora'; end if;
  if d.prazo_recurso is null or d.prazo_recurso<=now() then raise exception 'Prazo de recurso encerrado'; end if;
  if d.recurso_texto is not null then raise exception 'O recurso já foi enviado'; end if;
  update public.denuncias set recurso_texto=texto,recurso_em=now(),recurso_decisao=null,recurso_resposta=null,recurso_decidido_em=null,status='em_recurso' where id=p_denuncia;
end;
$$;

create or replace function public.enviar_informacoes_denuncia(p_denuncia uuid,p_texto text)
returns void language plpgsql security definer set search_path=''
as $$
declare d public.denuncias; texto text:=trim(coalesce(p_texto,''));
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  if char_length(texto)<5 or char_length(texto)>2000 then raise exception 'A resposta deve ter entre 5 e 2000 caracteres'; end if;
  select * into d from public.denuncias where id=p_denuncia for update;
  if not found or d.usuario_id is distinct from auth.uid() then raise exception 'Denúncia não encontrada'; end if;
  if d.status<>'aguardando_info' then raise exception 'A moderação não está aguardando informações nesta denúncia'; end if;
  update public.denuncias set info_resposta=texto,info_respondida_em=now(),status='em_analise' where id=p_denuncia;
end;
$$;

create or replace function public.admin_decidir_recurso(p_denuncia uuid,p_decisao text,p_resposta text default null)
returns void language plpgsql security definer set search_path=''
as $$
declare d public.denuncias; resp text:=nullif(trim(coalesce(p_resposta,'')),'');
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem decidir recursos'; end if;
  if p_decisao not in ('aceito','negado') then raise exception 'Decisão de recurso inválida'; end if;
  select * into d from public.denuncias where id=p_denuncia for update; if not found or d.status<>'em_recurso' then raise exception 'Recurso não encontrado ou já analisado'; end if;
  update public.denuncias set recurso_decisao=p_decisao,recurso_resposta=resp,recurso_decidido_em=now(),status=case when p_decisao='aceito' then 'em_analise' else 'resolvida' end,prazo_recurso=case when p_decisao='negado' then now() else null end where id=p_denuncia;
  if d.usuario_id is not null then insert into public.notificacoes(usuario_id,titulo,mensagem,denuncia_id) values(d.usuario_id,'Recurso da denúncia nº '||d.numero,case when p_decisao='aceito' then 'Seu recurso foi aceito e a denúncia voltou para análise.' else 'Seu recurso foi analisado e a decisão anterior foi mantida.' end||case when resp is not null then ' Resposta: '||resp else '' end,d.id); end if;
end;
$$;

create or replace function public.aplicar_medida(p_denuncia uuid,p_medida text,p_dias int default 7)
returns void language plpgsql security definer set search_path=''
as $$
declare d public.denuncias; quem text;
begin
  if not private.eh_admin() then raise exception 'Apenas administradores aplicam medidas'; end if;
  if p_medida not in ('nenhuma','advertencia','remocao','suspensao','banimento') then raise exception 'Medida inválida'; end if;
  select * into d from public.denuncias where id=p_denuncia; if not found then raise exception 'Denúncia não encontrada'; end if;
  select p.nome into quem from public.perfis p where p.id=auth.uid();
  if p_medida='remocao' and d.evento_id is not null then update public.eventos set ativo=false where id=d.evento_id;
  elsif p_medida='advertencia' and d.denunciado_id is not null then
    update public.perfis set advertencias=advertencias+1 where id=d.denunciado_id;
    insert into public.notificacoes(usuario_id,titulo,mensagem) values(d.denunciado_id,'Advertência da moderação','Uma publicação sua foi denunciada e a moderação registrou uma advertência. Reveja as regras de convivência.');
  elsif p_medida='suspensao' and d.denunciado_id is not null then
    update public.perfis set suspenso_ate=now()+(greatest(1,p_dias)||' days')::interval where id=d.denunciado_id;
    insert into public.notificacoes(usuario_id,titulo,mensagem) values(d.denunciado_id,'Conta suspensa','Sua conta ficará suspensa por '||greatest(1,p_dias)||' dia(s) por descumprimento das regras.');
  elsif p_medida='banimento' and d.denunciado_id is not null then update public.perfis set bloqueado=true where id=d.denunciado_id;
  end if;
  update public.denuncias set medida=p_medida where id=p_denuncia;
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe) values(auth.uid(),quem,'medida_'||p_medida,'denuncia',p_denuncia,'Denúncia #'||d.numero);
end;
$$;

-- ============================================================
-- CRON
-- ============================================================
create or replace function private.arquivar_denuncias_vencidas_job()
returns integer language plpgsql security definer set search_path=''
as $$ declare total int; begin update public.denuncias set status='arquivada' where status='resolvida' and prazo_recurso is not null and prazo_recurso<=now(); get diagnostics total=row_count; return total; end; $$;

create or replace function private.rotina_manutencao_role()
returns void language plpgsql security definer set search_path=''
as $$ begin perform private.arquivar_denuncias_vencidas_job(); end; $$;

create or replace function public.arquivar_denuncias_vencidas()
returns integer language plpgsql security definer set search_path=''
as $$ begin if not private.eh_admin() then raise exception 'Apenas administradores podem arquivar denúncias por prazo'; end if; return private.arquivar_denuncias_vencidas_job(); end; $$;

do $$ begin if exists(select 1 from cron.job where jobname='role_manutencao_diaria') then perform cron.unschedule('role_manutencao_diaria'); end if; end $$;
select cron.schedule('role_manutencao_diaria','15 3 * * *',$cron$select private.rotina_manutencao_role();$cron$);

-- ============================================================
-- RLS
-- ============================================================
alter table public.perfis enable row level security;
alter table public.categorias enable row level security;
alter table public.eventos enable row level security;
alter table public.favoritos enable row level security;
alter table public.interesses enable row level security;
alter table public.comentarios enable row level security;
alter table public.denuncias enable row level security;
alter table public.notificacoes enable row level security;
alter table public.denuncia_historico enable row level security;
alter table public.log_admin enable row level security;

create policy categorias_leitura_publica on public.categorias for select to anon,authenticated using(true);
create policy perfil_select_proprio on public.perfis for select to authenticated using(auth.uid()=id);
create policy perfil_update_proprio on public.perfis for update to authenticated using(auth.uid()=id and private.conta_ativa()) with check(auth.uid()=id and private.conta_ativa());
create policy admin_select_perfis on public.perfis for select to authenticated using(private.eh_admin());
create policy admin_update_perfis on public.perfis for update to authenticated using(private.eh_admin()) with check(private.eh_admin());

create policy eventos_leitura_publica on public.eventos for select to anon,authenticated using(ativo=true);
create policy eventos_criar_proprio on public.eventos for insert to authenticated with check(auth.uid()=criador_id and private.conta_ativa());
create policy eventos_editar_proprio on public.eventos for update to authenticated using(auth.uid()=criador_id and private.conta_ativa()) with check(auth.uid()=criador_id and private.conta_ativa());
create policy eventos_excluir_proprio on public.eventos for delete to authenticated using(auth.uid()=criador_id and private.conta_ativa());
create policy admin_select_eventos on public.eventos for select to authenticated using(private.eh_admin());
create policy admin_update_eventos on public.eventos for update to authenticated using(private.eh_admin()) with check(private.eh_admin());
create policy admin_delete_eventos on public.eventos for delete to authenticated using(private.eh_admin());

create policy favoritos_select_proprio on public.favoritos for select to authenticated using(auth.uid()=usuario_id);
create policy favoritos_insert_proprio on public.favoritos for insert to authenticated with check(auth.uid()=usuario_id and private.conta_ativa());
create policy favoritos_delete_proprio on public.favoritos for delete to authenticated using(auth.uid()=usuario_id and private.conta_ativa());

create policy interesses_select_proprio on public.interesses for select to authenticated using(auth.uid()=usuario_id);
create policy interesses_insert_proprio on public.interesses for insert to authenticated with check(auth.uid()=usuario_id and private.conta_ativa());
create policy interesses_delete_proprio on public.interesses for delete to authenticated using(auth.uid()=usuario_id and private.conta_ativa());

create policy coment_ler_publico on public.comentarios for select to anon,authenticated using(exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.ativo=true));
create policy coment_criar on public.comentarios for insert to authenticated with check(auth.uid()=autor_id and private.conta_ativa() and exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.ativo=true));
create policy coment_editar on public.comentarios for update to authenticated using(auth.uid()=autor_id and private.conta_ativa()) with check(auth.uid()=autor_id and private.conta_ativa());
create policy coment_apagar on public.comentarios for delete to authenticated using(private.conta_ativa() and (auth.uid()=autor_id or exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.criador_id=auth.uid())));
create policy coment_admin on public.comentarios for all to authenticated using(private.eh_admin()) with check(private.eh_admin());

create policy usuario_cria_denuncia on public.denuncias for insert to authenticated with check(auth.uid()=usuario_id and private.conta_ativa() and evento_id is not null and exists(select 1 from public.eventos e where e.id=denuncias.evento_id and e.ativo=true and e.criador_id<>auth.uid()));
create policy den_ler_proprias on public.denuncias for select to authenticated using(auth.uid()=usuario_id);
create policy admin_select_denuncias on public.denuncias for select to authenticated using(private.eh_admin());
create policy admin_update_denuncias on public.denuncias for update to authenticated using(private.eh_admin()) with check(private.eh_admin());
create policy admin_delete_denuncias on public.denuncias for delete to authenticated using(private.eh_admin());

create policy notif_ler on public.notificacoes for select to authenticated using(auth.uid()=usuario_id);
create policy notif_marcar on public.notificacoes for update to authenticated using(auth.uid()=usuario_id) with check(auth.uid()=usuario_id);
create policy notif_apagar on public.notificacoes for delete to authenticated using(auth.uid()=usuario_id);

create policy hist_admin on public.denuncia_historico for all to authenticated using(private.eh_admin()) with check(private.eh_admin());
create policy hist_autor on public.denuncia_historico for select to authenticated using(exists(select 1 from public.denuncias d where d.id=denuncia_historico.denuncia_id and d.usuario_id=auth.uid()));
create policy log_ler on public.log_admin for select to authenticated using(private.eh_admin());

-- ============================================================
-- VIEWS
-- ============================================================
create or replace view public.eventos_lista with (security_invoker=true) as
select e.id,e.criador_id,e.nome,e.descricao,e.categoria_id,c.nome as categoria_nome,c.emoji as categoria_emoji,
  e.data_evento,e.hora_evento,e.endereco,e.bairro,e.cidade,e.gratuito,e.valor,e.max_participantes,e.contato,e.imagem_url,e.ativo,
  e.criador_nome,e.total_interessados,e.latitude,e.longitude,e.numero,e.complemento,e.cep,e.criador_foto,
  (select count(*) from public.comentarios co where co.evento_id=e.id) as total_comentarios,
  (e.data_evento=current_date) as e_hoje
from public.eventos e join public.categorias c on c.id=e.categoria_id where e.ativo=true;

create or replace view public.comentarios_lista with (security_invoker=true) as
select id,evento_id,autor_id,texto,criado_em,editado_em,autor_nome,autor_foto from public.comentarios;

create or replace view public.denuncias_lista with (security_invoker=true) as
select d.id,d.numero,d.evento_id,d.usuario_id,d.denunciado_id,d.admin_id,d.categoria,d.motivo,d.descricao,d.status,d.decisao,d.medida,d.resposta,d.evidencia_url,d.alvo_tipo,
  d.criado_em,d.resolvida_em,d.prazo_recurso,d.recurso_texto,d.recurso_em,d.info_solicitada,d.info_resposta,d.info_respondida_em,d.recurso_decisao,d.recurso_resposta,d.recurso_decidido_em,
  e.nome as evento_nome,e.ativo as evento_ativo,coalesce(p.nome,d.autor_apelido,'conta removida') as autor_nome,dn.nome as denunciado_nome,ad.nome as admin_nome,
  case when d.status='resolvida' and d.prazo_recurso is not null then greatest(0,ceil(extract(epoch from (d.prazo_recurso-now()))/86400))::int else null end as dias_de_prazo,
  (d.status in ('recebida','em_analise','aguardando_info','em_recurso') and d.criado_em<now()-interval '3 days') as urgente
from public.denuncias d
left join public.eventos e on e.id=d.evento_id
left join public.perfis p on p.id=d.usuario_id
left join public.perfis dn on dn.id=d.denunciado_id
left join public.perfis ad on ad.id=d.admin_id;

-- ============================================================
-- STORAGE
-- ============================================================
insert into storage.buckets(id,name,public,file_size_limit) values('eventos','eventos',true,5242880) on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit;
insert into storage.buckets(id,name,public,file_size_limit) values('avatares','avatares',true,3145728) on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('denuncias','denuncias',false,5242880,array['image/jpeg','image/png','image/webp']::text[]) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy eventos_storage_leitura_publica on storage.objects for select using(bucket_id='eventos');
create policy eventos_storage_upload_proprio on storage.objects for insert to authenticated with check(bucket_id='eventos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy eventos_storage_update_proprio on storage.objects for update to authenticated using(bucket_id='eventos' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='eventos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy eventos_storage_delete_proprio on storage.objects for delete to authenticated using(bucket_id='eventos' and (storage.foldername(name))[1]=auth.uid()::text);

create policy avatar_ver on storage.objects for select using(bucket_id='avatares');
create policy avatar_enviar on storage.objects for insert to authenticated with check(bucket_id='avatares' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_trocar on storage.objects for update to authenticated using(bucket_id='avatares' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatares' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatar_apagar on storage.objects for delete to authenticated using(bucket_id='avatares' and (storage.foldername(name))[1]=auth.uid()::text);

create policy evid_enviar on storage.objects for insert to authenticated with check(bucket_id='denuncias' and (storage.foldername(name))[1]=auth.uid()::text and private.conta_ativa());
create policy evid_admin_ver on storage.objects for select to authenticated using(bucket_id='denuncias' and private.eh_admin());
create policy evid_dono_ver on storage.objects for select to authenticated using(bucket_id='denuncias' and (storage.foldername(name))[1]=auth.uid()::text);

-- ============================================================
-- PRIVILÉGIOS
-- ============================================================
-- Segurança por duas camadas: privilégios SQL + RLS.
grant usage on schema public to anon, authenticated;
grant usage on schema private to authenticated;

-- Leitura pública necessária para as views security_invoker.
grant select on public.categorias, public.eventos, public.comentarios to anon;
grant select on public.eventos_lista, public.comentarios_lista to anon;

-- Usuários autenticados recebem apenas as operações usadas pelo aplicativo;
-- as políticas RLS continuam decidindo quais linhas cada pessoa pode acessar.
grant select on public.perfis, public.categorias, public.eventos,
  public.favoritos, public.interesses, public.comentarios, public.denuncias,
  public.notificacoes, public.denuncia_historico, public.log_admin to authenticated;

grant insert, update, delete on public.eventos to authenticated;
grant insert, delete on public.favoritos to authenticated;
grant insert, delete on public.interesses to authenticated;
grant insert, update, delete on public.comentarios to authenticated;
grant insert, update, delete on public.denuncias to authenticated;
grant update, delete on public.notificacoes to authenticated;
grant select on public.eventos_lista, public.comentarios_lista, public.denuncias_lista to authenticated;
grant usage, select on sequence public.denuncias_numero_seq to authenticated;

-- Perfil: um usuário comum só pode alterar estas colunas.
revoke update on public.perfis from anon, authenticated;
grant update(nome, foto_url, bio, data_nascimento, cidade, contato)
on public.perfis to authenticated;

-- Tentativas de login nunca têm acesso direto por tabela.

-- Funções privadas são internas. Somente os dois helpers usados por RLS
-- precisam ser executáveis pela sessão autenticada.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.conta_ativa() to authenticated;
grant execute on function private.eh_admin() to authenticated;

-- Funções públicas são criadas com EXECUTE para PUBLIC por padrão no Postgres.
-- Revogamos explicitamente antes de liberar apenas cada RPC necessária.
revoke execute on function public.validar_maioridade() from public, anon, authenticated;
revoke execute on function public.criar_perfil() from public, anon, authenticated;
revoke execute on function public.tocar_atualizado_em() from public, anon, authenticated;
revoke execute on function public.preencher_criador_nome_evento() from public, anon, authenticated;
revoke execute on function public.atualizar_total_interessados() from public, anon, authenticated;
revoke execute on function public.marcar_edicao_comentario() from public, anon, authenticated;

revoke execute on function public.solicitar_exclusao_conta() from public, anon, authenticated;
revoke execute on function public.cancelar_exclusao_conta() from public, anon, authenticated;
revoke execute on function public.admin_definir_bloqueio(uuid,boolean) from public, anon, authenticated;
revoke execute on function public.admin_definir_papel(uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_excluir_conta(uuid) from public, anon, authenticated;
revoke execute on function public.enviar_recurso_denuncia(uuid,text) from public, anon, authenticated;
revoke execute on function public.enviar_informacoes_denuncia(uuid,text) from public, anon, authenticated;
revoke execute on function public.admin_decidir_recurso(uuid,text,text) from public, anon, authenticated;
revoke execute on function public.aplicar_medida(uuid,text,int) from public, anon, authenticated;
revoke execute on function public.arquivar_denuncias_vencidas() from public, anon, authenticated;


-- RPCs de sessão. Cada uma faz validação interna de auth.uid()/admin.
grant execute on function public.solicitar_exclusao_conta() to authenticated;
grant execute on function public.cancelar_exclusao_conta() to authenticated;
grant execute on function public.admin_definir_bloqueio(uuid,boolean) to authenticated;
grant execute on function public.admin_definir_papel(uuid,text) to authenticated;
grant execute on function public.admin_excluir_conta(uuid) to authenticated;
grant execute on function public.enviar_recurso_denuncia(uuid,text) to authenticated;
grant execute on function public.enviar_informacoes_denuncia(uuid,text) to authenticated;
grant execute on function public.admin_decidir_recurso(uuid,text,text) to authenticated;
grant execute on function public.aplicar_medida(uuid,text,int) to authenticated;
-- As rotinas de prazo são chamadas somente pelo Cron privado; não são RPCs de cliente.

-- ============================================================
-- REALTIME
-- ============================================================
do $$ begin alter publication supabase_realtime add table public.eventos; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.interesses; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.comentarios; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notificacoes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.denuncia_historico; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.perfis; exception when duplicate_object then null; end $$;

notify pgrst,'reload schema';

-- Depois de criar sua primeira conta pelo site, promova-a manualmente:
-- update public.perfis set papel='admin' where email='SEU_EMAIL';


-- ============================================================
-- SNAPSHOT V10 — recursos adicionados após a V9
-- ============================================================
-- ============================================================
-- ROLÊ V10 — próxima etapa
-- Perfil público, denúncia de evento/comentário/usuário,
-- estados do evento, aviso aos interessados e limpeza de imagens.
-- Este arquivo é incremental para quem já está na V9.
-- ============================================================

-- 1) Estados do evento e notificações vinculadas a evento
alter table public.eventos
  add column if not exists situacao text not null default 'agendado';
alter table public.eventos drop constraint if exists eventos_situacao_check;
alter table public.eventos add constraint eventos_situacao_check
  check (situacao in ('agendado','cancelado','adiado','esgotado','finalizado'));

alter table public.notificacoes
  add column if not exists evento_id uuid references public.eventos(id) on delete set null;
create index if not exists notificacoes_evento_idx on public.notificacoes(evento_id,criado_em desc);

create or replace function private.proteger_notificacao_usuario()
returns trigger language plpgsql set search_path='' as $$
begin
  if auth.uid()=old.usuario_id then
    if new.id is distinct from old.id
       or new.usuario_id is distinct from old.usuario_id
       or new.titulo is distinct from old.titulo
       or new.mensagem is distinct from old.mensagem
       or new.denuncia_id is distinct from old.denuncia_id
       or new.evento_id is distinct from old.evento_id
       or new.criado_em is distinct from old.criado_em then
      raise exception 'Somente o estado de leitura pode ser alterado';
    end if;
  end if;
  return new;
end $$;

create or replace function private.notificar_interessados_evento()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  partes text[]:=array[]::text[];
  mensagem text;
  rotulo text;
begin
  if tg_op='DELETE' then
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
    select i.usuario_id,'Evento removido',
           'O evento "'||old.nome||'" foi removido da plataforma.',old.id
    from public.interesses i
    where i.evento_id=old.id and i.usuario_id<>old.criador_id;
    return old;
  end if;

  if new.nome is distinct from old.nome then
    partes:=array_append(partes,'o nome foi alterado para "'||new.nome||'"');
  end if;
  if new.data_evento is distinct from old.data_evento or new.hora_evento is distinct from old.hora_evento then
    partes:=array_append(partes,'a data/horário mudou para '||to_char(new.data_evento,'DD/MM/YYYY')||' às '||to_char(new.hora_evento,'HH24:MI'));
  end if;
  if new.endereco is distinct from old.endereco
     or new.numero is distinct from old.numero
     or new.complemento is distinct from old.complemento
     or new.bairro is distinct from old.bairro
     or new.cidade is distinct from old.cidade
     or new.cep is distinct from old.cep
     or new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude then
    partes:=array_append(partes,'o local do evento foi atualizado');
  end if;
  if new.situacao is distinct from old.situacao then
    rotulo:=case new.situacao
      when 'cancelado' then 'o evento foi cancelado'
      when 'adiado' then 'o evento foi marcado como adiado'
      when 'esgotado' then 'as vagas/ingressos estão esgotados'
      when 'finalizado' then 'o evento foi finalizado'
      else 'o evento voltou ao status agendado' end;
    partes:=array_append(partes,rotulo);
  end if;
  if new.ativo is distinct from old.ativo then
    partes:=array_append(partes,case when new.ativo then 'o evento voltou a ficar visível' else 'o evento foi retirado temporariamente da publicação' end);
  end if;
  if coalesce(array_length(partes,1),0)=0 then return new; end if;

  mensagem:='Atualização em "'||new.nome||'": '||array_to_string(partes,'; ')||'.';
  insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
  select i.usuario_id,'Evento atualizado',mensagem,new.id
  from public.interesses i
  where i.evento_id=new.id and i.usuario_id<>new.criador_id;
  return new;
end $$;

drop trigger if exists notificar_interessados_evento_update on public.eventos;
create trigger notificar_interessados_evento_update
  after update of nome,data_evento,hora_evento,endereco,numero,complemento,bairro,cidade,cep,latitude,longitude,situacao,ativo
  on public.eventos for each row execute function private.notificar_interessados_evento();
drop trigger if exists notificar_interessados_evento_delete on public.eventos;
create trigger notificar_interessados_evento_delete
  before delete on public.eventos for each row execute function private.notificar_interessados_evento();

-- 2) Perfil público seguro: só devolve os campos descritos como públicos nos termos
create or replace function public.perfil_publico(p_usuario uuid)
returns table(id uuid,nome text,foto_url text,bio text,cidade text,contato text,criado_em timestamptz,total_eventos bigint)
language sql stable security definer set search_path='' as $$
  select p.id,p.nome,p.foto_url,p.bio,p.cidade,p.contato,p.criado_em,
         (select count(*) from public.eventos e
          where e.criador_id=p.id and e.ativo=true and e.data_evento>=current_date)::bigint
  from public.perfis p
  where p.id=p_usuario
    and p.bloqueado=false
    and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate<=now());
$$;
revoke all on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to anon,authenticated;

-- 3) Denúncias para evento, comentário e usuário
alter table public.denuncias
  add column if not exists comentario_id uuid references public.comentarios(id) on delete set null,
  add column if not exists alvo_resumo text;
create index if not exists denuncias_comentario_idx on public.denuncias(comentario_id);
