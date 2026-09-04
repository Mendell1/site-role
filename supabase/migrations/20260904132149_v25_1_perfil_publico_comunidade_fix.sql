-- ROLÊ V25.1 — compatibilidade do perfil público com recursos de comunidade

drop function if exists public.perfil_publico(uuid);

create function public.perfil_publico(p_usuario uuid)
returns table(
  id uuid,
  nome text,
  foto_url text,
  bio text,
  cidade text,
  contato text,
  criado_em timestamptz,
  total_eventos bigint,
  verificado boolean,
  seguidores_total integer
)
language sql
stable
security definer
set search_path=''
as $$
  select
    p.id,
    p.nome,
    p.foto_url,
    p.bio,
    p.cidade,
    p.contato,
    p.criado_em,
    (
      select count(*)
      from public.eventos e
      where e.criador_id=p.id
        and e.ativo=true
        and e.data_evento>=current_date
    )::bigint,
    p.verificado,
    p.seguidores_total
  from public.perfis p
  where p.id=p_usuario
    and p.bloqueado=false
    and p.exclusao_prevista is null
    and (p.suspenso_ate is null or p.suspenso_ate<=now());
$$;

revoke all on function public.perfil_publico(uuid) from public;
grant execute on function public.perfil_publico(uuid) to anon, authenticated;

notify pgrst,'reload schema';
