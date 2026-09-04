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

print('Smoke tests: OK')
