/* ROLÊ V26.1 — pequenos ajustes estruturais da terceira passada */
(() => {
  'use strict';
  if(window.__roleV261PrecisionAtiva) return;
  window.__roleV261PrecisionAtiva=true;

  function aplicar(){
    document.body.classList.add('v26-precision');
    const marca=document.querySelector('.marca');
    const role=marca?.querySelector('.marca-role');
    if(marca && role && !marca.querySelector('.v26-logo-pin')){
      const pin=document.createElement('span');
      pin.className='v26-logo-pin';
      pin.setAttribute('aria-hidden','true');
      pin.textContent='⌖';
      role.insertAdjacentElement('afterend',pin);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',aplicar,{once:true});
  else aplicar();
})();
