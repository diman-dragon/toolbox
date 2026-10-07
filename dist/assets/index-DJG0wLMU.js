import{t as I}from"./haptics-BdN-ohAe.js";import{g as K}from"./screen-DszJUCvo.js";import{s as R,U as j,n as P,d as D,t as Q,f as G}from"./math-CLmVsdoQ.js";import{l as V,s as p,t as g}from"./index-CqXGOPU-.js";/* empty css              */const W=.1,H=8,tt=6,v="level.settings",et={ox:0,oy:0,unit:"deg",invert:!1};async function lt(f){const n={...et,...await V(v,{})};f.innerHTML=`
    <section class="level" data-mode="flat">
      <div class="readout">
        <button class="value" data-id="value" type="button">0.0°</button>
        <div class="sub" data-id="sub">&nbsp;</div>
      </div>
      <div class="vis">
        <div class="dish">
          <i class="cross-h"></i><i class="cross-v"></i><i class="ring"></i>
          <i class="bubble" data-id="bubble"></i>
        </div>
        <div class="vial">
          <i class="mark m1"></i><i class="mark m2"></i>
          <i class="bubble" data-id="vbubble"></i>
        </div>
      </div>
      <div class="tip">
        Калибровка: положите телефон на ровную поверхность экраном вверх.
        Проверка: поверните на 180° — показания должны остаться нулевыми.
      </div>
      <div class="controls">
        <button data-id="hold" type="button">Hold</button>
        <button data-id="unit" type="button"></button>
        <button data-id="sound" type="button">Звук</button>
        <button data-id="invert" type="button">Оси ⇄</button>
        <button data-id="calib" type="button" class="primary">Калибровка</button>
        <button data-id="reset" type="button">Сброс</button>
      </div>
    </section>
  `;const o=t=>f.querySelector(`[data-id="${t}"]`),z=f.querySelector(".level"),T=o("value"),h=o("sub"),k=o("bubble"),J=o("vbubble"),M=o("hold"),S=o("unit"),q=o("sound"),B=o("invert");let e=null,d="flat",y=!1,m=!1,C=!1,w=0,x=null,L=0;const Y=R(t=>{if(!e){e={...t};return}const i=Math.hypot(t.x-e.x,t.y-e.y,t.z-e.z)>1.5?.5:.12;e={x:e.x+(t.x-e.x)*i,y:e.y+(t.y-e.y)*i,z:e.z+(t.z-e.z)*i}});let a=null,l=null,c=null;const Z=()=>{a=new AudioContext,l=a.createOscillator(),c=a.createGain(),c.gain.value=0,l.type="sine",l.connect(c).connect(a.destination),l.start()},F=()=>{try{l?.stop(),a?.close()}catch{}a=null,l=null,c=null},O=t=>{if(!a||!l||!c)return;const s=t<8,i=220+(1-Math.min(t/8,1))*880;l.frequency.setTargetAtTime(i,a.currentTime,.05),c.gain.setTargetAtTime(s?.05:0,a.currentTime,.05)},$=t=>(t>0?"+":t<0?"−":"")+G(t,n.unit),U=t=>{const s=t.mode==="flat";z.dataset.mode=t.mode;const i=s?Math.hypot(t.sx,t.sy):Math.abs(t.sx),r=i<=W;if(z.classList.toggle("ok",r),T.textContent=(s||r?"":t.sx>0?"+":"−")+G(i,n.unit),r?h.textContent="✓ в нуле":s?h.textContent=`X ${$(t.sx)}   Y ${$(t.sy)}`:h.textContent=t.sx>0?"правый край выше":"левый край выше",s){let b=t.sx/H,E=-t.sy/H;const A=Math.hypot(b,E);A>1&&(b/=A,E/=A),k.style.left=`${50+b*42}%`,k.style.top=`${50+E*42}%`}else{const b=Math.max(-1,Math.min(1,t.sx/tt));J.style.left=`${50+b*41}%`}const X=performance.now();r&&!C&&X-w>500&&(w=X,I("Medium")),C=r,O(i)},_=()=>{if(L=requestAnimationFrame(_),!e)return;const t=n.invert?{x:-e.x,y:-e.y,z:-e.z}:e,s=D(t);d==="flat"&&s.flatness<.75?d="edge":d==="edge"&&s.flatness>.85&&(d="flat");const i=Q(s.tx-n.ox,s.ty-n.oy,K());x={sx:i.sx,sy:i.sy,mode:d},y?O(99):U(x)};L=requestAnimationFrame(_);const u=()=>{S.textContent=j[n.unit],M.classList.toggle("on",y),q.classList.toggle("on",m),B.classList.toggle("on",n.invert)},N=()=>{n.unit=P(n.unit),p(v,n),u(),x&&U(x)};return T.addEventListener("click",N),S.addEventListener("click",N),M.addEventListener("click",()=>{y=!y,u()}),q.addEventListener("click",()=>{m=!m,m?Z():F(),u()}),B.addEventListener("click",()=>{n.invert=!n.invert,p(v,n),u()}),o("calib").addEventListener("click",()=>{if(!e){g("Нет данных с датчика");return}const t=n.invert?{x:-e.x,y:-e.y,z:-e.z}:e,s=D(t);if(s.flatness<.97){g("Положите телефон на ровную поверхность экраном вверх");return}n.ox=s.tx,n.oy=s.ty,p(v,n),g("Откалибровано")}),o("reset").addEventListener("click",()=>{n.ox=0,n.oy=0,p(v,n),g("Калибровка сброшена")}),u(),{unmount(){cancelAnimationFrame(L),Y(),F(),f.replaceChildren()}}}export{lt as default};
