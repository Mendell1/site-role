from pathlib import Path


def patch_index():
    p = Path('index.html')
    s = p.read_text(encoding='utf-8')

    if 'css/mobile-responsive.css' not in s:
        s = s.replace(
            '<link rel="stylesheet" href="css/estilo.css">',
            '<link rel="stylesheet" href="css/estilo.css">\n<link rel="stylesheet" href="css/mobile-responsive.css">',
            1,
        )

    old = '''    <a class="marca" href="index.html" aria-label="Ir para a página inicial do Rolê"><span class="marca-role">RO<span>LÊ</span></span><small>EVENTOS DO SEU BAIRRO</small></a>
    <div class="direita">
      <button class="btn btn-icone sino" id="btnNotificacoes" hidden aria-label="Notificações">
        <span aria-hidden="true">🔔</span><span class="badge" id="badgeNotificacoes" hidden>0</span>
      </button>
      <button class="btn" id="btnPerfil" hidden>Meu perfil</button>'''

    new = '''    <a class="marca" href="index.html" aria-label="Ir para a página inicial do Rolê"><span class="marca-role">RO<span>LÊ</span></span><small>EVENTOS DO SEU BAIRRO</small></a>
    <div class="topo-mobile-acoes">
      <button class="btn btn-icone sino" id="btnNotificacoes" hidden aria-label="Notificações">
        <span aria-hidden="true">🔔</span><span class="badge" id="badgeNotificacoes" hidden>0</span>
      </button>
      <button class="btn btn-menu-mobile" id="btnMenuMobile" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menuTopo"><span></span><span></span><span></span></button>
    </div>
    <div class="direita" id="menuTopo">
      <button class="btn" id="btnPerfil" hidden>Meu perfil</button>'''

    if old in s:
        s = s.replace(old, new, 1)
    elif 'id="btnMenuMobile"' not in s:
        raise SystemExit('Cabeçalho do index.html não encontrado para atualização segura.')

    if 'js/nav-mobile.js' not in s:
        s = s.replace(
            '<script src="js/auth.js"></script>\n<script src="js/app.js"></script>',
            '<script src="js/auth.js"></script>\n<script src="js/nav-mobile.js"></script>\n<script src="js/app.js"></script>',
            1,
        )

    p.write_text(s, encoding='utf-8')


def patch_perfil():
    p = Path('perfil.html')
    s = p.read_text(encoding='utf-8')

    if 'css/mobile-responsive.css' not in s:
        s = s.replace(
            '<link rel="stylesheet" href="css/estilo.css">',
            '<link rel="stylesheet" href="css/estilo.css">\n<link rel="stylesheet" href="css/mobile-responsive.css">',
            1,
        )

    old = '''    <a class="marca" href="index.html" aria-label="Ir para a página inicial do Rolê"><span class="marca-role">RO<span>LÊ</span></span><small>MEU PERFIL</small></a>
    <a class="btn btn-voltar-mural" href="index.html" aria-label="Voltar ao mural principal">← Voltar ao mural</a>
    <div class="direita">
      <button class="btn btn-icone sino" id="btnNotificacoes" hidden aria-label="Notificações">
        <span aria-hidden="true">🔔</span><span class="badge" id="badgeNotificacoes" hidden>0</span>
      </button>
      <button class="btn ativo" id="btnPerfil" hidden>Meu perfil</button>'''

    new = '''    <a class="marca" href="index.html" aria-label="Ir para a página inicial do Rolê"><span class="marca-role">RO<span>LÊ</span></span><small>MEU PERFIL</small></a>
    <a class="btn btn-voltar-mural" href="index.html" aria-label="Voltar ao mural principal">← Voltar ao mural</a>
    <div class="topo-mobile-acoes">
      <button class="btn btn-icone sino" id="btnNotificacoes" hidden aria-label="Notificações">
        <span aria-hidden="true">🔔</span><span class="badge" id="badgeNotificacoes" hidden>0</span>
      </button>
      <button class="btn btn-menu-mobile" id="btnMenuMobile" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="menuTopo"><span></span><span></span><span></span></button>
    </div>
    <div class="direita" id="menuTopo">
      <button class="btn ativo" id="btnPerfil" hidden>Meu perfil</button>'''

    if old in s:
        s = s.replace(old, new, 1)
    elif 'id="btnMenuMobile"' not in s:
        raise SystemExit('Cabeçalho do perfil.html não encontrado para atualização segura.')

    if '<a class="voltar-mobile" href="index.html">← Voltar ao mural</a>' not in s:
        s = s.replace(
            '</header>\n\n<section class="perfil-hero"',
            '</header>\n<a class="voltar-mobile" href="index.html">← Voltar ao mural</a>\n\n<section class="perfil-hero"',
            1,
        )

    if 'js/nav-mobile.js' not in s:
        s = s.replace(
            '<script src="js/auth.js"></script>\n<script src="js/perfil.js"></script>',
            '<script src="js/auth.js"></script>\n<script src="js/nav-mobile.js"></script>\n<script src="js/perfil.js"></script>',
            1,
        )

    p.write_text(s, encoding='utf-8')


patch_index()
patch_perfil()
print('Mobile markup atualizado com sucesso.')
