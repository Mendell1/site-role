-- ROLÊ V24 — consolidação de segurança, performance e exclusão com reautenticação

create index if not exists comentarios_autor_id_idx on public.comentarios(autor_id);
create index if not exists denuncia_historico_ator_id_idx on public.denuncia_historico(ator_id);
create index if not exists denuncias_denunciado_id_idx on public.denuncias(denunciado_id);
create index if not exists log_admin_admin_id_idx on public.log_admin(admin_id);
create index if not exists notificacoes_denuncia_id_idx on public.notificacoes(denuncia_id);
drop index if exists public.denuncias_status_idx;

update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id = 'avatares';

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id = 'eventos';

drop policy if exists avatar_enviar on storage.objects;
drop policy if exists avatar_trocar on storage.objects;
drop policy if exists avatar_apagar on storage.objects;
create policy avatar_enviar on storage.objects for insert to authenticated
with check (bucket_id='avatares' and (storage.foldername(name))[1]=(select auth.uid())::text and private.conta_ativa());
create policy avatar_trocar on storage.objects for update to authenticated
using (bucket_id='avatares' and owner=(select auth.uid()) and (storage.foldername(name))[1]=(select auth.uid())::text and private.conta_ativa())
with check (bucket_id='avatares' and owner=(select auth.uid()) and (storage.foldername(name))[1]=(select auth.uid())::text and private.conta_ativa());
create policy avatar_apagar on storage.objects for delete to authenticated
using (bucket_id='avatares' and owner=(select auth.uid()) and (storage.foldername(name))[1]=(select auth.uid())::text and private.conta_ativa());

-- RLS otimizado e sem policies permissivas duplicadas nas operações principais.
drop policy if exists admin_select_perfis on public.perfis;
drop policy if exists admin_update_perfis on public.perfis;
drop policy if exists perfil_select_proprio on public.perfis;
drop policy if exists perfil_update_proprio on public.perfis;
create policy perfil_select_autenticado on public.perfis for select to authenticated
using ((select auth.uid())=id or private.eh_admin());
create policy perfil_update_autenticado on public.perfis for update to authenticated
using ((((select auth.uid())=id) and private.conta_ativa()) or private.eh_admin())
with check ((((select auth.uid())=id) and private.conta_ativa()) or private.eh_admin());

drop policy if exists favoritos_select_proprio on public.favoritos;
drop policy if exists favoritos_insert_proprio on public.favoritos;
drop policy if exists favoritos_delete_proprio on public.favoritos;
create policy favoritos_select_proprio on public.favoritos for select to authenticated using ((select auth.uid())=usuario_id);
create policy favoritos_insert_proprio on public.favoritos for insert to authenticated with check ((select auth.uid())=usuario_id and private.conta_ativa());
create policy favoritos_delete_proprio on public.favoritos for delete to authenticated using ((select auth.uid())=usuario_id and private.conta_ativa());

drop policy if exists interesses_select_proprio on public.interesses;
drop policy if exists interesses_insert_proprio on public.interesses;
drop policy if exists interesses_delete_proprio on public.interesses;
create policy interesses_select_proprio on public.interesses for select to authenticated using ((select auth.uid())=usuario_id);
create policy interesses_insert_proprio on public.interesses for insert to authenticated with check ((select auth.uid())=usuario_id and private.conta_ativa());
create policy interesses_delete_proprio on public.interesses for delete to authenticated using ((select auth.uid())=usuario_id and private.conta_ativa());

drop policy if exists admin_select_eventos on public.eventos;
drop policy if exists admin_update_eventos on public.eventos;
drop policy if exists admin_delete_eventos on public.eventos;
drop policy if exists eventos_leitura_publica on public.eventos;
drop policy if exists eventos_criar_proprio on public.eventos;
drop policy if exists eventos_editar_proprio on public.eventos;
drop policy if exists eventos_excluir_proprio on public.eventos;
create policy eventos_leitura_anon on public.eventos for select to anon using (ativo=true);
create policy eventos_leitura_autenticado on public.eventos for select to authenticated using (ativo=true or private.eh_admin());
create policy eventos_criar_proprio on public.eventos for insert to authenticated with check ((select auth.uid())=criador_id and private.conta_ativa());
create policy eventos_editar_autenticado on public.eventos for update to authenticated
using ((((select auth.uid())=criador_id) and private.conta_ativa()) or private.eh_admin())
with check ((((select auth.uid())=criador_id) and private.conta_ativa()) or private.eh_admin());
create policy eventos_excluir_autenticado on public.eventos for delete to authenticated
using ((((select auth.uid())=criador_id) and private.conta_ativa()) or private.eh_admin());

drop policy if exists coment_admin on public.comentarios;
drop policy if exists coment_ler_publico on public.comentarios;
drop policy if exists coment_criar on public.comentarios;
drop policy if exists coment_editar on public.comentarios;
drop policy if exists coment_apagar on public.comentarios;
create policy coment_ler_anon on public.comentarios for select to anon
using (exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.ativo=true));
create policy coment_ler_autenticado on public.comentarios for select to authenticated
using (exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.ativo=true) or private.eh_admin());
create policy coment_criar on public.comentarios for insert to authenticated
with check ((((select auth.uid())=autor_id) and private.conta_ativa() and exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.ativo=true)) or private.eh_admin());
create policy coment_editar on public.comentarios for update to authenticated
using ((((select auth.uid())=autor_id) and private.conta_ativa()) or private.eh_admin())
with check ((((select auth.uid())=autor_id) and private.conta_ativa()) or private.eh_admin());
create policy coment_apagar on public.comentarios for delete to authenticated
using ((private.conta_ativa() and ((select auth.uid())=autor_id or exists(select 1 from public.eventos e where e.id=comentarios.evento_id and e.criador_id=(select auth.uid())))) or private.eh_admin());

drop policy if exists notif_ler on public.notificacoes;
drop policy if exists notif_marcar on public.notificacoes;
drop policy if exists notif_apagar on public.notificacoes;
create policy notif_ler on public.notificacoes for select to authenticated using ((select auth.uid())=usuario_id);
create policy notif_marcar on public.notificacoes for update to authenticated using ((select auth.uid())=usuario_id) with check ((select auth.uid())=usuario_id);
create policy notif_apagar on public.notificacoes for delete to authenticated using ((select auth.uid())=usuario_id);

drop policy if exists admin_select_denuncias on public.denuncias;
drop policy if exists den_ler_proprias on public.denuncias;
create policy denuncias_select_autenticado on public.denuncias for select to authenticated
using ((select auth.uid())=usuario_id or private.eh_admin());

drop policy if exists hist_admin on public.denuncia_historico;
drop policy if exists hist_autor on public.denuncia_historico;
create policy hist_select_autenticado on public.denuncia_historico for select to authenticated
using (private.eh_admin() or exists(select 1 from public.denuncias d where d.id=denuncia_historico.denuncia_id and d.usuario_id=(select auth.uid())));
create policy hist_admin_insert on public.denuncia_historico for insert to authenticated with check (private.eh_admin());
create policy hist_admin_update on public.denuncia_historico for update to authenticated using (private.eh_admin()) with check (private.eh_admin());
create policy hist_admin_delete on public.denuncia_historico for delete to authenticated using (private.eh_admin());

create or replace function public.solicitar_exclusao_conta()
returns timestamptz
language plpgsql
security definer
set search_path=''
as $$
declare
  eu uuid:=auth.uid();
  prazo timestamptz:=now()+interval '7 days';
  auth_em bigint;
  agora_epoch bigint:=floor(extract(epoch from now()))::bigint;
begin
  if eu is null then raise exception 'Nenhuma sessão ativa'; end if;
  select max(nullif(x->>'timestamp','')::bigint) into auth_em
  from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) x;
  auth_em:=coalesce(auth_em,nullif(auth.jwt()->>'iat','')::bigint);
  if auth_em is null or agora_epoch-auth_em>600 then
    raise exception 'Confirme sua identidade novamente antes de excluir a conta';
  end if;
  update public.perfis set exclusao_pedida_em=now(),exclusao_prevista=prazo where id=eu;
  return prazo;
end;
$$;
revoke all on function public.solicitar_exclusao_conta() from public,anon;
grant execute on function public.solicitar_exclusao_conta() to authenticated;

notify pgrst,'reload schema';
