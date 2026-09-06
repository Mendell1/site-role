from pathlib import Path

root = Path(__file__).resolve().parents[1]

def read(path):
    return (root / path).read_text(encoding='utf-8')

for rel in [
    'js/recorrencia-v25.js',
    'js/mapa-raio-v25.js',
    'css/v25-6.css',
    'supabase/migrations/20260906002000_v25_6_eventos_recorrentes.sql',
]:
    assert (root / rel).exists(), f'Arquivo V25.6 ausente: {rel}'

config = read('js/config.js')
for marcador in [
    "estilo('css/v25-6.css','v25-6')",
    "script('js/recorrencia-v25.js','v25-6-recorrencia')",
    "script('js/mapa-raio-v25.js','v25-6-mapa-raio')",
]:
    assert marcador in config, f'Loader V25.6 incompleto: {marcador}'

sql = read('supabase/migrations/20260906002000_v25_6_eventos_recorrentes.sql')
for marcador in [
    'serie_id uuid',
    'recorrencia_tipo text',
    'recorrencia_intervalo smallint',
    'recorrencia_ordem smallint',
    'recorrencia_total smallint',
    'eventos_serie_ordem_uidx',
    'security invoker',
    'criar_eventos_recorrentes_v25_6',
    "p_tipo not in ('semanal','mensal')",
    'p_quantidade < 2 or p_quantidade > 52',
    'revoke all on function public.criar_eventos_recorrentes_v25_6',
    'grant execute on function public.criar_eventos_recorrentes_v25_6',
    'new.serie_id is not null',
    'new.recorrencia_ordem,1) > 1',
]:
    assert marcador.lower() in sql.lower(), f'Migration V25.6 incompleta: {marcador}'

rec = read('js/recorrencia-v25.js')
for marcador in [
    'f_recorrente',
    'f_rec_tipo',
    'f_rec_intervalo',
    'f_rec_quantidade',
    'criar_eventos_recorrentes_v25_6',
    'Criando série...',
    'data-v256-excluir-modo="esta"',
    'data-v256-excluir-modo="futuras"',
    'recorrencia_ordem',
    'recorrencia_total',
    'imagem é compartilhada pela série',
    'stopImmediatePropagation',
]:
    assert marcador in rec, f'Recorrência V25.6 incompleta: {marcador}'

mapa = read('js/mapa-raio-v25.js')
for marcador in [
    '[1,5,10,25]',
    'p_raio_km:estadoRaio.raioKm',
    'eventos_perto_de_mim',
    'RoleMapaRaioV256',
    'renderMapaRaio',
    'L.circle(',
    'Você está aqui',
    'stopImmediatePropagation',
    'EVENTOS=estadoRaio.eventos',
]:
    assert marcador in mapa, f'Mapa por raio V25.6 incompleto: {marcador}'

css = read('css/v25-6.css')
for marcador in [
    '.v256-recorrencia',
    '.v256-serie-card',
    '.v256-raio',
    '.v256-distancia',
    '@media(max-width:760px)',
]:
    assert marcador in css, f'CSS V25.6 incompleto: {marcador}'

sw = read('sw-v25.js')
assert "const CACHE_ATUAL = 'role-v" in sw
assert './css/v25-6.css' in sw
assert './js/recorrencia-v25.js' in sw
assert './js/mapa-raio-v25.js' in sw

print('V25.6 static tests: OK')
