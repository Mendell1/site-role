-- ROLÊ V25.9 — índices para FKs do fluxo de organizador
create index if not exists perfis_organizador_aprovado_por_idx
  on public.perfis(organizador_aprovado_por)
  where organizador_aprovado_por is not null;

create index if not exists perfis_organizador_revogado_por_idx
  on public.perfis(organizador_revogado_por)
  where organizador_revogado_por is not null;

create index if not exists solicitacoes_organizador_analisado_por_idx
  on public.solicitacoes_organizador_v25_9(analisado_por)
  where analisado_por is not null;
