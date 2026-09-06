from pathlib import Path

root=Path(__file__).resolve().parents[1]

def read(path):
    return (root/path).read_text(encoding='utf-8')

for rel in [
    'js/metricas-organizador-v25.js',
    'css/v25-7.css',
    'supabase/migrations/20260906005500_v25_7_metricas_reputacao_organizador.sql',
]:
    assert (root/rel).exists(), f'Arquivo V25.7 ausente: {rel}'

config=read('js/config.js')
for marcador in [
    "estilo('css/v25-7.css','v25-7')",
    "script('js/metricas-organizador-v25.js','v25-7-metricas')",
    "eh('index.html','perfil.html','organizador.html')",
]:
    assert marcador in config, f'Loader V25.7 incompleto: {marcador}'

sql=read('supabase/migrations/20260906005500_v25_7_metricas_reputacao_organizador.sql')
for marcador in [
    'evento_metricas_v25_7',
    'alter table public.evento_metricas_v25_7 enable row level security',
    'revoke all on table public.evento_metricas_v25_7 from anon, authenticated',
    'registrar_visualizacao_evento_v25_7',
    'registrar_compartilhamento_evento_v25_7',
    'painel_organizador_v25_7',
    'reputacao_organizador_v25_7',
    'security invoker',
    'auth.uid() = v_criador',
    "x.status='inscrito'",
    "x.status='espera'",
    'x.checkin_em is not null',
    "r.realizados >= 5",
    "'Histórico consistente'",
]:
    assert marcador.lower() in sql.lower(), f'Migration V25.7 incompleta: {marcador}'

js=read('js/metricas-organizador-v25.js')
for marcador in [
    'registrar_visualizacao_evento_v25_7',
    'role_v257_view_',
    'registrar_compartilhamento_evento_v25_7',
    '[data-v23-share],[data-v23-whatsapp],[data-v23-copy],[data-v23-qr]',
    'painel_organizador_v25_7',
    'data-tab',
    'painel-v25-7',
    'Visualizações',
    'Favoritos',
    'Interessados',
    'Inscritos',
    'Check-ins',
    'Compartilhamentos',
    'reputacao_organizador_v25_7',
    'REPUTAÇÃO POR HISTÓRICO',
]:
    assert marcador in js, f'Frontend V25.7 incompleto: {marcador}'

css=read('css/v25-7.css')
for marcador in [
    '.v257-kpis',
    '.v257-reputacao-painel',
    '.v257-funil',
    '.v257-evento-metricas',
    '.v257-reputacao-publica',
    '@media(max-width:760px)',
]:
    assert marcador in css, f'CSS V25.7 incompleto: {marcador}'

sw=read('sw-v25.js')
assert "CACHE_ATUAL = 'role-v" in sw
assert './css/v25-7.css' in sw
assert './js/metricas-organizador-v25.js' in sw

print('V25.7 static tests: OK')
