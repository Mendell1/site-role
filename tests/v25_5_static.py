from pathlib import Path

root = Path(__file__).resolve().parents[1]

def read(path):
    return (root / path).read_text(encoding='utf-8')

# Arquivos da revisão
for rel in ['css/revisao-v25.css', 'js/revisao-v25.js']:
    assert (root / rel).exists(), f'Arquivo V25.5 ausente: {rel}'

config = read('js/config.js')

# A V25.1 já está declarada diretamente nas páginas abaixo. O config não pode
# injetá-la outra vez, senão listeners e componentes podem ser duplicados.
assert "script('js/comunidade-v25.js'" not in config
assert "estilo('css/comunidade-v25.css'" not in config
for pagina in ['perfil.html', 'organizador.html', 'admin.html']:
    html = read(pagina)
    assert html.count('js/comunidade-v25.js') == 1, f'Comunidade duplicada em {pagina}'
    assert html.count('css/comunidade-v25.css') == 1, f'CSS comunidade duplicado em {pagina}'

# Módulos mais pesados ficam restritos às páginas onde são usados.
for marcador in [
    "eh('index.html','perfil.html')",
    "eh('index.html')",
    "eh('perfil.html')",
    'css/revisao-v25.css',
    'js/revisao-v25.js'
]:
    assert marcador in config, f'Loader V25.5 incompleto: {marcador}'

# Revisão de modais e acessibilidade.
revisao = read('js/revisao-v25.js')
for marcador in [
    '__roleV255RevisaoAtiva',
    'aria-live',
    'v255-modal-aberto',
    "e.key!=='Escape'",
    'MutationObserver',
    'reposicionarParticipacao',
    "matchMedia('(max-width:760px)')",
    "principal.querySelector('#areaComentarios')",
    "card.dataset.v255Posicao='mobile'"
]:
    assert marcador in revisao, f'Revisão UX incompleta: {marcador}'

css = read('css/revisao-v25.css')
for marcador in [
    '100dvh',
    'prefers-reduced-motion',
    '.v253-qr-box canvas',
    '@media (max-width:760px)',
    '.detalhe-coluna-principal > #participacaoV252',
    'env(safe-area-inset-bottom)'
]:
    assert marcador in css, f'Revisão mobile incompleta: {marcador}'

# O Service Worker precisa invalidar o cache anterior para a revisão aparecer
# imediatamente, em especial depois de mudanças no config.js e no mobile.
sw = read('sw-v25.js')
assert "CACHE_ATUAL = 'role-v25-5-shell-v2'" in sw
assert './css/revisao-v25.css' in sw
assert './js/revisao-v25.js' in sw
assert "url.origin !== self.location.origin" in sw

print('V25.5 static tests: OK')
