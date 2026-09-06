from pathlib import Path

root=Path(__file__).resolve().parents[1]

def read(path):
    return (root/path).read_text(encoding='utf-8')

for rel in [
    'css/v26-home.css','js/v26-home.js',
    'css/v26-home-fidelity.css','js/v26-home-fidelity.js',
    'css/v26-home-precision.css','js/v26-home-precision.js'
]:
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

fidelity=read('css/v26-home-fidelity.css')
for marcador in [
    'width:min(1740px,calc(100% - 96px))',
    'min-height:424px',
    'max-width:1560px',
    'max-width:1760px',
    'flex-wrap:nowrap',
    'aspect-ratio:4.15/1',
    '.v261-categoria-media',
    '.v261-card-desc',
    '.organizador-card{display:none',
]:
    assert marcador in fidelity, f'Fidelity CSS V26.1 incompleto: {marcador}'

precision=read('css/v26-home-precision.css')
for marcador in [
    '.v26-logo-pin',
    'grid-template-columns:minmax(0,930px)',
    'font-size:clamp(82px,5.55vw,103px)',
    'max-width:955px',
    'max-width:1340px',
    'overflow:visible',
    'min-height:64px',
]:
    assert marcador in precision, f'Precision CSS V26.1 incompleto: {marcador}'

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

fidelity_js=read('js/v26-home-fidelity.js')
for marcador in [
    '__roleV261FidelityAtiva',
    'eventoPorId',
    'v261-categoria-media',
    'v261-card-desc',
    'MutationObserver',
    'Todos os eventos',
    'Para você',
]:
    assert marcador in fidelity_js, f'Fidelity JS V26.1 incompleto: {marcador}'

precision_js=read('js/v26-home-precision.js')
for marcador in ['__roleV261PrecisionAtiva','v26-logo-pin','v26-precision']:
    assert marcador in precision_js, f'Precision JS V26.1 incompleto: {marcador}'

config=read('js/config.js')
for marcador in [
    "estilo('css/v26-home.css','v26-1-home')",
    "script('js/v26-home.js','v26-1-home')",
    "estilo('css/v26-home-fidelity.css','v26-1-fidelity')",
    "script('js/v26-home-fidelity.js','v26-1-fidelity')",
    "estilo('css/v26-home-precision.css','v26-1-precision')",
    "script('js/v26-home-precision.js','v26-1-precision')",
    "if(eh('index.html'))",
]:
    assert marcador in config, f'Loader V26.1 incompleto: {marcador}'

sw=read('sw-v25.js')
assert "CACHE_ATUAL = 'role-v26-1-home-v3'" in sw
for marcador in [
    "'./css/v26-home.css'",
    "'./js/v26-home.js'",
    "'./css/v26-home-fidelity.css'",
    "'./js/v26-home-fidelity.js'",
    "'./css/v26-home-precision.css'",
    "'./js/v26-home-precision.js'",
    'PREFIXO_CACHE_V26',
]:
    assert marcador in sw, f'Cache V26.1 incompleto: {marcador}'

index=read('index.html')
for marcador in ['id="busca"','id="cats"','id="abas"','id="visoes"','id="grade"','id="viewMapa"','id="viewCalendario"']:
    assert marcador in index, f'Contrato funcional da home ausente: {marcador}'

print('V26.1 static tests: OK')
