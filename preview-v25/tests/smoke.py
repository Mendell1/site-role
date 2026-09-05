from pathlib import Path

root = Path(__file__).resolve().parents[1]

def read(path):
    return (root / path).read_text(encoding='utf-8')

required = [
    'index.html','perfil.html','admin.html','organizador.html',
    'js/app.js','js/auth.js','js/google-auth.js','js/perfil.js','js/recursos-v23.js',
    'js/admin.js','js/admin-dashboard.js','js/organizador.js',
    'css/estilo.css','css/mobile-responsive.css','css/google-auth.css','css/recursos-v23.css',
    'supabase/migrations/20260904040500_google_oauth_onboarding.sql',
    'supabase/migrations/20260904122830_v24_consolidacao_seguranca_performance.sql'
]
for rel in required:
    assert (root / rel).exists(), f'Arquivo obrigatório ausente: {rel}'

index = read('index.html')
assert 'css/recursos-v23.css' in index
assert 'js/recursos-v23.js' in index
assert index.index('js/app.js') < index.index('js/recursos-v23.js')

perfil = read('js/perfil.js')
assert 'role_exclusao_google_reauth_at' in perfil
assert 'RECUPERACAO_COOLDOWN_MS_PERFIL' in perfil
assert 'await carregarEventosPerfil();' in perfil

config = read('js/config.js').lower()
for linha in config.splitlines():
    if '=' not in linha:
        continue
    assert 'service_role' not in linha, 'service_role atribuído no frontend'
    assert 'sb_secret_' not in linha, 'chave secreta atribuída no frontend'

# V25.1 — comunidade experimental
for pagina_v25 in ['organizador.html','perfil.html','admin.html']:
    html_v25 = read(pagina_v25)
    assert 'css/comunidade-v25.css' in html_v25, f'CSS V25 ausente em {pagina_v25}'
    assert 'js/comunidade-v25.js' in html_v25, f'JS V25 ausente em {pagina_v25}'

comunidade = read('js/comunidade-v25.js')
for marcador in ['perfil_publico_v25','meus_organizadores_seguidos_v25','admin_definir_verificacao_v25','alertas_eventos','seguidores_organizadores']:
    assert marcador in comunidade, f'Integração V25 ausente: {marcador}'

for migration_v25 in [
    'supabase/migrations/20260904125917_v25_1_comunidade_seguidores_alertas_verificacao.sql',
    'supabase/migrations/20260904132149_v25_1_perfil_publico_comunidade_fix.sql'
]:
    assert (root / migration_v25).exists(), f'Migration V25 ausente: {migration_v25}'

print('Smoke tests: OK')
