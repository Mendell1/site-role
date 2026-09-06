from pathlib import Path

root=Path(__file__).resolve().parents[1]

def read(path):
    return (root/path).read_text(encoding='utf-8')

for rel in ['css/v26-home.css','js/v26-home.js']:
    assert (root/rel).exists(), f'Arquivo V26.1 ausente: {rel}'

css=read('css/v26-home.css')
for marcador in [
    'body.v26-home',
    '.v26-nav',
    '.v26-hero-grid',
    '.v26-hero-arte',
    '.v26-wordmark',
    '.v26-slogan',
    '.v26-home .busca',
    '.v26-home .cat',
    '.v26-home .mural-toolbar',
    '.v26-home .evento-card',
    '.v26-home .grade',
    '@media(max-width:820px)',
    '@media(max-width:520px)',
]:
    assert marcador in css, f'CSS V26.1 incompleto: {marcador}'

js=read('js/v26-home.js')
for marcador in [
    '__roleV261HomeAtiva',
    "document.body.classList.add('v26-home')",
    'v26-nav',
    'v26-hero-grid',
    'Mais Eventos',
    'Eventos perto de você',
    'v26-info',
    "busca.placeholder='Ex: grátis sábado à noite perto de Itaquera'",
]:
    assert marcador in js, f'JS V26.1 incompleto: {marcador}'

config=read('js/config.js')
assert "estilo('css/v26-home.css','v26-1-home')" in config
assert "script('js/v26-home.js','v26-1-home')" in config
assert "if(eh('index.html'))" in config

sw=read('sw-v25.js')
assert "CACHE_ATUAL = 'role-v26-1-home-v1'" in sw
assert "'./css/v26-home.css'" in sw
assert "'./js/v26-home.js'" in sw
assert "PREFIXO_CACHE_V26" in sw

# A home deve preservar os IDs funcionais existentes; V26 compõe por cima.
index=read('index.html')
for marcador in ['id="busca"','id="cats"','id="abas"','id="visoes"','id="grade"','id="viewMapa"','id="viewCalendario"']:
    assert marcador in index, f'Contrato funcional da home ausente: {marcador}'

print('V26.1 static tests: OK')
