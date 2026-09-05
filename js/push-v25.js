/* ============================================================
   ROLÊ V25.4 — Web Push
   A permissão é solicitada somente por ação explícita do usuário.
   ============================================================ */
(() => {
  'use strict';

  const PREFIXO='[V25.4/PUSH]';
  const VAPID_PUBLIC_KEY='BKn_pEj3zaumEDHkNTPy0oa_e4Q65ZyM9CEgRy1B2gmB6japFflbA7ELGiMzSD_SfU9XplQMFvxJ-Qqchq9xIyU';
  let processando=false;

  const logado=()=>typeof Sessao!=='undefined'&&Sessao&&typeof Sessao.logado==='function'&&Sessao.logado();

  function suporte(){
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  function chaveAplicacao(base64){
    const pad='='.repeat((4-base64.length%4)%4);
    const normal=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(normal);
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  async function registro(){
    let reg=await navigator.serviceWorker.getRegistration('./');
    if(!reg) reg=await navigator.serviceWorker.register('./sw-v25.js',{scope:'./'});
    return navigator.serviceWorker.ready;
  }

  function serializar(sub){
    const json=sub.toJSON();
    return {
      endpoint:sub.endpoint,
      p256dh:json.keys?.p256dh||'',
      auth:json.keys?.auth||''
    };
  }

  async function salvar(sub){
    if(!logado()||!sub) return false;
    const s=serializar(sub);
    if(!s.p256dh||!s.auth) return false;
    const {error}=await db.rpc('salvar_push_v25_4',{
      p_endpoint:s.endpoint,
      p_p256dh:s.p256dh,
      p_auth:s.auth,
      p_user_agent:navigator.userAgent
    });
    if(error){console.warn(PREFIXO,error);return false;}
    return true;
  }

  function criarUI(){
    if(document.getElementById('pushV254')) return;
    const referencia=document.getElementById('sw_resumo')?.closest('.bloco-form-lovable');
    if(!referencia) return;
    const card=document.createElement('div');
    card.id='pushV254'; card.className='v254-push-card';
    card.innerHTML='<div><strong>🔔 Notificações neste aparelho</strong><span id="pushStatusV254">Verificando disponibilidade...</span></div><button type="button" class="btn-linha" id="btnPushV254">Ativar</button>';
    referencia.appendChild(card);
    card.querySelector('#btnPushV254').addEventListener('click',alternar);
    atualizarEstado();
  }

  async function estadoAtual(){
    if(!suporte()) return {suportado:false,ativo:false,sub:null};
    try{
      const reg=await registro();
      const sub=await reg.pushManager.getSubscription();
      return {suportado:true,ativo:!!sub,sub,permissao:Notification.permission};
    }catch(err){
      console.warn(PREFIXO,err);
      return {suportado:false,ativo:false,sub:null};
    }
  }

  async function atualizarEstado(){
    const status=document.getElementById('pushStatusV254');
    const botao=document.getElementById('btnPushV254');
    if(!status||!botao) return;
    const est=await estadoAtual();
    if(!est.suportado){
      status.textContent='Este navegador não oferece Web Push para o Rolê.';
      botao.hidden=true; return;
    }
    botao.hidden=false;
    if(est.ativo){
      status.textContent='Ativas neste navegador. Você pode receber avisos mesmo com o site fechado.';
      botao.textContent='Desativar neste aparelho';
      botao.dataset.ativo='1';
      if(logado()) salvar(est.sub);
    }else if(est.permissao==='denied'){
      status.textContent='Bloqueadas nas permissões do navegador. Libere notificações nas configurações do site.';
      botao.textContent='Verificar novamente';
      botao.dataset.ativo='0';
    }else{
      status.textContent='Ative para receber vagas liberadas, eventos seguidos e outros avisos importantes.';
      botao.textContent='Ativar neste aparelho';
      botao.dataset.ativo='0';
    }
  }

  async function ativar(){
    if(!logado()){
      if(typeof window.avisar==='function') window.avisar('Entre na sua conta para ativar notificações no aparelho.');
      document.getElementById('btnEntrar')?.click();
      return;
    }
    if(!suporte()) return;
    const permissao=await Notification.requestPermission();
    if(permissao!=='granted'){
      if(typeof window.avisar==='function') window.avisar('Permissão de notificações não concedida.');
      return;
    }
    const reg=await registro();
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:chaveAplicacao(VAPID_PUBLIC_KEY)
      });
    }
    const ok=await salvar(sub);
    if(!ok) throw new Error('Não foi possível salvar a assinatura push');
    if(typeof window.avisar==='function') window.avisar('Notificações ativadas neste aparelho.');
  }

  async function desativar(){
    const reg=await registro();
    const sub=await reg.pushManager.getSubscription();
    if(!sub) return;
    const endpoint=sub.endpoint;
    if(logado()){
      const {error}=await db.rpc('remover_push_v25_4',{p_endpoint:endpoint});
      if(error) console.warn(PREFIXO,error);
    }
    await sub.unsubscribe();
    if(typeof window.avisar==='function') window.avisar('Notificações desativadas neste aparelho.');
  }

  async function alternar(){
    if(processando) return;
    processando=true;
    const botao=document.getElementById('btnPushV254');
    if(botao) botao.disabled=true;
    try{
      const est=await estadoAtual();
      if(est.ativo) await desativar(); else await ativar();
    }catch(err){
      console.warn(PREFIXO,err);
      if(typeof window.avisar==='function') window.avisar('Não foi possível alterar as notificações agora.');
    }finally{
      processando=false;
      if(botao) botao.disabled=false;
      atualizarEstado();
    }
  }

  function iniciar(){
    criarUI();
    setTimeout(()=>{criarUI();atualizarEstado();},900);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden) atualizarEstado();});
    console.info(PREFIXO,'módulo carregado');
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
