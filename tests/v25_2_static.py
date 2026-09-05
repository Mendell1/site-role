from pathlib import Path

root = Path(__file__).resolve().parents[1]
js = (root / 'js' / 'participacao-v25.js').read_text(encoding='utf-8')
css = (root / 'css' / 'participacao-v25.css').read_text(encoding='utf-8')
config = (root / 'js' / 'config.js').read_text(encoding='utf-8')
migration = (root / 'supabase' / 'migrations' / '20260905004604_v25_2_participacao_vagas_lista_espera.sql').read_text(encoding='utf-8')

for rpc in [
    'participar_evento_v25_2',
    'cancelar_participacao_v25_2',
    'status_participacao_v25_2',
    'minhas_inscricoes_v25_2',
    'participantes_evento_v25_2',
]:
    assert rpc in js, f'frontend sem RPC {rpc}'
    assert rpc in migration, f'migration sem RPC {rpc}'

assert 'inscricoes_eventos' in migration
assert 'pg_advisory_xact_lock' in migration
assert 'promover_lista_espera_v25_2' in migration
assert "status in ('inscrito','espera','cancelado')" in migration
assert 'participacao-v25.js' in config
assert 'participacao-v25.css' in config
assert '.v252-card' in css
print('V25.2 static checks: OK')
