-- Etapa 9 — leitura pública sem login
-- Corrige o erro "permission denied for function eh_admin" para visitantes.

drop policy if exists coment_ler on public.comentarios;
drop policy if exists coment_admin on public.comentarios;

create policy coment_ler_publico
on public.comentarios
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.eventos e
    where e.id = comentarios.evento_id
      and e.ativo = true
  )
);

create policy coment_admin
on public.comentarios
for all
to authenticated
using (private.eh_admin())
with check (private.eh_admin());

drop policy if exists hist_admin on public.denuncia_historico;
create policy hist_admin
on public.denuncia_historico
for all
to authenticated
using (private.eh_admin())
with check (private.eh_admin());

drop policy if exists log_ler on public.log_admin;
create policy log_ler
on public.log_admin
for select
to authenticated
using (private.eh_admin());
