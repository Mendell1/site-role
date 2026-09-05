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
    assert marcador in comunidade, f'Integração V25.1 ausente: {marcador}'

for migration_v25 in [
    'supabase/migrations/20260904125917_v25_1_comunidade_seguidores_alertas_verificacao.sql',
    'supabase/migrations/20260904132149_v25_1_perfil_publico_comunidade_fix.sql'
]:
    assert (root / migration_v25).exists(), f'Migration V25.1 ausente: {migration_v25}'

# V25.2 — inscrição, vagas e lista de espera
for rel in [
    'js/participacao-v25.js','css/participacao-v25.css',
    'supabase/migrations/20260905004604_v25_2_participacao_vagas_lista_espera.sql'
]:
    assert (root / rel).exists(), f'Arquivo V25.2 ausente: {rel}'
participacao = read('js/participacao-v25.js')
for marcador in ['participar_evento_v25_2','cancelar_participacao_v25_2','minhas_inscricoes_v25_2','participantes_evento_v25_2']:
    assert marcador in participacao, f'Integração V25.2 ausente: {marcador}'
assert 'js/participacao-v25.js' in read('js/config.js')

# V25.3 — ingresso QR, check-in e painel presencial
for rel in [
    'js/checkin-v25.js','css/checkin-v25.css','js/qr-compat-v25.js',
    'supabase/migrations/20260905012657_v25_3_ingresso_qr_checkin.sql'
]:
    assert (root / rel).exists(), f'Arquivo V25.3 ausente: {rel}'
checkin = read('js/checkin-v25.js')
for marcador in ['meu_ingresso_v25_3','checkin_ingresso_v25_3','painel_evento_v25_3','participantes_evento_v25_3','desfazer_checkin_v25_3','BarcodeDetector']:
    assert marcador in checkin, f'Integração V25.3 ausente: {marcador}'
config_original = read('js/config.js')
for marcador in ['js/checkin-v25.js','css/checkin-v25.css','js/qr-compat-v25.js']:
    assert marcador in config_original, f'Loader V25.3 ausente: {marcador}'

# V25.4 — PWA, recomendações, busca inteligente e Web Push
for rel in [
    'manifest.webmanifest','sw-v25.js',
    'assets/icon-192.png','assets/icon-512.png',
    'js/pwa-v25.js','css/pwa-v25.css',
    'js/inteligencia-v25.js','css/inteligencia-v25.css',
    'js/push-v25.js','css/push-v25.css',
    'supabase/migrations/20260905023311_v25_4_recomendacoes_busca_inteligente.sql',
    'supabase/migrations/20260905023719_v25_4_web_push.sql',
    'supabase/migrations/20260905023953_v25_4_push_remover_fix.sql',
    'supabase/functions/push-notificar-v25-4/index.ts'
]:
    assert (root / rel).exists(), f'Arquivo V25.4 ausente: {rel}'

manifest = read('manifest.webmanifest')
for marcador in ['"display": "standalone"','assets/icon-192.png','assets/icon-512.png']:
    assert marcador in manifest, f'Manifest PWA incompleto: {marcador}'

pwa = read('js/pwa-v25.js')
for marcador in ['beforeinstallprompt','serviceWorker.register','manifest.webmanifest','appinstalled']:
    assert marcador in pwa, f'Integração PWA ausente: {marcador}'

sw = read('sw-v25.js')
for marcador in ['CACHE_ATUAL','request.method','requisicaoPrivadaOuApi','notificationclick','showNotification']:
    assert marcador in sw, f'Service Worker V25.4 incompleto: {marcador}'
assert "url.origin !== self.location.origin" in sw, 'Service Worker não protege chamadas externas do Supabase'

inteligencia = read('js/inteligencia-v25.js')
for marcador in ['buscar_eventos_inteligente_v25_4','recomendacoes_v25_4','Para você','BUSCA INTELIGENTE']:
    assert marcador in inteligencia, f'Integração inteligente V25.4 ausente: {marcador}'

migration_v254 = read('supabase/migrations/20260905023311_v25_4_recomendacoes_busca_inteligente.sql')
for marcador in ['buscar_eventos_inteligente_v25_4','recomendacoes_v25_4_impl','extensions.similarity','seguidores_organizadores','alertas_eventos']:
    assert marcador in migration_v254, f'Migration inteligente V25.4 incompleta: {marcador}'

push = read('js/push-v25.js')
for marcador in ['PushManager','Notification.requestPermission','pushManager.subscribe','salvar_push_v25_4','remover_push_v25_4']:
    assert marcador in push, f'Integração Web Push ausente: {marcador}'

push_migration = read('supabase/migrations/20260905023719_v25_4_web_push.sql')
for marcador in ['push_assinaturas_v25_4','push_entregas_v25_4','push_config_v25_4','trg_notificacao_push_v25_4','net.http_post']:
    assert marcador in push_migration, f'Migration Web Push incompleta: {marcador}'
# Segredos reais nunca devem aparecer na migration ou no frontend.
assert 'private_key text' in push_migration
assert 'webhook_secret text' in push_migration
assert 'insert into private.push_config_v25_4' not in push_migration.lower(), 'Segredo VAPID não deve ser versionado'

push_fix = read('supabase/migrations/20260905023953_v25_4_push_remover_fix.sql')
assert 'v_count integer' in push_fix and 'row_count' in push_fix

edge = read('supabase/functions/push-notificar-v25-4/index.ts')
for marcador in ['web-push','push_config_servidor_v25_4','push_assinaturas_v25_4','push_entregas_v25_4','sendNotification']:
    assert marcador in edge, f'Edge Function de Push incompleta: {marcador}'
assert 'SUPABASE_SERVICE_ROLE_KEY' in edge
assert 'webhook_secret' in edge

for marcador in [
    'js/pwa-v25.js','css/pwa-v25.css',
    'js/inteligencia-v25.js','css/inteligencia-v25.css',
    'js/push-v25.js','css/push-v25.css'
]:
    assert marcador in config_original, f'Loader V25.4 ausente: {marcador}'

print('Smoke tests: OK')
