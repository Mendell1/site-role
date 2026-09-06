-- ROLÊ V25.9 — permissões reais do papel organizador

create or replace function private.organizador_publicavel(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.perfis p
    where p.id=p_usuario
      and p.papel in ('organizador','admin')
      and p.bloqueado=false
      and p.exclusao_prevista is null
      and (p.suspenso_ate is null or p.suspenso_ate<=now())
  );
$$;
revoke all on function private.organizador_publicavel(uuid) from public,anon;
grant execute on function private.organizador_publicavel(uuid) to authenticated;

-- Só organizadores/admins publicam ou administram eventos.
drop policy if exists eventos_criar_proprio on public.eventos;
drop policy if exists eventos_editar_autenticado on public.eventos;
drop policy if exists eventos_excluir_autenticado on public.eventos;
create policy eventos_criar_proprio on public.eventos for insert to authenticated
with check ((select auth.uid())=criador_id and private.pode_organizar());
create policy eventos_editar_autenticado on public.eventos for update to authenticated
using ((((select auth.uid())=criador_id) and private.pode_organizar()) or private.eh_admin())
with check ((((select auth.uid())=criador_id) and private.pode_organizar()) or private.eh_admin());
create policy eventos_excluir_autenticado on public.eventos for delete to authenticated
using ((((select auth.uid())=criador_id) and private.pode_organizar()) or private.eh_admin());

-- Upload/alteração de capa de evento também exige papel de organizador.
drop policy if exists eventos_storage_upload_proprio on storage.objects;
drop policy if exists eventos_storage_update_proprio on storage.objects;
drop policy if exists eventos_storage_delete_proprio on storage.objects;
create policy eventos_storage_upload_proprio on storage.objects for insert to authenticated
with check (bucket_id='eventos' and (storage.foldername(name))[1]=(select auth.uid())::text and private.pode_organizar());
create policy eventos_storage_update_proprio on storage.objects for update to authenticated
using (bucket_id='eventos' and (storage.foldername(name))[1]=(select auth.uid())::text and private.pode_organizar())
with check (bucket_id='eventos' and (storage.foldername(name))[1]=(select auth.uid())::text and private.pode_organizar());
create policy eventos_storage_delete_proprio on storage.objects for delete to authenticated
using (bucket_id='eventos' and (storage.foldername(name))[1]=(select auth.uid())::text and private.pode_organizar());

-- Seguir só faz sentido para perfis que realmente são organizadores.
drop policy if exists seguidores_insert_proprio on public.seguidores_organizadores;
create policy seguidores_insert_proprio on public.seguidores_organizadores for insert to authenticated
with check (
  (select auth.uid())=seguidor_id
  and private.conta_ativa()
  and seguidor_id<>organizador_id
  and private.organizador_publicavel(organizador_id)
);

-- Participantes privados: somente o próprio participante, organizador do evento ou admin.
drop policy if exists inscricoes_select_v25_2 on public.inscricoes_eventos;
create policy inscricoes_select_v25_2 on public.inscricoes_eventos for select to authenticated
using (
  usuario_id=(select auth.uid())
  or exists(
    select 1 from public.eventos e
    where e.id=inscricoes_eventos.evento_id
      and e.criador_id=(select auth.uid())
      and private.pode_organizar()
  )
  or private.eh_admin()
);

-- O dono do evento só modera comentários enquanto mantiver papel de organizador.
drop policy if exists coment_apagar on public.comentarios;
create policy coment_apagar on public.comentarios for delete to authenticated
using (
  (private.conta_ativa() and (
    (select auth.uid())=autor_id
    or (
      private.pode_organizar()
      and exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.criador_id=(select auth.uid()))
    )
  ))
  or private.eh_admin()
);

-- RPC usado pelos recursos de comunidade: somente perfis de organizador/admin.
create or replace function public.perfil_publico_v25(p_usuario uuid)
returns table(
  id uuid,nome text,foto_url text,bio text,cidade text,contato text,criado_em timestamptz,
  total_eventos bigint,verificado boolean,seguidores_total integer
)
language sql
stable
security definer
set search_path=''
as $$
  select p.id,p.nome,p.foto_url,p.bio,p.cidade,p.contato,p.criado_em,
    (select count(*) from public.eventos e where e.criador_id=p.id and e.ativo=true and e.data_evento>=current_date)::bigint,
    p.verificado,p.seguidores_total
  from public.perfis p
  where p.id=p_usuario
    and p.papel in ('organizador','admin')
    and p.bloqueado=false
    and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate<=now());
$$;

-- Selo verificado é separado do papel e só pode ser concedido a organizadores.
create or replace function public.admin_definir_verificacao_v25(p_usuario uuid,p_verificado boolean)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  admin_nome text;
  alvo_nome text;
  alvo_papel text;
begin
  if not private.eh_admin() then raise exception 'Apenas administradores podem alterar a verificação'; end if;
  select nome into admin_nome from public.perfis where id=auth.uid();
  select nome,papel into alvo_nome,alvo_papel from public.perfis where id=p_usuario;
  if alvo_nome is null then raise exception 'Usuário não encontrado'; end if;
  if p_verificado and alvo_papel<>'organizador' then
    raise exception 'Somente organizadores podem receber o selo de verificação';
  end if;
  update public.perfis
     set verificado=p_verificado,
         verificado_em=case when p_verificado then now() else null end,
         verificado_por=case when p_verificado then auth.uid() else null end
   where id=p_usuario;
  insert into public.log_admin(admin_id,admin_nome,acao,alvo_tipo,alvo_id,detalhe)
  values(
    auth.uid(),admin_nome,
    case when p_verificado then 'verificar_organizador' else 'remover_verificacao' end,
    'usuario',p_usuario,
    case when p_verificado then 'Organizador verificado: '||alvo_nome else 'Verificação removida: '||alvo_nome end
  );
  return true;
end;
$$;
revoke all on function public.admin_definir_verificacao_v25(uuid,boolean) from public,anon;
grant execute on function public.admin_definir_verificacao_v25(uuid,boolean) to authenticated;

-- V25.2: painel de participantes respeita o papel atual.
create or replace function private.participantes_evento_v25_2_impl(p_evento uuid)
returns table(usuario_id uuid,nome text,foto_url text,status text,confirmado_em timestamptz,entrou_fila_em timestamptz)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not exists(
    select 1 from public.eventos e
    where e.id=p_evento and ((e.criador_id=auth.uid() and private.pode_organizar()) or private.eh_admin())
  ) then raise exception 'Sem permissão para ver participantes deste evento'; end if;

  return query
  select p.id,p.nome,p.foto_url,i.status,i.confirmado_em,i.entrou_fila_em
  from public.inscricoes_eventos i
  join public.perfis p on p.id=i.usuario_id
  where i.evento_id=p_evento and i.status in ('inscrito','espera')
  order by case when i.status='inscrito' then 0 else 1 end,
           i.confirmado_em asc nulls last,i.entrou_fila_em asc nulls last,i.criado_em asc;
end;
$$;

-- V25.3: check-in, painel e participantes ficam indisponíveis após revogação.
create or replace function private.checkin_ingresso_v25_3_impl(p_codigo uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_operador uuid:=auth.uid();
  v_inscricao public.inscricoes_eventos%rowtype;
  v_evento public.eventos%rowtype;
  v_nome text;
  v_ja boolean:=false;
begin
  if v_operador is null then raise exception 'É preciso entrar na conta'; end if;
  select * into v_inscricao from public.inscricoes_eventos where ingresso_codigo=p_codigo for update;
  if not found then raise exception 'Ingresso não encontrado'; end if;
  select * into v_evento from public.eventos where id=v_inscricao.evento_id;
  if not found then raise exception 'Evento não encontrado'; end if;
  if not ((v_evento.criador_id=v_operador and private.pode_organizar()) or private.eh_admin()) then
    raise exception 'Somente o organizador pode realizar o check-in';
  end if;
  if v_inscricao.status<>'inscrito' then raise exception 'Este ingresso não possui inscrição confirmada'; end if;
  if v_evento.situacao='cancelado' then raise exception 'O evento está cancelado'; end if;
  select nome into v_nome from public.perfis where id=v_inscricao.usuario_id;
  v_ja:=v_inscricao.checkin_em is not null;
  if not v_ja then
    update public.inscricoes_eventos set checkin_em=now(),checkin_por=v_operador where id=v_inscricao.id;
    select * into v_inscricao from public.inscricoes_eventos where id=v_inscricao.id;
    insert into public.notificacoes(usuario_id,titulo,mensagem,evento_id)
    values(v_inscricao.usuario_id,'Check-in realizado','Sua presença em '||coalesce(v_evento.nome,'um evento')||' foi confirmada.',v_evento.id);
  end if;
  return jsonb_build_object(
    'ok',true,'ja_realizado',v_ja,'evento_id',v_evento.id,'evento_nome',v_evento.nome,
    'usuario_id',v_inscricao.usuario_id,'participante_nome',coalesce(v_nome,'Participante'),'checkin_em',v_inscricao.checkin_em
  );
end;
$$;

create or replace function private.desfazer_checkin_v25_3_impl(p_evento uuid,p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_operador uuid:=auth.uid(); v_nome text;
begin
  if v_operador is null then raise exception 'É preciso entrar na conta'; end if;
  if not exists(
    select 1 from public.eventos e
    where e.id=p_evento and ((e.criador_id=v_operador and private.pode_organizar()) or private.eh_admin())
  ) then raise exception 'Sem permissão para alterar check-in deste evento'; end if;
  if not exists(
    select 1 from public.inscricoes_eventos i
    where i.evento_id=p_evento and i.usuario_id=p_usuario and i.status='inscrito' and i.checkin_em is not null
  ) then raise exception 'Check-in não encontrado'; end if;
  update public.inscricoes_eventos set checkin_em=null,checkin_por=null
   where evento_id=p_evento and usuario_id=p_usuario;
  select nome into v_nome from public.perfis where id=p_usuario;
  return jsonb_build_object('ok',true,'participante_nome',coalesce(v_nome,'Participante'));
end;
$$;

create or replace function private.painel_evento_v25_3_impl(p_evento uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_usuario uuid:=auth.uid();
  v_evento public.eventos%rowtype;
  v_inscritos integer;
  v_espera integer;
  v_presentes integer;
  v_taxa numeric;
begin
  if v_usuario is null then raise exception 'É preciso entrar na conta'; end if;
  select * into v_evento from public.eventos where id=p_evento;
  if not found then raise exception 'Evento não encontrado'; end if;
  if not ((v_evento.criador_id=v_usuario and private.pode_organizar()) or private.eh_admin()) then
    raise exception 'Sem permissão para acessar o painel deste evento';
  end if;
  select count(*)::integer into v_inscritos from public.inscricoes_eventos where evento_id=p_evento and status='inscrito';
  select count(*)::integer into v_espera from public.inscricoes_eventos where evento_id=p_evento and status='espera';
  select count(*)::integer into v_presentes from public.inscricoes_eventos where evento_id=p_evento and status='inscrito' and checkin_em is not null;
  v_taxa:=case when v_inscritos=0 then 0 else round((v_presentes::numeric*100.0)/v_inscritos,1) end;
  return jsonb_build_object(
    'evento_id',v_evento.id,'evento_nome',v_evento.nome,'data_evento',v_evento.data_evento,'hora_evento',v_evento.hora_evento,
    'capacidade',v_evento.max_participantes,'inscritos',v_inscritos,'espera',v_espera,'presentes',v_presentes,
    'ausentes',greatest(v_inscritos-v_presentes,0),'taxa_comparecimento',v_taxa
  );
end;
$$;

create or replace function private.participantes_evento_v25_3_impl(p_evento uuid)
returns table(usuario_id uuid,nome text,foto_url text,status text,confirmado_em timestamptz,entrou_fila_em timestamptz,checkin_em timestamptz)
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  if not exists(
    select 1 from public.eventos e
    where e.id=p_evento and ((e.criador_id=auth.uid() and private.pode_organizar()) or private.eh_admin())
  ) then raise exception 'Sem permissão para ver participantes deste evento'; end if;
  return query
  select p.id,p.nome,p.foto_url,i.status,i.confirmado_em,i.entrou_fila_em,i.checkin_em
  from public.inscricoes_eventos i join public.perfis p on p.id=i.usuario_id
  where i.evento_id=p_evento and i.status in ('inscrito','espera')
  order by case when i.status='inscrito' then 0 else 1 end,
           i.checkin_em desc nulls last,i.confirmado_em asc nulls last,
           i.entrou_fila_em asc nulls last,i.criado_em asc;
end;
$$;

-- V25.6: recorrência precisa de acesso de organizador, além da RLS do INSERT.
create or replace function public.criar_eventos_recorrentes_v25_6(
  p_evento jsonb,p_tipo text,p_intervalo integer default 1,p_quantidade integer default 4
)
returns table(serie_id uuid,evento_id uuid,data_evento date,ordem integer)
language plpgsql
set search_path=''
as $$
declare
  v_usuario uuid:=(select auth.uid());
  v_serie uuid:=gen_random_uuid();
  v_inicio date; v_data date; v_id uuid; v_i integer;
  v_nome text; v_categoria text; v_cidade text; v_valor numeric; v_gratuito boolean;
  v_max integer; v_lat double precision; v_lng double precision; v_situacao text;
begin
  if v_usuario is null then raise exception 'Autenticação necessária'; end if;
  if not private.pode_organizar() then raise exception 'Sua conta não possui acesso de organizador'; end if;
  if p_evento is null then raise exception 'Dados do evento ausentes'; end if;
  p_tipo:=lower(btrim(coalesce(p_tipo,'')));
  if p_tipo not in ('semanal','mensal') then raise exception 'Recorrência deve ser semanal ou mensal'; end if;
  if p_intervalo is null or p_intervalo<1 or p_intervalo>12 then raise exception 'Intervalo da recorrência deve ficar entre 1 e 12'; end if;
  if p_quantidade is null or p_quantidade<2 or p_quantidade>52 then raise exception 'Quantidade de ocorrências deve ficar entre 2 e 52'; end if;

  v_nome:=btrim(coalesce(p_evento->>'nome',''));
  v_categoria:=nullif(btrim(coalesce(p_evento->>'categoria_id','')),'');
  v_cidade:=btrim(coalesce(p_evento->>'cidade',''));
  v_inicio:=nullif(p_evento->>'data_evento','')::date;
  v_valor:=coalesce(nullif(p_evento->>'valor','')::numeric,0);
  v_gratuito:=coalesce(nullif(p_evento->>'gratuito','')::boolean,v_valor=0);
  v_max:=nullif(p_evento->>'max_participantes','')::integer;
  v_lat:=nullif(p_evento->>'latitude','')::double precision;
  v_lng:=nullif(p_evento->>'longitude','')::double precision;
  v_situacao:=coalesce(nullif(p_evento->>'situacao',''),'agendado');

  if char_length(v_nome)<3 then raise exception 'Nome muito curto'; end if;
  if v_categoria is null then raise exception 'Categoria obrigatória'; end if;
  if v_cidade='' then raise exception 'Cidade obrigatória'; end if;
  if v_inicio is null then raise exception 'Data inicial obrigatória'; end if;
  if v_inicio<current_date then raise exception 'A primeira ocorrência não pode estar no passado'; end if;
  if v_max is not null and v_max<=0 then raise exception 'Quantidade de vagas inválida'; end if;

  for v_i in 0..(p_quantidade-1) loop
    if p_tipo='semanal' then
      v_data:=v_inicio+(v_i*p_intervalo*7);
    else
      v_data:=(v_inicio+make_interval(months=>v_i*p_intervalo))::date;
    end if;
    insert into public.eventos(
      criador_id,nome,descricao,categoria_id,data_evento,hora_evento,endereco,numero,complemento,cep,bairro,cidade,
      gratuito,valor,max_participantes,contato,imagem_url,situacao,latitude,longitude,serie_id,recorrencia_tipo,
      recorrencia_intervalo,recorrencia_ordem,recorrencia_total
    ) values(
      v_usuario,v_nome,nullif(p_evento->>'descricao',''),v_categoria,v_data,
      coalesce(nullif(p_evento->>'hora_evento','')::time,time '19:00'),nullif(p_evento->>'endereco',''),
      nullif(p_evento->>'numero',''),nullif(p_evento->>'complemento',''),nullif(p_evento->>'cep',''),
      nullif(p_evento->>'bairro',''),v_cidade,v_gratuito,v_valor,v_max,nullif(p_evento->>'contato',''),
      nullif(p_evento->>'imagem_url',''),v_situacao,v_lat,v_lng,v_serie,p_tipo,p_intervalo::smallint,
      (v_i+1)::smallint,p_quantidade::smallint
    ) returning id into v_id;
    serie_id:=v_serie; evento_id:=v_id; data_evento:=v_data; ordem:=v_i+1; return next;
  end loop;
end;
$$;

-- V25.7: painel privado só existe para organizador/admin ativo.
create or replace function public.painel_organizador_v25_7()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_usuario uuid:=auth.uid();
  v_resultado jsonb;
begin
  if v_usuario is null then raise exception 'Autenticação necessária'; end if;
  if not private.pode_organizar() then raise exception 'Sua conta não possui acesso ao painel do organizador'; end if;

  with meus as (
    select e.id,e.nome,e.data_evento,e.hora_evento,e.situacao,e.serie_id,e.recorrencia_ordem,e.recorrencia_total
    from public.eventos e where e.criador_id=v_usuario and e.ativo=true
  ), fav as (
    select f.evento_id,count(*)::bigint qtd from public.favoritos f join meus m on m.id=f.evento_id group by f.evento_id
  ), itr as (
    select i.evento_id,count(*)::bigint qtd from public.interesses i join meus m on m.id=i.evento_id group by i.evento_id
  ), ins as (
    select x.evento_id,
      count(*) filter(where x.status='inscrito')::bigint inscritos,
      count(*) filter(where x.status='espera')::bigint espera,
      count(*) filter(where x.status='inscrito' and x.checkin_em is not null)::bigint checkins
    from public.inscricoes_eventos x join meus m on m.id=x.evento_id group by x.evento_id
  ), met as (
    select em.evento_id,em.visualizacoes,em.compartilhamentos
    from public.evento_metricas_v25_7 em join meus m on m.id=em.evento_id
  ), linhas as (
    select m.*,
      coalesce(met.visualizacoes,0)::bigint visualizacoes,
      coalesce(met.compartilhamentos,0)::bigint compartilhamentos,
      coalesce(fav.qtd,0)::bigint favoritos,
      coalesce(itr.qtd,0)::bigint interessados,
      coalesce(ins.inscritos,0)::bigint inscritos,
      coalesce(ins.espera,0)::bigint espera,
      coalesce(ins.checkins,0)::bigint checkins
    from meus m
    left join fav on fav.evento_id=m.id
    left join itr on itr.evento_id=m.id
    left join ins on ins.evento_id=m.id
    left join met on met.evento_id=m.id
  ), resumo as (
    select count(*)::bigint eventos,
      coalesce(sum(visualizacoes),0)::bigint visualizacoes,
      coalesce(sum(compartilhamentos),0)::bigint compartilhamentos,
      coalesce(sum(favoritos),0)::bigint favoritos,
      coalesce(sum(interessados),0)::bigint interessados,
      coalesce(sum(inscritos),0)::bigint inscritos,
      coalesce(sum(espera),0)::bigint espera,
      coalesce(sum(checkins),0)::bigint checkins,
      count(*) filter(where data_evento<current_date and situacao<>'cancelado')::bigint realizados,
      count(*) filter(where situacao='cancelado')::bigint cancelados
    from linhas
  )
  select jsonb_build_object(
    'totais',jsonb_build_object(
      'eventos',r.eventos,'visualizacoes',r.visualizacoes,'compartilhamentos',r.compartilhamentos,
      'favoritos',r.favoritos,'interessados',r.interessados,'inscritos',r.inscritos,'espera',r.espera,'checkins',r.checkins,
      'taxa_comparecimento',case when r.inscritos>0 then round((r.checkins::numeric*100.0/r.inscritos),1) else null end
    ),
    'reputacao',jsonb_build_object(
      'eventos_realizados',r.realizados,'eventos_cancelados',r.cancelados,
      'taxa_realizacao',case when (r.realizados+r.cancelados)>0 then round((r.realizados::numeric*100.0/(r.realizados+r.cancelados)),1) else null end,
      'nivel',case
        when r.realizados>=5 and (r.realizados+r.cancelados)>0 and (r.realizados::numeric/(r.realizados+r.cancelados))>=0.90 then 'Histórico consistente'
        when r.realizados>=3 then 'Organizador frequente'
        when r.realizados>=1 then 'Em crescimento'
        else 'Novo organizador' end
    ),
    'eventos',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',l.id,'nome',l.nome,'data_evento',l.data_evento,'hora_evento',l.hora_evento,'situacao',l.situacao,
        'serie_id',l.serie_id,'recorrencia_ordem',l.recorrencia_ordem,'recorrencia_total',l.recorrencia_total,
        'visualizacoes',l.visualizacoes,'compartilhamentos',l.compartilhamentos,'favoritos',l.favoritos,
        'interessados',l.interessados,'inscritos',l.inscritos,'espera',l.espera,'checkins',l.checkins,
        'taxa_comparecimento',case when l.inscritos>0 then round((l.checkins::numeric*100.0/l.inscritos),1) else null end
      ) order by l.data_evento desc,l.hora_evento desc) from linhas l
    ),'[]'::jsonb)
  ) into v_resultado from resumo r;

  return coalesce(v_resultado,jsonb_build_object('totais','{}'::jsonb,'reputacao','{}'::jsonb,'eventos','[]'::jsonb));
end;
$$;

notify pgrst,'reload schema';