/* ============================================================
   FORÇA DA SENHA
   Usado no cadastro (index.html) e na redefinição (redefinir.html).

   A pontuação é simples de propósito: cada requisito cumprido
   vale um ponto, e o comprimento acima do mínimo dá bônus. Não
   substitui um medidor de entropia de verdade, mas orienta bem
   e é fácil de explicar.
   ============================================================ */

const REGRAS_SENHA = {
  tamanho:   s => s.length >= 8,
  maiuscula: s => /[A-ZÀ-Þ]/.test(s),
  minuscula: s => /[a-zà-þ]/.test(s),
  numero:    s => /[0-9]/.test(s),
  especial:  s => /[^A-Za-zÀ-ÿ0-9]/.test(s)
};

function analisarSenha(senha){
  const cumpridos = {};
  let pontos = 0;

  for(const [nome, testar] of Object.entries(REGRAS_SENHA)){
    cumpridos[nome] = testar(senha);
    if(cumpridos[nome]) pontos++;
  }

  if(senha.length >= 12) pontos++;
  if(senha.length >= 16) pontos++;

  // sequências óbvias derrubam a nota
  if(/^[0-9]+$/.test(senha) || /(.)\1{3,}/.test(senha) ||
     /123456|abcdef|qwerty|senha|password/i.test(senha)){
    pontos = Math.min(pontos, 2);
  }

  const aprovada = Object.values(cumpridos).every(Boolean);

  let nivel, rotulo, cor;
  if(!senha)            { nivel = 0; rotulo = '';        cor = 'transparent'; }
  else if(pontos <= 2)  { nivel = 1; rotulo = 'Fraca';   cor = 'var(--rosa)'; }
  else if(pontos <= 4)  { nivel = 2; rotulo = 'Média';   cor = 'var(--laranja)'; }
  else if(pontos <= 5)  { nivel = 3; rotulo = 'Forte';   cor = 'var(--verde)'; }
  else                  { nivel = 4; rotulo = 'Muito forte'; cor = 'var(--verde)'; }

  return { cumpridos, aprovada, nivel, rotulo, cor, porcentagem: Math.min(100, nivel * 25) };
}

/* Liga o medidor visual aos campos de senha e confirmação.
   Devolve uma função que informa se está tudo certo. */
function ligarMedidorDeSenha(idSenha, idConfirmacao, ids = {}){
  const senha = document.getElementById(idSenha);
  const conf  = document.getElementById(idConfirmacao);
  const barra = document.getElementById(ids.barra || 'forcaBarra');
  const preenchida = document.getElementById(ids.preenchida || 'forcaPreenchida');
  const rotulo = document.getElementById(ids.rotulo || 'forcaRotulo');
  const lista = document.getElementById(ids.lista || 'requisitosSenha');
  const conferencia = document.getElementById(ids.conferencia || 'conferenciaSenha');

  function atualizar(){
    const analise = analisarSenha(senha.value);

    barra.hidden = !senha.value;
    preenchida.style.width = analise.porcentagem + '%';
    preenchida.style.background = analise.cor;
    rotulo.textContent = analise.rotulo;
    rotulo.style.color = analise.cor;

    lista.querySelectorAll('[data-req]').forEach(item=>{
      item.classList.toggle('ok', !!analise.cumpridos[item.dataset.req]);
    });

    if(!conf.value){
      conferencia.textContent = '';
    }else if(conf.value === senha.value){
      conferencia.textContent = '✓ As senhas são iguais';
      conferencia.style.color = 'var(--verde)';
    }else{
      conferencia.textContent = '✗ As senhas não são iguais';
      conferencia.style.color = 'var(--rosa)';
    }
  }

  senha.addEventListener('input', atualizar);
  conf.addEventListener('input', atualizar);

  return () => analisarSenha(senha.value).aprovada && senha.value === conf.value;
}