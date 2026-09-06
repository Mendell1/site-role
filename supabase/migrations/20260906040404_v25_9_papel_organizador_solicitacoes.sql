-- ROLÊ V25.9 — papel de organizador e fluxo de aprovação

alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check check (papel in ('usuario','organizador','admin'));

alter table public.perfis add column if not exists organizador_nome text;
alter table public.perfis add column if not exists organizador_descricao text;
alter table public.perfis add column if not exists organizador_desde timestamptz;
alter table public.perfis add column if not exists organizador_aprovado_por uuid references public.perfis(id) on delete set null;
alter table public.perfis add column if not exists organizador_revogado_em timestamptz;
alter table public.perfis add column if not exists organizador_revogado_por uuid references public.perfis(id) on delete set null;
alter table public.perfis add column if not exists organizador_revogacao_motivo text;

alter table public.perfis drop constraint if exists perfis_organizador_nome_tamanho;
alter table public.perfis add constraint perfis_organizador_nome_tamanho check (organizador_nome is null or char_length(organizador_nome) between 2 and 100);
alter table public.perfis drop constraint if exists perfis_organizador_descricao_tamanho;
alter table public.perfis add constraint perfis_organizador_descricao_tamanho check (organizador_descricao is null or char_length(organizador_descricao) <= 700);
alter table public.perfis drop constraint if exists perfis_organizador_revogacao_tamanho;
alter table public.perfis add constraint perfis_organizador_revogacao_tamanho check (organizador_revogacao_motivo is null or char_length(organizador_revogacao_motivo) <= 500);

create table if not exists public.solicitacoes_organizador_v25_9 (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete cascade,
  nome_organizacao text not null check (char_length(nome_organizacao) between 2 and 100),
  cidade text not null check (char_length(cidade) between 2 and 100),
  tipos_eventos text not null check (char_length(tipos_eventos) between 3 and 300),
  descricao text not null check (char_length(descricao) between 20 and 700),
  contato text check (contato is null or char_length(contato) <= 180),
  motivo text not null check (char_length(motivo) between 20 and 1000),
  status text not null default 'pendente' check (status in ('pendente','aprovada','recusada','cancelada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  analisado_em timestamptz,
  analisado_por uuid references public.perfis(id) on delete set null,
  observacao_admin text check (observacao_admin is null or char_length(observacao_admin) <= 1000)
);

create unique index if not exists solicitacao_organizador_pendente_uidx
  on public.solicitacoes_organizador_v25_9(usuario_id) where status='pendente';
create index if not exists solicitacao_organizador_usuario_idx
  on public.solicitacoes_organizador_v25_9(usuario_id,criado_em desc);
create index if not exists solicitacao_organizador_status_idx
  on public.solicitacoes_organizador_v25_9(status,criado_em desc);

alter table public.solicitacoes_organizador_v25_9 enable row level security;
revoke all on table public.solicitacoes_organizador_v25_9 from anon;
revoke insert,update,delete on table public.solicitacoes_organizador_v25_9 from authenticated;
grant select on table public.solicitacoes_organizador_v25_9 to authenticated;

drop policy if exists solicitacoes_organizador_select_v25_9 on public.solicitacoes_organizador_v25_9;
create policy solicitacoes_organizador_select_v25_9
on public.solicitacoes_organizador_v25_9 for select to authenticated
using ((select auth.uid())=usuario_id or private.eh_admin());

create or replace function private.pode_organizar()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.perfis p
    where p.id=auth.uid()
      and p.papel in ('organizador','admin')
      and p.bloqueado=false
      and p.cadastro_completo=true
      and (p.suspenso_ate is null or p.suspenso_ate<=now())
      and p.exclusao_prevista is null
  );
$$;
revoke all on function private.pode_organizar() from public,anon;
grant execute on function private.pode_organizar() to authenticated;

create or replace function private.proteger_campos_sistema_perfil()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  onboarding_autorizado boolean := coalesce(current_setting('app.oauth_onboarding', true), '') = '1';
begin
  if auth.uid() = old.id and not private.eh_admin() then
    if new.papel is distinct from old.papel
       or new.bloqueado is distinct from old.bloqueado
       or new.email is distinct from old.email
       or new.id is distinct from old.id
       or new.criado_em is distinct from old.criado_em
       or new.aceitou_regras is distinct from old.aceitou_regras
       or new.regras_aceitas_em is distinct from old.regras_aceitas_em
       or new.termos_versao is distinct from old.termos_versao
       or new.termos_aceitos_em is distinct from old.termos_aceitos_em
       or new.cadastro_completo is distinct from old.cadastro_completo
       or new.suspenso_ate is distinct from old.suspenso_ate
       or new.advertencias is distinct from old.advertencias
       or new.exclusao_pedida_em is distinct from old.exclusao_pedida_em
       or new.exclusao_prevista is distinct from old.exclusao_prevista
       or new.verificado is distinct from old.verificado
       or new.verificado_em is distinct from old.verificado_em
       or new.verificado_por is distinct from old.verificado_por
       or new.seguidores_total is distinct from old.seguidores_total
       or new.organizador_nome is distinct from old.organizador_nome
       or new.organizador_descricao is distinct from old.organizador_descricao
       or new.organizador_desde is distinct from old.organizador_desde
       or new.organizador_aprovado_por is distinct from old.organizador_aprovado_por
       or new.organizador_revogado_em is distinct from old.organizador_revogado_em
       or new.organizador_revogado_por is distinct from old.organizador_revogado_por
       or new.organizador_revogacao_motivo is distinct from old.organizador_revogacao_motivo then
      if not onboarding_autorizado then
        raise exception 'Campos internos do perfil não podem ser alterados';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.solicitar_organizador_v25_9(
  p_nome_organizacao text,
  p_cidade text,
  p_tipos_eventos text,
  p_descricao text,
  p_contato text,
  p_motivo text,
  p_aceitou_regras boolean
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_usuario uuid:=auth.uid();
  v_perfil public.perfis%rowtype;
  v_id uuid;
  v_cidade text:=btrim(coalesce(p_cidade,''));
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  if p_aceitou_regras is not true then raise exception 'É preciso aceitar as regras para organizadores'; end if;

  select * into v_perfil from public.perfis where id=v_usuario for update;
  if not found then raise exception 'Perfil não encontrado'; end if;
  if v_perfil.papel in ('organizador','admin') then raise exception 'Sua conta já possui acesso para organizar eventos'; end if;
  if v_perfil.bloqueado or v_perfil.cadastro_completo is not true or v_perfil.exclusao_prevista is not null
     or (v_perfil.suspenso_ate is not null and v_perfil.suspenso_ate>now()) then
    raise exception 'Sua conta não está apta a solicitar acesso de organizador';
  end if;
  if v_perfil.data_nascimento is null then raise exception 'Complete sua data de nascimento no perfil'; end if;
  if v_perfil.aceitou_regras is not true then raise exception 'Aceite as regras de convivência antes de solicitar'; end if;
  if exists(select 1 from public.solicitacoes_organizador_v25_9 s where s.usuario_id=v_usuario and s.status='pendente') then
    raise exception 'Você já possui uma solicitação em análise';
  end if;
  if char_length(btrim(coalesce(p_nome_organizacao,'')))<2 then raise exception 'Informe o nome do organizador ou projeto'; end if;
  if v_cidade='' then v_cidade:=btrim(coalesce(v_perfil.cidade,'')); end if;
  if char_length(v_cidade)<2 then raise exception 'Informe a cidade ou região de atuação'; end if;
  if char_length(btrim(coalesce(p_tipos_eventos,'')))<3 then raise exception 'Informe que tipo de evento pretende organizar'; end if;
  if char_length(btrim(coalesce(p_descricao,'')))<20 then raise exception 'Descreva melhor o projeto ou organização'; end if;
  if char_length(btrim(coalesce(p_motivo,'')))<20 then raise exception 'Explique por que deseja publicar eventos no Rolê'; end if;

  if nullif(btrim(coalesce(v_perfil.cidade,'')),'') is null then
    update public.perfis set cidade=v_cidade where id=v_usuario;
  end if;

  insert into public.solicitacoes_organizador_v25_9(usuario_id,nome_organizacao,cidade,tipos_eventos,descricao,contato,motivo)
  values(v_usuario,btrim(p_nome_organizacao),v_cidade,btrim(p_tipos_eventos),btrim(p_descricao),nullif(btrim(coalesce(p_contato,'')),''),btrim(p_motivo))
  returning id into v_id;

  insert into public.notificacoes(usuario_id,titulo,mensagem)
  select p.id,'Nova solicitação de organizador',coalesce(v_perfil.nome,'Um usuário')||' pediu acesso para publicar eventos.'
  from public.perfis p where p.papel='admin' and p.bloqueado=false and p.exclusao_prevista is null;

  return v_id;
end;
$$;
revoke all on function public.solicitar_organizador_v25_9(text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.solicitar_organizador_v25_9(text,text,text,text,text,text,boolean) to authenticated;

create or replace function public.cancelar_solicitacao_organizador_v25_9(p_solicitacao uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  update public.solicitacoes_organizador_v25_9
     set status='cancelada',atualizado_em=now()
   where id=p_solicitacao and usuario_id=auth.uid() and status='pendente';
  if not found then raise exception 'Solicitação pendente não encontrada'; end if;
  return true;
end;
$$;
revoke all on function public.cancelar_solicitacao_organizador_v25_9(uuid) from public,anon;
grant execute on function public.cancelar_solicitacao_organizador_v25_9(uuid) to authenticated;

create or replace function public.admin_decidir_solicitacao_organizador_v25_9(
  p_solicitacao uuid,
  p_decisao text,
  p_observacao text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_s public.solicitacoes_organizador_v25_9%rowtype;
  v_admin_nome text;
  v_usuario_nome text;
  v_decisao text:=lower(btrim(coalesce(p_decisao,'')));
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem analisar solicitações'; end if;
  if v_decisao not in ('aprovar','recusar') then raise exception 'Decisão inválida'; end if;
  select * into v_s from public.solicitacoes_organizador_v25_9 where id=p_solicitacao for update;
  if not found or v_s.status<>'pendente' then raise exception 'Solicitação pendente não encontrada'; end if;
  select nome into v_admin_nome from public.perfis where id=auth.uid();
  select nome into v_usuario_nome from public.perfis where id=v_s.usuario_id;

  if v_decisao='aprovar' then
    update public.perfis
       set papel='organizador',organizador_nome=v_s.nome_organizacao,organizador_descricao=v_s.descricao,
           organizador_desde=now(),organizador_aprovado_por=auth.uid(),organizador_revogado_em=null,
           organizador_revogado_por=null,organizador_revogacao_motivo=null
     where id=v_s.usuario_id and papel='usuario';
    if not found then raise exception 'A conta não está disponível para promoção a organizador'; end if;
    update public.solicitacoes_organizador_v25_9
       set status='aprovada',analisado_em=now(),analisado_por=auth.uid(),
           observacao_admin=nullif(btrim(coalesce(p_observacao,'')),''),atualizado_em=now()
     where id=v_s.id;
    insert into public.notificacoes(usuario_id,titulo,mensagem)
    values(v_s.usuario_id,'Acesso de organizador aprovado','Sua solicitação foi aprovada. Você já pode publicar e administrar seus eventos no Rolê.');
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
    values(auth.uid(),v_admin_nome,'aprovar_organizador','usuario',v_s.usuario_id,'Acesso de organizador aprovado para '||coalesce(v_usuario_nome,'usuário'));
  else
    update public.solicitacoes_organizador_v25_9
       set status='recusada',analisado_em=now(),analisado_por=auth.uid(),
           observacao_admin=nullif(btrim(coalesce(p_observacao,'')),''),atualizado_em=now()
     where id=v_s.id;
    insert into public.notificacoes(usuario_id,titulo,mensagem)
    values(v_s.usuario_id,'Solicitação de organizador analisada',
      case when nullif(btrim(coalesce(p_observacao,'')),'') is null
        then 'Sua solicitação não foi aprovada desta vez. Você pode revisar seu perfil e enviar uma nova solicitação.'
        else 'Sua solicitação não foi aprovada. Motivo: '||btrim(p_observacao) end);
    insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
    values(auth.uid(),v_admin_nome,'recusar_organizador','usuario',v_s.usuario_id,'Solicitação de organizador recusada para '||coalesce(v_usuario_nome,'usuário'));
  end if;
  return true;
end;
$$;
revoke all on function public.admin_decidir_solicitacao_organizador_v25_9(uuid,text,text) from public,anon;
grant execute on function public.admin_decidir_solicitacao_organizador_v25_9(uuid,text,text) to authenticated;

create or replace function public.admin_conceder_organizador_v25_9(
  p_usuario uuid,
  p_nome_organizacao text default null,
  p_observacao text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin_nome text;
  v_nome text;
  v_cidade text;
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem conceder acesso'; end if;
  if p_usuario is null or p_usuario=auth.uid() then raise exception 'Selecione outra conta'; end if;
  select nome,cidade into v_nome,v_cidade from public.perfis
   where id=p_usuario and papel='usuario' and bloqueado=false and exclusao_prevista is null;
  if v_nome is null then raise exception 'Usuário comum elegível não encontrado'; end if;
  select nome into v_admin_nome from public.perfis where id=auth.uid();

  update public.solicitacoes_organizador_v25_9
     set status='cancelada',atualizado_em=now(),observacao_admin='Acesso concedido diretamente pelo administrador'
   where usuario_id=p_usuario and status='pendente';

  update public.perfis
     set papel='organizador',organizador_nome=coalesce(nullif(btrim(coalesce(p_nome_organizacao,'')),''),v_nome),
         organizador_desde=now(),organizador_aprovado_por=auth.uid(),organizador_revogado_em=null,
         organizador_revogado_por=null,organizador_revogacao_motivo=null
   where id=p_usuario;

  insert into public.solicitacoes_organizador_v25_9(
    usuario_id,nome_organizacao,cidade,tipos_eventos,descricao,motivo,status,analisado_em,analisado_por,observacao_admin
  ) values(
    p_usuario,coalesce(nullif(btrim(coalesce(p_nome_organizacao,'')),''),v_nome),
    coalesce(nullif(btrim(coalesce(v_cidade,'')),''),'Não informada'),
    'Acesso concedido pelo administrador','Acesso de organizador concedido diretamente pela administração do Rolê.',
    'Convite/concessão administrativa','aprovada',now(),auth.uid(),nullif(btrim(coalesce(p_observacao,'')),'')
  );

  insert into public.notificacoes(usuario_id,titulo,mensagem)
  values(p_usuario,'Você agora é organizador','A administração liberou sua conta para publicar e administrar eventos no Rolê.');
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
  values(auth.uid(),v_admin_nome,'conceder_organizador','usuario',p_usuario,'Acesso de organizador concedido diretamente para '||v_nome);
  return true;
end;
$$;
revoke all on function public.admin_conceder_organizador_v25_9(uuid,text,text) from public,anon;
grant execute on function public.admin_conceder_organizador_v25_9(uuid,text,text) to authenticated;

create or replace function public.admin_revogar_organizador_v25_9(
  p_usuario uuid,
  p_motivo text,
  p_ocultar_eventos boolean default false
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin_nome text;
  v_nome text;
  v_motivo text:=btrim(coalesce(p_motivo,''));
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem revogar acesso'; end if;
  if char_length(v_motivo)<5 then raise exception 'Informe o motivo da revogação'; end if;
  select nome into v_nome from public.perfis where id=p_usuario and papel='organizador' for update;
  if v_nome is null then raise exception 'Organizador não encontrado'; end if;
  select nome into v_admin_nome from public.perfis where id=auth.uid();

  update public.perfis
     set papel='usuario',verificado=false,verificado_em=null,verificado_por=null,
         organizador_revogado_em=now(),organizador_revogado_por=auth.uid(),organizador_revogacao_motivo=v_motivo
   where id=p_usuario;

  delete from public.seguidores_organizadores where organizador_id=p_usuario;
  if coalesce(p_ocultar_eventos,false) then
    update public.eventos set ativo=false where criador_id=p_usuario and data_evento>=current_date and ativo=true;
  end if;

  insert into public.notificacoes(usuario_id,titulo,mensagem)
  values(p_usuario,'Acesso de organizador revogado',
    'Seu acesso para publicar e administrar eventos foi removido. Motivo: '||v_motivo||
    case when p_ocultar_eventos then ' Seus eventos futuros também foram ocultados.' else '' end);
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
  values(auth.uid(),v_admin_nome,'revogar_organizador','usuario',p_usuario,
    'Acesso de organizador revogado de '||v_nome||'. Motivo: '||v_motivo||
    case when p_ocultar_eventos then ' Eventos futuros ocultados.' else '' end);
  return true;
end;
$$;
revoke all on function public.admin_revogar_organizador_v25_9(uuid,text,boolean) from public,anon;
grant execute on function public.admin_revogar_organizador_v25_9(uuid,text,boolean) to authenticated;

-- Compatibilidade: se alguma conta comum já publicou no passado, preserva o acesso.
update public.perfis p
set papel='organizador',organizador_nome=coalesce(organizador_nome,p.nome),organizador_desde=coalesce(organizador_desde,now())
where p.papel='usuario' and exists(select 1 from public.eventos e where e.criador_id=p.id);

-- Verificação é exclusiva do papel organizador.
update public.perfis set verificado=false,verificado_em=null,verificado_por=null
where papel='usuario' and verificado=true;

notify pgrst,'reload schema';