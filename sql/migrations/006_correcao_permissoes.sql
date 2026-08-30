-- ============================================================
-- CORREÇÃO — "permission denied for function eh_admin"
--
-- As políticas de RLS de eventos e comentarios chamam eh_admin()
-- para decidir o que cada um enxerga. Quem executa essa chamada
-- é o próprio visitante, no papel "anon" — e ele precisa ter
-- permissão de EXECUTE na função.
--
-- Projetos recentes do Supabase não concedem isso por padrão,
-- então a consulta falhava justamente para quem não tem conta.
--
-- Liberar a EXECUÇÃO não é liberar privilégio: a função só
-- devolve verdadeiro ou falso sobre quem está chamando. Ela
-- consulta auth.uid(), que vem da sessão validada no servidor
-- e não pode ser forjada pelo navegador. Um visitante executá-la
-- resulta sempre em "false".
--
-- Rode o arquivo inteiro no SQL Editor.
-- ============================================================

grant execute on function public.eh_admin()                  to anon, authenticated;
grant execute on function public.idade_em_anos(date)         to anon, authenticated;
grant execute on function public.limpar_denuncias_antigas()  to authenticated;
grant execute on function public.excluir_minha_conta()       to authenticated;

-- as views precisam estar visíveis para os dois papéis
grant select on public.eventos_lista      to anon, authenticated;
grant select on public.comentarios_lista  to anon, authenticated;
grant select on public.denuncias_lista    to authenticated;


-- ------------------------------------------------------------
-- Conferência: as três primeiras devem responder para anon
-- ------------------------------------------------------------
select
  p.proname                                   as funcao,
  has_function_privilege('anon',          p.oid, 'execute') as anon_pode,
  has_function_privilege('authenticated', p.oid, 'execute') as logado_pode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('eh_admin','idade_em_anos','limpar_denuncias_antigas','excluir_minha_conta')
order by p.proname;
