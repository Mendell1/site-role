create or replace function private.remover_push_v25_4_impl(p_endpoint text) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_count integer:=0;
begin
  if auth.uid() is null then raise exception 'É preciso entrar na conta'; end if;
  update public.push_assinaturas_v25_4 set ativo=false,atualizado_em=now()
  where usuario_id=auth.uid() and endpoint=p_endpoint and ativo=true;
  get diagnostics v_count = row_count;
  return v_count>0;
end;
$$;
revoke all on function private.remover_push_v25_4_impl(text) from public,anon;
grant execute on function private.remover_push_v25_4_impl(text) to authenticated;
