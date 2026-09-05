-- ============================================================
-- ROLÊ V22 — NOTIFICAÇÕES COMPLETAS E PREFERÊNCIAS REAIS
-- ============================================================

alter table public.perfis
  add column if not exists notif_eventos boolean not null default true,
  add column if not exists notif_comentarios boolean not null default true,
  add column if not exists notif_denuncias boolean not null default true,
  add column if not exists notif_resumo boolean not null default false;

grant update (notif_eventos, notif_comentarios, notif_denuncias, notif_resumo)
on public.perfis to authenticated;

-- Respeita a preferência de avisos sobre eventos marcados como interesse.
create or replace function private.notificar_interessados_evento()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  partes text[] := array[]::text[];
  mensagem text;
  rotulo text;
begin
  if tg_op='DELETE' then
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
    select i.usuario_id,'Evento removido',
           'O evento "'||old.nome||'" foi removido da plataforma.',old.id
    from public.interesses i
    join public.perfis p on p.id=i.usuario_id
    where i.evento_id=old.id
      and i.usuario_id<>old.criador_id
      and coalesce(p.notif_eventos,true)
      and p.bloqueado=false
      and p.exclusao_prevista is null
      and (p.suspenso_ate is null or p.suspenso_ate<=now());
    return old;
  end if;

  if new.nome is distinct from old.nome then
    partes:=array_append(partes,'o nome foi alterado para "'||new.nome||'"');
  end if;
  if new.data_evento is distinct from old.data_evento or new.hora_evento is distinct from old.hora_evento then
    partes:=array_append(partes,'a data/horário mudou para '||to_char(new.data_evento,'DD/MM/YYYY')||' às '||to_char(new.hora_evento,'HH24:MI'));
  end if;
  if new.endereco is distinct from old.endereco or new.numero is distinct from old.numero
     or new.complemento is distinct from old.complemento or new.bairro is distinct from old.bairro
     or new.cidade is distinct from old.cidade or new.cep is distinct from old.cep
     or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude then
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
  join public.perfis p on p.id=i.usuario_id
  where i.evento_id=new.id
    and i.usuario_id<>new.criador_id
    and coalesce(p.notif_eventos,true)
    and p.bloqueado=false
    and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate<=now());
  return new;
end;
$$;

-- Novo comentário no evento do organizador.
create or replace function private.notificar_novo_comentario()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  dono uuid;
  nome_evento text;
begin
  select e.criador_id,e.nome into dono,nome_evento
  from public.eventos e where e.id=new.evento_id;
  if dono is null or dono=new.autor_id then return new; end if;

  if exists(select 1 from public.perfis p
            where p.id=dono and coalesce(p.notif_comentarios,true)
              and p.bloqueado=false and p.exclusao_prevista is null
              and (p.suspenso_ate is null or p.suspenso_ate<=now())) then
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
    values(dono,'Novo comentário no seu evento',
      coalesce(new.autor_nome,'Alguém')||' comentou em "'||nome_evento||'": '||
      left(regexp_replace(new.texto,E'[\n\r]+',' ','g'),160),new.evento_id);
  end if;
  return new;
end;
$$;

drop trigger if exists notificar_novo_comentario_trg on public.comentarios;
create trigger notificar_novo_comentario_trg
after insert on public.comentarios
for each row execute function private.notificar_novo_comentario();

-- Denúncia recebida respeita a preferência de andamento de denúncias.
create or replace function private.registrar_abertura_denuncia()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
  values(new.id,new.usuario_id,new.autor_apelido,'abertura','Denúncia registrada');

  if new.usuario_id is not null and exists(
    select 1 from public.perfis p where p.id=new.usuario_id and coalesce(p.notif_denuncias,true)
  ) then
    insert into public.notificacoes(usuario_id,titulo,mensagem,denuncia_id)
    values(new.usuario_id,'Denúncia nº '||new.numero,
           'Recebemos sua denúncia. Você será avisado a cada mudança.',new.id);
  end if;
  return new;
end;
$$;

-- Resumo semanal opcional. Segunda-feira, 12:00 UTC (~09:00 Brasília).
create or replace function private.enviar_resumo_semanal()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare total integer;
begin
  insert into public.notificacoes(usuario_id,titulo,mensagem)
  select p.id,'Resumo semanal do Rolê',
    case when p.cidade is not null
      then 'Há '||x.total||' evento(s) nos próximos 7 dias em '||p.cidade||'. Confira o mural para ver os detalhes.'
      else 'Há '||x.total||' evento(s) nos próximos 7 dias. Confira o mural para ver os detalhes.' end
  from public.perfis p
  cross join lateral (
    select count(*)::int total from public.eventos e
    where e.ativo=true and e.data_evento between current_date and current_date+7
      and (p.cidade is null or lower(coalesce(e.cidade,''))=lower(p.cidade))
  ) x
  where coalesce(p.notif_resumo,false)
    and p.bloqueado=false and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate<=now())
    and x.total>0;
  get diagnostics total=row_count;
  return total;
end;
$$;

revoke all on function private.enviar_resumo_semanal() from public,anon,authenticated;
create extension if not exists pg_cron;
do $$ begin
  if exists(select 1 from cron.job where jobname='role_resumo_semanal') then
    perform cron.unschedule('role_resumo_semanal');
  end if;
end $$;
select cron.schedule('role_resumo_semanal','0 12 * * 1',$cron$select private.enviar_resumo_semanal();$cron$);

notify pgrst,'reload schema';

-- Andamento da denúncia também respeita notif_denuncias.
create or replace function private.acompanhar_denuncia()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  texto text;
  quem text;
  rotulo text;
  transicao_recurso boolean:=false;
  transicao_info boolean:=false;
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
        if old.status='em_recurso' and new.recurso_decisao='negado' then
          new.prazo_recurso:=now();
        elsif new.recurso_texto is null then
          new.prazo_recurso:=now()+interval '7 days';
        end if;
      elsif new.status in ('em_analise','aguardando_info') and old.status='em_recurso' then
        new.prazo_recurso:=null;
      end if;

      rotulo:=case new.status
        when 'em_analise' then 'Em análise'
        when 'aguardando_info' then 'Aguardando informações'
        when 'resolvida' then 'Resolvida'
        when 'em_recurso' then 'Em recurso'
        when 'arquivada' then 'Arquivada'
        else 'Recebida' end;

      insert into public.denuncia_historico(denuncia_id,ator_id,ator_nome,acao,detalhe)
      values(new.id,auth.uid(),quem,'status','Passou para: '||rotulo);
      insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
      values(auth.uid(),quem,'denuncia_status','denuncia',new.id,'Denúncia #'||new.numero||' → '||rotulo);

      texto:=case
        when old.status='em_recurso' and new.recurso_decisao='aceito' then 'Seu recurso foi aceito e a denúncia voltou para análise.'
        when old.status='em_recurso' and new.recurso_decisao='negado' then 'Seu recurso foi analisado e a decisão anterior foi mantida.'
        when new.status='em_analise' then 'Sua denúncia está sendo analisada pela moderação.'
        when new.status='aguardando_info' then 'A moderação precisa de mais informações sobre sua denúncia.'
        when new.status='resolvida' then case when new.recurso_texto is null
          then 'Sua denúncia foi analisada e resolvida. Você tem 7 dias para consultar o resultado e enviar um recurso.'
          else 'O recurso da sua denúncia foi analisado.' end
        when new.status='arquivada' then 'Sua denúncia foi arquivada.'
        else 'Sua denúncia foi recebida e entrou na fila de análise.' end;

      if new.info_solicitada is not null and new.status='aguardando_info' then texto:=texto||' Solicitação: '||trim(new.info_solicitada); end if;
      if new.resposta is not null and length(trim(new.resposta))>0 then texto:=texto||' Resposta da moderação: '||trim(new.resposta); end if;
      if new.recurso_resposta is not null and old.status='em_recurso' then texto:=texto||' Resposta: '||trim(new.recurso_resposta); end if;

      if new.usuario_id is not null and exists(
        select 1 from public.perfis p where p.id=new.usuario_id and coalesce(p.notif_denuncias,true)
      ) then
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

-- A notificação da decisão do recurso é centralizada no trigger acima,
-- evitando avisos duplicados.
create or replace function public.admin_decidir_recurso(p_denuncia uuid,p_decisao text,p_resposta text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.denuncias;
  resp text:=nullif(trim(coalesce(p_resposta,'')),'');
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem decidir recursos'; end if;
  if p_decisao not in ('aceito','negado') then raise exception 'Decisão de recurso inválida'; end if;
  select * into d from public.denuncias where id=p_denuncia for update;
  if not found or d.status<>'em_recurso' then raise exception 'Recurso não encontrado ou já analisado'; end if;
  update public.denuncias
     set recurso_decisao=p_decisao,
         recurso_resposta=resp,
         recurso_decidido_em=now(),
         status=case when p_decisao='aceito' then 'em_analise' else 'resolvida' end,
         prazo_recurso=case when p_decisao='negado' then now() else null end
   where id=p_denuncia;
end;
$$;
