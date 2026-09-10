const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const profile={id:'u1',nome:'Pessoa de teste',papel:'usuario',cadastro_completo:true,data_nascimento:'1990-01-01',aceitou_regras:true,cidade:'São Paulo'};
function organizer(){
  const box={innerHTML:''},pending=[];
  const query=()=>{const q=deferred();pending.push(q);return {select(){return this},eq(){return this},order(){return this},limit(){return q.promise},single(){return q.promise}};};
  const ctx=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return box}},location:{pathname:'/perfil.html'},URL,URLSearchParams,console,setTimeout,clearTimeout,db:{auth:{getSession:async()=>({data:{session:{user:{id:'u1'}}}})},from:query}});
  let source=read('preview-v25/js/acesso-organizador-v25.js');
  source=source.replace(/\}\)\(\);\s*$/,"window.test={load:carregarPerfil,render:renderAcessoPerfil,get:()=>perfil,set:p=>{perfil=p;session={user:{id:'u1'}}}};})();");
  vm.runInContext(source,ctx);ctx.window.test.set({...profile});
  return {api:ctx.window.test,box,pending};
}
test('Organizador conserva perfil enquanto busca dados novamente',async()=>{
  const {api,pending}=organizer();const job=api.load();await new Promise(setImmediate);
  assert.equal(api.get().nome,profile.nome);pending[0].resolve({data:{...profile,nome:'Atualizado'}});
  await job;assert.equal(api.get().nome,'Atualizado');
});
test('Organizador usa snapshot durante recarregamento concorrente',async()=>{
  const {api,box,pending}=organizer();const job=api.render();api.set(null);
  pending[0].resolve({data:[]});await job;
  assert.match(box.innerHTML,/Pessoa de teste/);assert.match(box.innerHTML,/✓ Conta ativa/);assert.doesNotMatch(box.innerHTML,/○ Conta ativa/);
});
test('Resposta antiga não substitui solicitação mais recente',async()=>{
  const {api,box,pending}=organizer();const old=api.render(),newer=api.render();
  pending[1].resolve({data:[{id:'s2',status:'pendente',nome_organizacao:'Pedido novo'}]});await newer;
  pending[0].resolve({data:[]});await old;assert.match(box.innerHTML,/Pedido novo/);assert.doesNotMatch(box.innerHTML,/Nome do organizador, projeto ou grupo/);
});
test('Erro de solicitação oferece nova tentativa',async()=>{
  const {api,box,pending}=organizer();const job=api.render();
  pending[0].resolve({error:{message:'offline'}});await job;assert.match(box.innerHTML,/Tentar novamente/);
});
test('Estados aprovado e administrador preservam ações',async()=>{
  const {api,box}=organizer();api.set({...profile,papel:'organizador'});await api.render();
  assert.match(box.innerHTML,/ACESSO APROVADO/);assert.match(box.innerHTML,/Publicar evento/);
  api.set({...profile,papel:'admin'});await api.render();assert.match(box.innerHTML,/Abrir painel administrativo/);
});
function form(){
  const fields=Object.fromEntries(['p_nome','p_cidade','p_bio','p_contato','p_foto','a_email','sw_interesse','sw_comentarios','sw_denuncias','sw_resumo'].map(id=>[id,{value:'',checked:false,files:[]}]));
  const source=read('js/perfil.js');
  const functions=source.slice(source.indexOf('function carregarPreferenciasDoPerfil'),source.indexOf('function renderResumoPerfil'));
  const ctx=vm.createContext({campo:id=>fields[id],Sessao:{usuario:{email:'teste@example.com'}}});
  vm.runInContext('let perfilOriginal=null;\n'+functions,ctx);ctx.preencherFormularioPerfil({...profile});return {ctx,fields};
}
test('Atualização do perfil preserva rascunho e avisos não salvos',()=>{
  const {ctx,fields}=form();fields.p_cidade.value='Rascunho';fields.sw_interesse.checked=false;
  ctx.preencherFormularioPerfil({...profile,cidade:'Valor do banco'});
  assert.equal(fields.p_cidade.value,'Rascunho');assert.equal(fields.sw_interesse.checked,false);
});
test('Descartar e troca de usuário substituem formulário',()=>{
  const {ctx,fields}=form();fields.p_cidade.value='Rascunho';ctx.preencherFormularioPerfil({...profile},true);
  assert.equal(fields.p_cidade.value,'São Paulo');fields.p_cidade.value='Outro rascunho';
  ctx.preencherFormularioPerfil({...profile,id:'u2',cidade:'Recife'});assert.equal(fields.p_cidade.value,'Recife');
});
test('Erro de consulta não apaga favoritos já carregados',async()=>{
  const source=read('js/perfil.js');
  const part=source.slice(source.indexOf('async function carregarMeusVinculos'),source.indexOf('function mostrarErroEventosPerfil'));
  const fav=new Set(['evento-antigo']),interest=new Set();
  const chain={select(){return this},eq(){return Promise.resolve({error:{message:'offline'}})}};
  const ctx=vm.createContext({favoritos:fav,interesses:interest,meuId:()=>profile.id,Sessao:{logado:()=>true},db:{from:()=>chain}});
  vm.runInContext(part,ctx);assert.equal(await ctx.carregarMeusVinculos(),false);assert.equal(fav.has('evento-antigo'),true);
});
function element(tab,pane){
  const attrs={},classes=new Set();
  return {dataset:tab?{tab}:{pane},id:'',hidden:false,disabled:false,classList:{contains:x=>classes.has(x),toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
    getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>attrs[k]=v,focus(){this.focused=true},click(){this.clicked=true},scrollIntoView(){},closest(){return this}};
}
test('Abas fora do main refletem painel e aceitam teclado',()=>{
  const tabs=['favoritos','inscricoes','dados'].map(x=>element(x)),panes=['favoritos','inscricoes','dados'].map(x=>element(null,x));
  panes[0].hidden=true;panes[2].hidden=true;const listeners={};
  const main={querySelectorAll:()=>panes},bar={querySelectorAll:()=>tabs};
  const doc={readyState:'complete',body:{},getElementById:()=>main,querySelector:()=>bar,querySelectorAll:()=>tabs,addEventListener:(name,fn)=>listeners[name]=fn};
  const ctx=vm.createContext({window:{},document:doc,MutationObserver:class{observe(){}},requestAnimationFrame:()=>1});
  vm.runInContext(read('js/perfil-tabs-active-fix-v26.js'),ctx);
  assert.equal(tabs[1].getAttribute('aria-selected'),'true');assert.equal(tabs[0].getAttribute('aria-selected'),'false');
  assert.equal(panes[1].getAttribute('role'),'tabpanel');assert.equal(tabs[1].getAttribute('tabindex'),'0');
  listeners.keydown({target:tabs[1],key:'ArrowRight',preventDefault(){}});
  assert.equal(tabs[2].clicked,true);assert.equal(tabs[2].focused,true);
});
test('Meus eventos renderiza vazio, links acessíveis e conteúdo escapado',()=>{
  const nodes={grade:{innerHTML:''},vazio:{hidden:true}};
  const ctx=vm.createContext({window:{},document:{getElementById:id=>nodes[id]},Sessao:{perfil:{nome:'Teste'}}});
  const source=read('js/perfil.js');vm.runInContext(source.slice(0,source.indexOf('async function carregarMeusVinculos')),ctx);
  ctx.renderCards([],'grade','vazio');assert.equal(nodes.vazio.hidden,false);
  ctx.renderCards([{id:'e1',nome:'<script>teste</script>',data_evento:'2026-10-01',gratuito:true}],'grade','vazio');
  assert.equal(nodes.vazio.hidden,true);assert.match(nodes.grade.innerHTML,/index.html\?evento=e1/);
  assert.match(nodes.grade.innerHTML,/aria-label="Adicionar aos favoritos"/);assert.doesNotMatch(nodes.grade.innerHTML,/<script>/);
});
test('Painel do organizador renderiza estado vazio e métricas sem executar ações',()=>{
  const box={innerHTML:''};
  const ctx=vm.createContext({window:{},document:{readyState:'loading',addEventListener(){},getElementById:()=>box},location:{pathname:'/perfil.html'},console,Intl});
  const source=read('preview-v25/js/metricas-organizador-v25.js').replace(/\}\)\(\);\s*$/,'window.renderTest=renderPainel;})();');
  vm.runInContext(source,ctx);ctx.window.renderTest({});
  assert.match(box.innerHTML,/Publique seu primeiro evento/);
  ctx.window.renderTest({totais:{inscritos:2,visualizacoes:10},eventos:[{id:'e1',nome:'Oficina',data_evento:'2026-10-01',visualizacoes:10}]});
  assert.match(box.innerHTML,/Oficina/);assert.match(box.innerHTML,/index.html\?evento=e1/);
});
test('Auth libera callback e ignora perfil recebido depois do logout',async()=>{
  const timers=[],pending=deferred();let cb,calls=0;
  const chain={select(){return this},eq(){return this},single(){calls++;return pending.promise}};
  const ctx=vm.createContext({window:{},document:{getElementById:()=>null},console,Date,setTimeout:f=>timers.push(f),db:{auth:{onAuthStateChange:f=>{cb=f}},from:()=>chain}});
  vm.runInContext(read('js/auth.js'),ctx);ctx.window.aoMudarSessao=async()=>{};
  assert.equal(cb('SIGNED_IN',{user:{id:'u1'}}),undefined);assert.equal(calls,0);
  const job=timers.shift()();assert.equal(calls,1);cb('SIGNED_OUT',null);
  pending.resolve({data:{...profile}});await job;assert.equal(ctx.window.Sessao.perfil,null);
  await timers.shift()();assert.equal(ctx.window.Sessao.usuario,null);
});

