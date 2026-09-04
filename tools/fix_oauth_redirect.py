from pathlib import Path

p = Path('js/perfil.js')
s = p.read_text(encoding='utf-8')
old = """  const destino = new URL('perfil.html', location.href);
  destino.search = '';
  destino.hash = '';
  destino.searchParams.set('excluir_google','1');"""
new = """  // O Supabase já possui index.html na allowlist de Redirect URLs.
  // Voltamos por ele e o google-auth.js encaminha para o perfil.
  const destino = new URL('index.html', location.href);
  destino.search = '';
  destino.hash = '';"""
if old not in s:
    raise SystemExit('Trecho de redirect da exclusão Google não encontrado')
p.write_text(s.replace(old, new, 1), encoding='utf-8')

p = Path('js/google-auth.js')
s = p.read_text(encoding='utf-8')
marker = "  async function entrarComGoogle(botao) {"
bridge = """  function encaminharReautenticacaoExclusao(usuario) {
    const esperado = sessionStorage.getItem('role_exclusao_google_uid');
    if (!esperado || !usuario) return false;
    if (window.location.pathname.endsWith('/perfil.html')) return false;

    const destino = new URL('perfil.html', window.location.href);
    destino.search = '';
    destino.hash = '';
    destino.searchParams.set('excluir_google', '1');
    window.location.replace(destino.href);
    return true;
  }

"""
if 'function encaminharReautenticacaoExclusao' not in s:
    if marker not in s:
        raise SystemExit('Ponto de inserção no google-auth.js não encontrado')
    s = s.replace(marker, bridge + marker, 1)

old_get = """    db.auth.getSession().then(({ data }) => {
      if (data && data.session) verificarOnboarding(data.session.user);
    });"""
new_get = """    db.auth.getSession().then(({ data }) => {
      if (data && data.session) {
        if (encaminharReautenticacaoExclusao(data.session.user)) return;
        verificarOnboarding(data.session.user);
      }
    });"""
if old_get not in s:
    raise SystemExit('getSession do Google Auth não encontrado')
s = s.replace(old_get, new_get, 1)

old_listener = """    db.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao && sessao.user) {
        setTimeout(() => verificarOnboarding(sessao.user), 100);
      }
    });"""
new_listener = """    db.auth.onAuthStateChange((_evento, sessao) => {
      if (sessao && sessao.user) {
        if (encaminharReautenticacaoExclusao(sessao.user)) return;
        setTimeout(() => verificarOnboarding(sessao.user), 100);
      }
    });"""
if old_listener not in s:
    raise SystemExit('Listener do Google Auth não encontrado')
p.write_text(s.replace(old_listener, new_listener, 1), encoding='utf-8')

print('OAuth reauth redirect patched.')
