-- ============================================================
-- ROLÊ V25.8 — análise pré-publicação
-- Similaridade textual para duplicados + sinais objetivos de spam.
-- A camada generativa fica na Edge Function; esta função funciona
-- mesmo quando um provedor de IA estiver indisponível.
-- ============================================================

create or replace function public.analisar_evento_v25_8(
  p_nome text,
  p_descricao text default null,
  p_data date default null,
  p_cidade text default null,
  p_evento_ignorar uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_nome text := btrim(coalesce(p_nome,''));
  v_desc text := btrim(coalesce(p_descricao,''));
  v_spam integer := 0;
  v_avisos text[] := array[]::text[];
  v_duplicados jsonb := '[]'::jsonb;
  v_max_sim numeric := 0;
  v_risco text := 'baixo';
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária';
  end if;
  if char_length(v_nome) < 3 then
    raise exception 'Informe um nome de evento válido';
  end if;

  if char_length(v_desc) > 0 and char_length(v_desc) < 20 then
    v_spam := v_spam + 1;
    v_avisos := array_append(v_avisos,'A descrição está muito curta para explicar bem o evento.');
  end if;
  if v_nome ~ '[!?$.]{5,}' or v_desc ~ '[!?$.]{7,}' then
    v_spam := v_spam + 1;
    v_avisos := array_append(v_avisos,'Há pontuação excessivamente repetida no texto.');
  end if;
  if lower(v_nome||' '||v_desc) ~ '(ganhe dinheiro|renda garantida|pix agora|clique aqui agora|lucro garantido|dinheiro f[aá]cil)' then
    v_spam := v_spam + 2;
    v_avisos := array_append(v_avisos,'O texto contém expressões frequentemente associadas a divulgação enganosa.');
  end if;
  if (length(lower(v_desc))-length(replace(lower(v_desc),'http',''))) / 4 >= 3 then
    v_spam := v_spam + 1;
    v_avisos := array_append(v_avisos,'A descrição contém muitos links.');
  end if;
  if char_length(v_nome) >= 12 and v_nome = upper(v_nome) and v_nome <> lower(v_nome) then
    v_avisos := array_append(v_avisos,'Evite escrever o título inteiro em letras maiúsculas.');
  end if;

  with candidatos as (
    select
      e.id,
      e.nome,
      e.data_evento,
      e.bairro,
      e.cidade,
      greatest(
        extensions.similarity(lower(e.nome),lower(v_nome)),
        extensions.similarity(lower(coalesce(e.descricao,'')),lower(v_desc))*0.72
      )::numeric as similaridade
    from public.eventos e
    where e.ativo=true
      and (p_evento_ignorar is null or e.id<>p_evento_ignorar)
      and (p_cidade is null or btrim(p_cidade)='' or lower(e.cidade)=lower(btrim(p_cidade)))
      and (p_data is null or e.data_evento between p_data-14 and p_data+14)
      and (
        extensions.similarity(lower(e.nome),lower(v_nome)) >= 0.28
        or (v_desc<>'' and extensions.similarity(lower(coalesce(e.descricao,'')),lower(v_desc)) >= 0.24)
      )
    order by similaridade desc, e.data_evento asc
    limit 5
  ), agregado as (
    select
      coalesce(max(similaridade),0)::numeric max_sim,
      coalesce(jsonb_agg(jsonb_build_object(
        'id',id,
        'nome',nome,
        'data_evento',data_evento,
        'bairro',bairro,
        'cidade',cidade,
        'similaridade',round(similaridade*100,0)
      ) order by similaridade desc),'[]'::jsonb) itens
    from candidatos
  )
  select max_sim,itens into v_max_sim,v_duplicados from agregado;

  if v_max_sim >= 0.80 or v_spam >= 3 then
    v_risco := 'alto';
  elsif v_max_sim >= 0.56 or v_spam >= 1 then
    v_risco := 'medio';
  else
    v_risco := 'baixo';
  end if;

  if v_max_sim >= 0.56 then
    v_avisos := array_append(v_avisos,'Encontramos outro evento parecido em data/local próximos. Confira antes de publicar.');
  end if;

  return jsonb_build_object(
    'risco',v_risco,
    'pontuacao_spam',v_spam,
    'similaridade_maxima',round(v_max_sim*100,0),
    'avisos',to_jsonb(v_avisos),
    'duplicados',v_duplicados
  );
end;
$$;

revoke all on function public.analisar_evento_v25_8(text,text,date,text,uuid) from public, anon;
grant execute on function public.analisar_evento_v25_8(text,text,date,text,uuid) to authenticated;
