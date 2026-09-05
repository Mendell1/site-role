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

drop policy if exists usuario_cria_denuncia on public.denuncias;
revoke insert on public.denuncias from anon,authenticated;

create or replace function public.abrir_denuncia(
  p_alvo_tipo text,p_alvo_id uuid,p_categoria text,p_descricao text default null,p_evidencia_path text default null
)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  eu uuid:=auth.uid(); evento uuid; comentario uuid; denunciado uuid; resumo text;
  numero_criado bigint; evidencia text:=nullif(trim(coalesce(p_evidencia_path,'')),'');
  categoria text:=trim(coalesce(p_categoria,''));
begin
  if eu is null or not private.conta_ativa() then raise exception 'Entre em uma conta ativa para denunciar'; end if;
  if p_alvo_tipo not in ('evento','comentario','usuario') then raise exception 'Tipo de denúncia inválido'; end if;
  if p_alvo_id is null then raise exception 'Alvo da denúncia inválido'; end if;
  if char_length(categoria)<3 or char_length(categoria)>100 then raise exception 'Categoria da denúncia inválida'; end if;
  if p_descricao is not null and char_length(trim(p_descricao))>2000 then raise exception 'Descrição muito longa'; end if;

  if evidencia is not null then
    if evidencia not like eu::text||'/%' or position('..' in evidencia)>0 then raise exception 'Caminho de evidência inválido'; end if;
    if not exists(select 1 from storage.objects o where o.bucket_id='denuncias' and o.name=evidencia and o.owner=eu) then
      raise exception 'Evidência não encontrada';
    end if;
  end if;

  if p_alvo_tipo='evento' then
    select e.id,e.criador_id,e.nome into evento,denunciado,resumo
    from public.eventos e where e.id=p_alvo_id and e.ativo=true;
    if evento is null then raise exception 'Evento não encontrado'; end if;
    if denunciado=eu then raise exception 'Você não pode denunciar seu próprio evento'; end if;
  elsif p_alvo_tipo='comentario' then
    select c.id,c.evento_id,c.autor_id,'Comentário: '||left(c.texto,180)
      into comentario,evento,denunciado,resumo
    from public.comentarios c join public.eventos e on e.id=c.evento_id and e.ativo=true
    where c.id=p_alvo_id;
    if comentario is null then raise exception 'Comentário não encontrado'; end if;
    if denunciado=eu then raise exception 'Você não pode denunciar seu próprio comentário'; end if;
  else
    select p.id,p.nome into denunciado,resumo from public.perfis p
    where p.id=p_alvo_id and p.bloqueado=false and p.exclusao_prevista is null;
    if denunciado is null then raise exception 'Usuário não encontrado'; end if;
    if denunciado=eu then raise exception 'Você não pode denunciar sua própria conta'; end if;
  end if;

  insert into public.denuncias(evento_id,comentario_id,usuario_id,denunciado_id,alvo_tipo,alvo_resumo,categoria,motivo,descricao,evidencia_url)
  values(evento,comentario,eu,denunciado,p_alvo_tipo,resumo,categoria,categoria,nullif(trim(coalesce(p_descricao,'')),''),evidencia)
  returning numero into numero_criado;
  return numero_criado;
end $$;
revoke all on function public.abrir_denuncia(text,uuid,text,text,text) from public,anon;
grant execute on function public.abrir_denuncia(text,uuid,text,text,text) to authenticated;

-- Remoção de conteúdo considera o tipo do alvo
create or replace function public.aplicar_medida(p_denuncia uuid,p_medida text,p_dias integer default 7)
returns void language plpgsql security definer set search_path='' as $$
declare d public.denuncias; quem text;
begin
  if not private.eh_admin() then raise exception 'Apenas administradores aplicam medidas'; end if;
  if p_medida not in ('nenhuma','advertencia','remocao','suspensao','banimento') then raise exception 'Medida inválida'; end if;
  select * into d from public.denuncias where id=p_denuncia;
  if not found then raise exception 'Denúncia não encontrada'; end if;
  select p.nome into quem from public.perfis p where p.id=auth.uid();

  if p_medida='remocao' then
    if d.alvo_tipo='evento' and d.evento_id is not null then
      update public.eventos set ativo=false where id=d.evento_id;
    elsif d.alvo_tipo='comentario' and d.comentario_id is not null then
      delete from public.comentarios where id=d.comentario_id;
    else
      raise exception 'A medida de remoção não se aplica a este tipo de denúncia';
    end if;
  elsif p_medida='advertencia' and d.denunciado_id is not null then
    update public.perfis set advertencias=advertencias+1 where id=d.denunciado_id;
    insert into public.notificacoes(usuario_id,titulo,mensagem)
    values(d.denunciado_id,'Advertência da moderação','A moderação registrou uma advertência na sua conta. Reveja as regras de convivência.');
  elsif p_medida='suspensao' and d.denunciado_id is not null then
    update public.perfis set suspenso_ate=now()+(greatest(1,p_dias)||' days')::interval where id=d.denunciado_id;
    insert into public.notificacoes(usuario_id,titulo,mensagem)
    values(d.denunciado_id,'Conta suspensa','Sua conta ficará suspensa por '||greatest(1,p_dias)||' dia(s) por descumprimento das regras.');
  elsif p_medida='banimento' and d.denunciado_id is not null then
    update public.perfis set bloqueado=true where id=d.denunciado_id;
  end if;

  update public.denuncias set medida=p_medida where id=p_denuncia;
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
  values(auth.uid(),quem,'medida_'||p_medida,'denuncia',p_denuncia,'Denúncia #'||d.numero||' · alvo '||d.alvo_tipo);
end $$;

-- 4) Views finais
drop view if exists public.eventos_lista;
create view public.eventos_lista with (security_invoker=true) as
select e.id,e.criador_id,e.nome,e.descricao,e.categoria_id,
       c.nome as categoria_nome,c.emoji as categoria_emoji,
       e.data_evento,e.hora_evento,e.endereco,e.bairro,e.cidade,e.gratuito,e.valor,
       e.max_participantes,e.contato,e.imagem_url,e.ativo,e.criador_nome,e.total_interessados,
       e.latitude,e.longitude,e.numero,e.complemento,e.cep,e.criador_foto,e.situacao,
       (select count(*) from public.comentarios co where co.evento_id=e.id) as total_comentarios,
       (e.data_evento=current_date) as e_hoje
from public.eventos e join public.categorias c on c.id=e.categoria_id
where e.ativo=true;
grant select on public.eventos_lista to anon,authenticated;

drop view if exists public.denuncias_lista;
create view public.denuncias_lista with (security_invoker=true) as
select d.id,d.numero,d.evento_id,d.comentario_id,d.usuario_id,d.denunciado_id,d.admin_id,
       d.categoria,d.motivo,d.descricao,d.status,d.decisao,d.medida,d.resposta,d.evidencia_url,
       d.alvo_tipo,d.alvo_resumo,d.criado_em,d.resolvida_em,d.prazo_recurso,d.recurso_texto,d.recurso_em,
       d.info_solicitada,d.info_resposta,d.info_respondida_em,d.recurso_decisao,d.recurso_resposta,d.recurso_decidido_em,
       e.nome as evento_nome,e.ativo as evento_ativo,
       coalesce(p.nome,d.autor_apelido,'conta removida') as autor_nome,
       dn.nome as denunciado_nome,ad.nome as admin_nome,
       case d.alvo_tipo
         when 'evento' then coalesce(e.nome,d.alvo_resumo,'Evento removido')
         when 'comentario' then coalesce(d.alvo_resumo,'Comentário removido')
         when 'usuario' then coalesce(dn.nome,d.alvo_resumo,'Usuário removido')
         else coalesce(d.alvo_resumo,'Conteúdo') end as alvo_nome,
       case when d.status='resolvida' and d.prazo_recurso is not null
         then greatest(0,ceil(extract(epoch from (d.prazo_recurso-now()))/86400))::int else null end as dias_de_prazo,
       (d.status in ('recebida','em_analise','aguardando_info','em_recurso') and d.criado_em<now()-interval '3 days') as urgente
from public.denuncias d
left join public.eventos e on e.id=d.evento_id
left join public.perfis p on p.id=d.usuario_id
left join public.perfis dn on dn.id=d.denunciado_id
left join public.perfis ad on ad.id=d.admin_id;
grant select on public.denuncias_lista to authenticated;

-- 5) Cron também finaliza automaticamente eventos passados
create or replace function private.rotina_manutencao_role()
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.eventos set situacao='finalizado'
  where situacao in ('agendado','esgotado') and data_evento<current_date;
  perform private.arquivar_denuncias_vencidas_job();
  perform private.processar_exclusoes_vencidas_job();
end $$;

-- 6) Admin pode remover arquivos antigos de eventos/avatares
-- (a interface V10 usa isso ao excluir eventos/contas)
drop policy if exists eventos_storage_admin_select on storage.objects;
create policy eventos_storage_admin_select on storage.objects for select to authenticated
using(bucket_id='eventos' and private.eh_admin());
drop policy if exists eventos_storage_admin_delete on storage.objects;
create policy eventos_storage_admin_delete on storage.objects for delete to authenticated
using(bucket_id='eventos' and private.eh_admin());
drop policy if exists avatar_admin_ver on storage.objects;
create policy avatar_admin_ver on storage.objects for select to authenticated
using(bucket_id='avatares' and private.eh_admin());
drop policy if exists avatar_admin_apagar on storage.objects;
create policy avatar_admin_apagar on storage.objects for delete to authenticated
using(bucket_id='avatares' and private.eh_admin());
drop policy if exists evid_admin_apagar on storage.objects;
create policy evid_admin_apagar on storage.objects for delete to authenticated
using(bucket_id='denuncias' and private.eh_admin());

-- Garantia de privilégios dos novos RPCs
revoke execute on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to anon,authenticated;
revoke execute on function public.abrir_denuncia(text,uuid,text,text,text) from public,anon;
grant execute on function public.abrir_denuncia(text,uuid,text,text,text) to authenticated;

notify pgrst,'reload schema';
