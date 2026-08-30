-- ROLÊ V9 — segurança, recursos, evidências privadas e automação

-- ============================================================
-- 1. PERFIS: separação real entre campos de usuário e de sistema
-- ============================================================

drop policy if exists perfil_update_proprio on public.perfis;
create policy perfil_update_proprio
on public.perfis
for update
to authenticated
using (auth.uid() = id and private.conta_ativa())
with check (auth.uid() = id and private.conta_ativa());

-- Mesmo com RLS, UPDATE de tabela permite tentar enviar colunas sensíveis.
-- Usuários comuns recebem privilégio apenas nas colunas editáveis do perfil.
revoke update on public.perfis from anon;
revoke update on public.perfis from authenticated;
grant update (nome, foto_url, bio, data_nascimento, cidade, contato)
on public.perfis to authenticated;

create or replace function public.admin_definir_bloqueio(p_usuario uuid, p_bloqueado boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.eh_admin() then
    raise exception 'Apenas administradores podem alterar bloqueios';
  end if;
  if p_usuario is null or p_usuario = auth.uid() then
    raise exception 'Operação inválida para esta conta';
  end if;

  update public.perfis
     set bloqueado = coalesce(p_bloqueado,false)
   where id = p_usuario;

  if not found then raise exception 'Conta não encontrada'; end if;
end;
$$;

create or replace function public.admin_definir_papel(p_usuario uuid, p_papel text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo public.perfis;
  outros_admins integer;
begin
  if not private.eh_admin() then
    raise exception 'Apenas administradores podem alterar permissões';
  end if;
  if p_papel not in ('usuario','admin') then
    raise exception 'Papel inválido';
  end if;
  if p_usuario is null or p_usuario = auth.uid() then
    raise exception 'Você não pode alterar seu próprio papel pelo painel';
  end if;

  select * into alvo from public.perfis where id = p_usuario;
  if not found then raise exception 'Conta não encontrada'; end if;

  if alvo.papel = 'admin' and p_papel = 'usuario' then
    select count(*)::int into outros_admins
    from public.perfis p
    where p.papel='admin'
      and p.id <> p_usuario
      and p.bloqueado=false
      and (p.suspenso_ate is null or p.suspenso_ate <= now())
      and p.exclusao_prevista is null;
    if outros_admins < 1 then
      raise exception 'Não é possível remover o último administrador ativo';
    end if;
  end if;

  update public.perfis set papel = p_papel where id = p_usuario;
end;
$$;

revoke all on function public.admin_definir_bloqueio(uuid,boolean) from public, anon;
revoke all on function public.admin_definir_papel(uuid,text) from public, anon;
grant execute on function public.admin_definir_bloqueio(uuid,boolean) to authenticated;
grant execute on function public.admin_definir_papel(uuid,text) to authenticated;

-- Cadastro novo: data de nascimento passa a ser obrigatória no próprio banco.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aceite boolean := coalesce((new.raw_user_meta_data->>'aceitou_regras')::boolean, false);
  versao text := coalesce(nullif(new.raw_user_meta_data->>'termos_versao',''), '1.0');
  nascimento date;
begin
  if not aceite then
    raise exception 'É necessário aceitar as regras de convivência';
  end if;

  nascimento := nullif(new.raw_user_meta_data->>'data_nascimento','')::date;
  if nascimento is null then
    raise exception 'Informe a data de nascimento';
  end if;
  if nascimento > current_date or age(current_date, nascimento) < interval '18 years' then
    raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
  end if;

  insert into public.perfis (
    id, nome, email, data_nascimento,
    aceitou_regras, regras_aceitas_em,
    termos_versao, termos_aceitos_em
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email,'@',1)),
    new.email,
    nascimento,
    true, now(), versao, now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.validar_maioridade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Perfis antigos sem nascimento podem ser completados depois, mas quem já
  -- possui uma data não pode apagá-la para contornar a regra de maioridade.
  if tg_op = 'UPDATE' and old.data_nascimento is not null and new.data_nascimento is null then
    raise exception 'A data de nascimento não pode ser removida';
  end if;

  if new.data_nascimento is not null then
    if new.data_nascimento > current_date then
      raise exception 'Data de nascimento no futuro';
    end if;
    if age(current_date, new.data_nascimento) < interval '18 years' then
      raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
    end if;
  end if;

  new.atualizado_em = now();
  return new;
end;
$$;

-- ============================================================
-- 2. DENÚNCIAS: recurso único + pedido de informações
-- ============================================================

alter table public.denuncias
  add column if not exists info_solicitada text,
  add column if not exists info_resposta text,
  add column if not exists info_respondida_em timestamptz,
  add column if not exists recurso_decisao text,
  add column if not exists recurso_resposta text,
  add column if not exists recurso_decidido_em timestamptz;

alter table public.denuncias drop constraint if exists denuncias_status_check;
alter table public.denuncias add constraint denuncias_status_check
  check (status in ('recebida','em_analise','aguardando_info','resolvida','em_recurso','arquivada'));

alter table public.denuncias drop constraint if exists denuncias_recurso_decisao_check;
alter table public.denuncias add constraint denuncias_recurso_decisao_check
  check (recurso_decisao is null or recurso_decisao in ('aceito','negado'));

-- Usuário deixa de ter UPDATE genérico em denúncias.
drop policy if exists den_recurso on public.denuncias;
drop policy if exists den_ler_proprias on public.denuncias;
create policy den_ler_proprias
on public.denuncias
for select
to authenticated
using (auth.uid() = usuario_id);

create or replace function public.enviar_recurso_denuncia(p_denuncia uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.denuncias;
  texto text := trim(coalesce(p_texto,''));
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  if char_length(texto) < 10 or char_length(texto) > 1500 then
    raise exception 'O recurso deve ter entre 10 e 1500 caracteres';
  end if;

  select * into d from public.denuncias where id=p_denuncia for update;
  if not found or d.usuario_id is distinct from auth.uid() then
    raise exception 'Denúncia não encontrada';
  end if;
  if d.status <> 'resolvida' then raise exception 'Esta denúncia não aceita recurso agora'; end if;
  if d.prazo_recurso is null or d.prazo_recurso <= now() then raise exception 'Prazo de recurso encerrado'; end if;
  if d.recurso_texto is not null then raise exception 'O recurso já foi enviado'; end if;

  update public.denuncias
     set recurso_texto = texto,
         recurso_em = now(),
         recurso_decisao = null,
         recurso_resposta = null,
         recurso_decidido_em = null,
         status = 'em_recurso'
   where id=p_denuncia;
end;
$$;

create or replace function public.enviar_informacoes_denuncia(p_denuncia uuid, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.denuncias;
  texto text := trim(coalesce(p_texto,''));
begin
  if auth.uid() is null then raise exception 'Sessão necessária'; end if;
  if char_length(texto) < 5 or char_length(texto) > 2000 then
    raise exception 'A resposta deve ter entre 5 e 2000 caracteres';
  end if;

  select * into d from public.denuncias where id=p_denuncia for update;
  if not found or d.usuario_id is distinct from auth.uid() then
    raise exception 'Denúncia não encontrada';
  end if;
  if d.status <> 'aguardando_info' then raise exception 'A moderação não está aguardando informações nesta denúncia'; end if;

  update public.denuncias
     set info_resposta = texto,
         info_respondida_em = now(),
         status = 'em_analise'
   where id=p_denuncia;
end;
$$;

create or replace function public.admin_decidir_recurso(p_denuncia uuid, p_decisao text, p_resposta text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.denuncias;
  resp text := nullif(trim(coalesce(p_resposta,'')),'');
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem decidir recursos'; end if;
  if p_decisao not in ('aceito','negado') then raise exception 'Decisão de recurso inválida'; end if;

  select * into d from public.denuncias where id=p_denuncia for update;
  if not found or d.status <> 'em_recurso' then raise exception 'Recurso não encontrado ou já analisado'; end if;

  update public.denuncias
     set recurso_decisao = p_decisao,
         recurso_resposta = resp,
         recurso_decidido_em = now(),
         status = case when p_decisao='aceito' then 'em_analise' else 'resolvida' end,
         prazo_recurso = case when p_decisao='negado' then now() else null end
   where id=p_denuncia;

  if d.usuario_id is not null then
    insert into public.notificacoes(usuario_id,titulo,mensagem,denuncia_id)
    values(
      d.usuario_id,
      'Recurso da denúncia nº ' || d.numero,
      case when p_decisao='aceito'
        then 'Seu recurso foi aceito e a denúncia voltou para análise.'
        else 'Seu recurso foi analisado e a decisão anterior foi mantida.'
      end || case when resp is not null then ' Resposta: '||resp else '' end,
      d.id
    );
  end if;
end;
$$;

revoke all on function public.enviar_recurso_denuncia(uuid,text) from public, anon;
revoke all on function public.enviar_informacoes_denuncia(uuid,text) from public, anon;
revoke all on function public.admin_decidir_recurso(uuid,text,text) from public, anon;
grant execute on function public.enviar_recurso_denuncia(uuid,text) to authenticated;
grant execute on function public.enviar_informacoes_denuncia(uuid,text) to authenticated;
grant execute on function public.admin_decidir_recurso(uuid,text,text) to authenticated;

-- Trigger de proteção atualizado: fora do admin, só as duas transições
-- feitas pelas RPCs acima são aceitas. O usuário não tem UPDATE direto.
create or replace function private.proteger_recurso_denuncia()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  eh_recurso boolean := false;
  eh_info boolean := false;
begin
  if private.eh_admin() then return new; end if;

  if auth.uid() = old.usuario_id then
    eh_recurso := old.status='resolvida'
      and new.status='em_recurso'
      and old.recurso_texto is null
      and new.recurso_texto is not null
      and new.recurso_em is not null;

    eh_info := old.status='aguardando_info'
      and new.status='em_analise'
      and new.info_resposta is not null
      and new.info_respondida_em is not null;

    if not eh_recurso and not eh_info then
      raise exception 'Alteração de denúncia não permitida';
    end if;

    if new.id is distinct from old.id
       or new.numero is distinct from old.numero
       or new.evento_id is distinct from old.evento_id
       or new.usuario_id is distinct from old.usuario_id
       or new.motivo is distinct from old.motivo
       or new.descricao is distinct from old.descricao
       or new.resposta is distinct from old.resposta
       or new.criado_em is distinct from old.criado_em
       or new.finalizada_em is distinct from old.finalizada_em
       or new.categoria is distinct from old.categoria
       or new.alvo_tipo is distinct from old.alvo_tipo
       or new.denunciado_id is distinct from old.denunciado_id
       or new.evidencia_url is distinct from old.evidencia_url
       or new.admin_id is distinct from old.admin_id
       or new.decisao is distinct from old.decisao
       or new.medida is distinct from old.medida
       or new.resolvida_em is distinct from old.resolvida_em
       or new.autor_apelido is distinct from old.autor_apelido
       or new.recurso_decisao is distinct from old.recurso_decisao
       or new.recurso_resposta is distinct from old.recurso_resposta
       or new.recurso_decidido_em is distinct from old.recurso_decidido_em
       or new.info_solicitada is distinct from old.info_solicitada then
      raise exception 'Campos internos da denúncia não podem ser alterados';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.acompanhar_denuncia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  texto text;
  quem text;
  rotulo text;
  transicao_recurso boolean := false;
  transicao_info boolean := false;
begin
  select p.nome into quem from public.perfis p where p.id = auth.uid();

  transicao_recurso := auth.uid() = old.usuario_id
    and old.status='resolvida' and new.status='em_recurso'
    and new.recurso_texto is not null;

  transicao_info := auth.uid() = old.usuario_id
    and old.status='aguardando_info' and new.status='em_analise'
    and new.info_resposta is not null;

  if new.status is distinct from old.status then
    if transicao_recurso then
      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'recurso','Recurso enviado pelo denunciante');

    elsif transicao_info then
      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'informacoes','Informações adicionais enviadas pelo denunciante');

    else
      if not private.eh_admin() then
        raise exception 'Apenas administradores podem alterar o status';
      end if;

      new.admin_id := coalesce(auth.uid(), new.admin_id);

      if new.status = 'resolvida' then
        new.resolvida_em := now();
        if old.status='em_recurso' and new.recurso_decisao='negado' then
          new.prazo_recurso := now();
        elsif new.recurso_texto is null then
          new.prazo_recurso := now() + interval '7 days';
        end if;
      elsif new.status in ('em_analise','aguardando_info') and old.status='em_recurso' then
        new.prazo_recurso := null;
      end if;

      rotulo := case new.status
        when 'em_analise' then 'Em análise'
        when 'aguardando_info' then 'Aguardando informações'
        when 'resolvida' then 'Resolvida'
        when 'em_recurso' then 'Em recurso'
        when 'arquivada' then 'Arquivada'
        else 'Recebida'
      end;

      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'status','Passou para: '||rotulo);

      insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
      values(auth.uid(),quem,'denuncia_status','denuncia',new.id,'Denúncia #'||new.numero||' → '||rotulo);

      texto := case new.status
        when 'em_analise' then 'Sua denúncia está sendo analisada pela moderação.'
        when 'aguardando_info' then 'A moderação precisa de mais informações sobre sua denúncia.'
        when 'resolvida' then case when new.recurso_texto is null
          then 'Sua denúncia foi analisada e resolvida. Você tem 7 dias para consultar o resultado e enviar um recurso.'
          else 'O recurso da sua denúncia foi analisado.' end
        when 'arquivada' then 'Sua denúncia foi arquivada.'
        else 'Sua denúncia foi recebida e entrou na fila de análise.'
      end;

      if new.info_solicitada is not null and new.status='aguardando_info' then
        texto := texto || ' Solicitação: ' || trim(new.info_solicitada);
      end if;
      if new.resposta is not null and length(trim(new.resposta)) > 0 then
        texto := texto || ' Resposta da moderação: ' || trim(new.resposta);
      end if;

      if new.usuario_id is not null then
        insert into public.notificacoes(usuario_id,titulo,mensagem,denuncia_id)
        values(new.usuario_id,'Denúncia nº '||new.numero,texto,new.id);
      end if;
    end if;
  end if;

  if new.medida is distinct from old.medida and new.medida is not null then
    if not private.eh_admin() then raise exception 'Apenas administradores podem aplicar medidas'; end if;
    insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
    values(new.id,auth.uid(),quem,'medida','Medida aplicada: '||new.medida);
  end if;

  if new.decisao is distinct from old.decisao and new.decisao is not null then
    if not private.eh_admin() then raise exception 'Apenas administradores podem registrar decisões'; end if;
    insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
    values(new.id,auth.uid(),quem,'decisao','Decisão: '||new.decisao);
  end if;

  return new;
end;
$$;

-- ============================================================
-- 3. EVIDÊNCIAS PRIVADAS
-- ============================================================

-- Converte URLs públicas antigas para o caminho interno do objeto.
update public.denuncias
set evidencia_url = regexp_replace(evidencia_url, '^.*/object/public/denuncias/', '')
where evidencia_url like 'http%/object/public/denuncias/%';

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id='denuncias';

drop policy if exists evid_ver on storage.objects;
drop policy if exists evid_enviar on storage.objects;
drop policy if exists evid_admin_ver on storage.objects;
drop policy if exists evid_dono_ver on storage.objects;

create policy evid_enviar
on storage.objects
for insert
to authenticated
with check (
  bucket_id='denuncias'
  and (storage.foldername(name))[1] = auth.uid()::text
  and private.conta_ativa()
);

create policy evid_admin_ver
on storage.objects
for select
to authenticated
using (bucket_id='denuncias' and private.eh_admin());

-- O denunciante também pode visualizar o próprio arquivo, se a interface
-- futuramente oferecer essa opção; ele nunca enxerga evidência de outra pessoa.
create policy evid_dono_ver
on storage.objects
for select
to authenticated
using (bucket_id='denuncias' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 4. MANUTENÇÃO AUTOMÁTICA (CRON)
-- ============================================================

create or replace function private.arquivar_denuncias_vencidas_job()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare total integer;
begin
  update public.denuncias
     set status='arquivada'
   where status='resolvida'
     and prazo_recurso is not null
     and prazo_recurso <= now();
  get diagnostics total = row_count;
  return total;
end;
$$;

create or replace function private.processar_exclusoes_vencidas_job()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removidas integer:=0; alvo uuid;
begin
  for alvo in
    select p.id from public.perfis p
    where p.exclusao_prevista is not null and p.exclusao_prevista <= now()
  loop
    delete from auth.users where id=alvo;
    removidas := removidas + 1;
  end loop;
  return removidas;
end;
$$;

create or replace function private.rotina_manutencao_role()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.arquivar_denuncias_vencidas_job();
  perform private.processar_exclusoes_vencidas_job();
end;
$$;

create or replace function public.arquivar_denuncias_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem arquivar denúncias por prazo'; end if;
  return private.arquivar_denuncias_vencidas_job();
end;
$$;

create or replace function public.processar_exclusoes_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem processar exclusões vencidas'; end if;
  return private.processar_exclusoes_vencidas_job();
end;
$$;

-- pg_cron é uma extensão oficial suportada pelo Supabase.
create extension if not exists pg_cron;

do $$
begin
  if exists(select 1 from cron.job where jobname='role_manutencao_diaria') then
    perform cron.unschedule('role_manutencao_diaria');
  end if;
end $$;

-- 03:15 UTC = 00:15 no horário de Brasília (UTC-3).
select cron.schedule(
  'role_manutencao_diaria',
  '15 3 * * *',
  $cron$select private.rotina_manutencao_role();$cron$
);

-- ============================================================
-- 5. PRIVILÉGIOS / RELOAD
-- ============================================================

revoke all on function private.arquivar_denuncias_vencidas_job() from public, anon, authenticated;
revoke all on function private.processar_exclusoes_vencidas_job() from public, anon, authenticated;
revoke all on function private.rotina_manutencao_role() from public, anon, authenticated;

revoke all on function public.arquivar_denuncias_vencidas() from public, anon;
revoke all on function public.processar_exclusoes_vencidas() from public, anon;
grant execute on function public.arquivar_denuncias_vencidas() to authenticated;
grant execute on function public.processar_exclusoes_vencidas() to authenticated;

notify pgrst, 'reload schema';


-- ============================================================
-- 5. VIEW DE DENÚNCIAS + ROLES RLS MAIS ESTRITOS
-- ============================================================
drop view if exists public.denuncias_lista;
create view public.denuncias_lista with (security_invoker=true) as
select
  d.id,d.numero,d.evento_id,d.usuario_id,d.denunciado_id,d.admin_id,
  d.categoria,d.motivo,d.descricao,d.status,d.decisao,d.medida,d.resposta,
  d.evidencia_url,d.alvo_tipo,d.criado_em,d.resolvida_em,d.prazo_recurso,
  d.recurso_texto,d.recurso_em,d.info_solicitada,d.info_resposta,
  d.info_respondida_em,d.recurso_decisao,d.recurso_resposta,d.recurso_decidido_em,
  e.nome as evento_nome,e.ativo as evento_ativo,
  coalesce(p.nome,d.autor_apelido,'conta removida') as autor_nome,
  dn.nome as denunciado_nome,ad.nome as admin_nome,
  case when d.status='resolvida' and d.prazo_recurso is not null
    then greatest(0,ceil(extract(epoch from (d.prazo_recurso-now()))/86400))::int
    else null end as dias_de_prazo,
  (d.status in ('recebida','em_analise','aguardando_info','em_recurso')
    and d.criado_em < now()-interval '3 days') as urgente
from public.denuncias d
left join public.eventos e on e.id=d.evento_id
left join public.perfis p on p.id=d.usuario_id
left join public.perfis dn on dn.id=d.denunciado_id
left join public.perfis ad on ad.id=d.admin_id;

grant select on public.denuncias_lista to authenticated;

alter policy coment_criar on public.comentarios to authenticated;
alter policy coment_editar on public.comentarios to authenticated;
alter policy coment_apagar on public.comentarios to authenticated;
alter policy hist_autor on public.denuncia_historico to authenticated;
alter policy notif_ler on public.notificacoes to authenticated;
alter policy notif_marcar on public.notificacoes to authenticated;
alter policy notif_apagar on public.notificacoes to authenticated;

notify pgrst,'reload schema';


-- O Cron substitui a antiga execução ao abrir o painel.
revoke all on function public.arquivar_denuncias_vencidas() from public, anon, authenticated;
revoke all on function public.processar_exclusoes_vencidas() from public, anon, authenticated;