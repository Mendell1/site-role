from pathlib import Path

root=Path(__file__).resolve().parents[1]

def read(path):
    return (root/path).read_text(encoding='utf-8')

arquivos=[
    'js/acesso-organizador-v25.js',
    'css/acesso-organizador-v25.css',
    'supabase/migrations/20260906040404_v25_9_papel_organizador_solicitacoes.sql',
    'supabase/migrations/20260906040535_v25_9_permissoes_organizador.sql',
    'supabase/migrations/20260906040909_v25_9_status_participacao_organizador_fix.sql',
]
for rel in arquivos:
    assert (root/rel).exists(), f'Arquivo V25.9 ausente: {rel}'

m1=read(arquivos[2]).lower()
for marcador in [
    "papel in ('usuario','organizador','admin')",
    'solicitacoes_organizador_v25_9',
    'solicitacao_organizador_pendente_uidx',
    'enable row level security',
    'private.pode_organizar()',
    'solicitar_organizador_v25_9',
    'cancelar_solicitacao_organizador_v25_9',
    'admin_decidir_solicitacao_organizador_v25_9',
    'admin_conceder_organizador_v25_9',
    'admin_revogar_organizador_v25_9',
    "papel='organizador'",
    "papel='usuario'",
    'organizador_revogacao_motivo',
    'insert into public.log_admin',
    'insert into public.notificacoes',
]:
    assert marcador in m1, f'Migration de papel V25.9 incompleta: {marcador}'

m2=read(arquivos[3]).lower()
for marcador in [
    'eventos_criar_proprio',
    'private.pode_organizar()',
    'eventos_storage_upload_proprio',
    'seguidores_insert_proprio',
    'inscricoes_select_v25_2',
    'coment_apagar',
    'perfil_publico_v25',
    'admin_definir_verificacao_v25',
    'somente organizadores podem receber o selo de verificação',
    'participantes_evento_v25_2_impl',
    'checkin_ingresso_v25_3_impl',
    'painel_evento_v25_3_impl',
    'participantes_evento_v25_3_impl',
    'criar_eventos_recorrentes_v25_6',
    'painel_organizador_v25_7',
]:
    assert marcador in m2, f'Migration de permissões V25.9 incompleta: {marcador}'

m3=read(arquivos[4]).lower()
assert "'sou_organizador'" in m3
assert 'private.pode_organizar()' in m3

js=read('js/acesso-organizador-v25.js')
for marcador in [
    "['organizador','admin'].includes(perfil.papel)",
    'Quero publicar eventos',
    'organizador-v25-9',
    'solicitar_organizador_v25_9',
    'cancelar_solicitacao_organizador_v25_9',
    'admin_decidir_solicitacao_organizador_v25_9',
    'admin_conceder_organizador_v25_9',
    'admin_revogar_organizador_v25_9',
    'admin_definir_verificacao_v25',
    'MEMBRO DO ROLÊ',
    'ORGANIZADOR DO ROLÊ',
    'ADMINISTRADOR DO ROLÊ',
    'data-v259-aprovar',
    'data-v259-revogar',
    '#btnPublicar',
    '[data-v253-scanner]',
]:
    assert marcador in js, f'Frontend V25.9 incompleto: {marcador}'

css=read('css/acesso-organizador-v25.css')
for marcador in ['.v259-card','.v259-checklist','.v259-admin-bloco','.v259-aprovado','@media(max-width:760px)']:
    assert marcador in css, f'CSS V25.9 incompleto: {marcador}'

config=read('js/config.js')
assert "estilo('css/acesso-organizador-v25.css','v25-9-organizador')" in config
assert "script('js/acesso-organizador-v25.js','v25-9-organizador')" in config
assert "eh('index.html','perfil.html','admin.html','organizador.html')" in config

sw=read('sw-v25.js')
assert "CACHE_ATUAL = 'role-v25-9-shell-v1'" in sw
assert './css/acesso-organizador-v25.css' in sw
assert './js/acesso-organizador-v25.js' in sw

print('V25.9 static tests: OK')
