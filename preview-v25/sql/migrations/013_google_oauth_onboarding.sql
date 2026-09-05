-- Google OAuth + onboarding obrigatório (+18 e termos)
-- Novos logins Google criam um perfil incompleto. A conta só se torna ativa
-- depois que o usuário informa a data de nascimento e aceita regras/termos.

alter table public.perfis
  add column if not exists cadastro_completo boolean not null default true;

update public.perfis
set cadastro_completo = true
where cadastro_completo is distinct from true;

create or replace function private.conta_ativa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis p
    where p.id = auth.uid()
      and p.bloqueado = false
      and p.cadastro_completo = true
      and (p.suspenso_ate is null or p.suspenso_ate <= now())
      and p.exclusao_prevista is null
  );
$$;

create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  aceite boolean := coalesce((new.raw_user_meta_data->>'aceitou_regras')::boolean, false);
  versao text := coalesce(nullif(new.raw_user_meta_data->>'termos_versao',''), '1.0');
  nascimento date;
  provider text := coalesce(new.raw_app_meta_data->>'provider', '');
  providers jsonb := coalesce(new.raw_app_meta_data->'providers', '[]'::jsonb);
  login_google boolean := false;
  nome_social text;
  foto_social text;
begin
  login_google := provider = 'google' or providers ? 'google';

  if login_google then
    nome_social := coalesce(
      nullif(new.raw_user_meta_data->>'full_name',''),
      nullif(new.raw_user_meta_data->>'name',''),
      nullif(new.raw_user_meta_data->>'given_name',''),
      split_part(coalesce(new.email,''),'@',1),
      'Usuário'
    );
    foto_social := coalesce(
      nullif(new.raw_user_meta_data->>'avatar_url',''),
      nullif(new.raw_user_meta_data->>'picture','')
    );

    insert into public.perfis (
      id, nome, email, foto_url, data_nascimento,
      aceitou_regras, regras_aceitas_em,
      termos_versao, termos_aceitos_em,
      cadastro_completo
    ) values (
      new.id, nome_social, new.email, foto_social, null,
      false, null,
      null, null,
      false
    )
    on conflict (id) do nothing;

    return new;
  end if;

  if not aceite then
    raise exception 'É necessário aceitar as regras de convivência';
  end if;

  nascimento := nullif(new.raw_user_meta_data->>'data_nascimento','')::date;
  if nascimento is null then
    raise exception 'Informe a data de nascimento';
  end if;
  if nascimento > current_date or age(current_date, nascimento) < interval '18 years' then
    raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
  end if;

  insert into public.perfis (
    id, nome, email, data_nascimento,
    aceitou_regras, regras_aceitas_em,
    termos_versao, termos_aceitos_em,
    cadastro_completo
  ) values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome',''), split_part(new.email,'@',1)),
    new.email,
    nascimento,
    true, now(), versao, now(), true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function private.proteger_campos_sistema_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  onboarding_autorizado boolean := coalesce(current_setting('app.oauth_onboarding', true), '') = '1';
begin
  if auth.uid() = old.id and not private.eh_admin() then
    if new.papel is distinct from old.papel
       or new.bloqueado is distinct from old.bloqueado
       or new.email is distinct from old.email
       or new.id is distinct from old.id
       or new.criado_em is distinct from old.criado_em
       or new.aceitou_regras is distinct from old.aceitou_regras
       or new.regras_aceitas_em is distinct from old.regras_aceitas_em
       or new.termos_versao is distinct from old.termos_versao
       or new.termos_aceitos_em is distinct from old.termos_aceitos_em
       or new.cadastro_completo is distinct from old.cadastro_completo
       or new.suspenso_ate is distinct from old.suspenso_ate
       or new.advertencias is distinct from old.advertencias
       or new.exclusao_pedida_em is distinct from old.exclusao_pedida_em
       or new.exclusao_prevista is distinct from old.exclusao_prevista then
      if not onboarding_autorizado then
        raise exception 'Campos internos do perfil não podem ser alterados';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.concluir_cadastro_google(
  p_data_nascimento date,
  p_aceitou_regras boolean,
  p_termos_versao text default '1.0'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_provider text;
  v_providers jsonb;
  v_completo boolean;
begin
  if v_uid is null then
    raise exception 'É necessário estar autenticado';
  end if;

  select
    coalesce(u.raw_app_meta_data->>'provider',''),
    coalesce(u.raw_app_meta_data->'providers','[]'::jsonb)
  into v_provider, v_providers
  from auth.users u
  where u.id = v_uid;

  if v_provider <> 'google' and not (v_providers ? 'google') then
    raise exception 'Este fluxo é exclusivo para contas Google';
  end if;

  if not coalesce(p_aceitou_regras, false) then
    raise exception 'É necessário aceitar as regras e os termos de uso';
  end if;

  if p_data_nascimento is null then
    raise exception 'Informe a data de nascimento';
  end if;
  if p_data_nascimento > current_date then
    raise exception 'Data de nascimento inválida';
  end if;
  if age(current_date, p_data_nascimento) < interval '18 years' then
    raise exception 'É necessário ter 18 anos ou mais para usar a plataforma';
  end if;

  perform pg_catalog.set_config('app.oauth_onboarding', '1', true);

  update public.perfis
  set data_nascimento = p_data_nascimento,
      aceitou_regras = true,
      regras_aceitas_em = coalesce(regras_aceitas_em, now()),
      termos_versao = coalesce(nullif(p_termos_versao,''), '1.0'),
      termos_aceitos_em = coalesce(termos_aceitos_em, now()),
      cadastro_completo = true
  where id = v_uid
    and cadastro_completo = false;

  if not found then
    select p.cadastro_completo into v_completo
    from public.perfis p
    where p.id = v_uid;

    if coalesce(v_completo, false) then
      return jsonb_build_object('ok', true, 'ja_completo', true);
    end if;

    raise exception 'Perfil não encontrado para concluir o cadastro';
  end if;

  return jsonb_build_object('ok', true, 'ja_completo', false);
end;
$$;

revoke all on function public.concluir_cadastro_google(date, boolean, text) from public;
revoke all on function public.concluir_cadastro_google(date, boolean, text) from anon;
grant execute on function public.concluir_cadastro_google(date, boolean, text) to authenticated;
