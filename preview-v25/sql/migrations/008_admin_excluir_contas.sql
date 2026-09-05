-- ============================================================
-- ETAPA 8 — ADMIN PODE EXCLUIR CONTAS
-- Já aplicada no projeto Supabase conectado nesta conversa.
-- Pode ser guardada como referência/migração do projeto.
-- ============================================================

create or replace function public.admin_excluir_conta(p_usuario uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo public.perfis;
  admin_nome text;
  outros_admins integer;
begin
  if auth.uid() is null then
    raise exception 'Sessão necessária';
  end if;

  if not private.eh_admin() then
    raise exception 'Apenas administradores podem excluir contas';
  end if;

  if p_usuario is null then
    raise exception 'Usuário inválido';
  end if;

  if p_usuario = auth.uid() then
    raise exception 'Você não pode excluir sua própria conta pelo painel administrativo';
  end if;

  select * into alvo
  from public.perfis
  where id = p_usuario;

  if not found then
    raise exception 'Conta não encontrada';
  end if;

  if alvo.papel = 'admin' then
    select count(*)::int into outros_admins
    from public.perfis p
    where p.papel = 'admin'
      and p.id <> p_usuario
      and p.bloqueado = false
      and (p.suspenso_ate is null or p.suspenso_ate <= now())
      and p.exclusao_prevista is null;

    if outros_admins < 1 then
      raise exception 'Não é possível excluir o último administrador ativo';
    end if;
  end if;

  select p.nome into admin_nome
  from public.perfis p
  where p.id = auth.uid();

  insert into public.log_admin (
    admin_id, admin_nome, acao, alvo_tipo, alvo_id, detalhe
  ) values (
    auth.uid(), admin_nome, 'conta_excluida', 'usuario', alvo.id,
    coalesce(alvo.nome,'usuário') || ' · ' || coalesce(alvo.email,'sem e-mail')
  );

  delete from auth.users where id = p_usuario;

  if not found then
    raise exception 'Não foi possível excluir a conta de autenticação';
  end if;

  return jsonb_build_object(
    'ok', true,
    'usuario_id', p_usuario,
    'nome', alvo.nome,
    'email', alvo.email
  );
end;
$$;

revoke all on function public.admin_excluir_conta(uuid) from public;
revoke all on function public.admin_excluir_conta(uuid) from anon;
grant execute on function public.admin_excluir_conta(uuid) to authenticated;

notify pgrst, 'reload schema';
