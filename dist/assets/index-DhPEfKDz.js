import{t as V}from"./haptics-BdN-ohAe.js";import{a as W,l as X,t as z,s as tt}from"./index-CqXGOPU-.js";import{g as st}from"./screen-DszJUCvo.js";import{a as et,d as at}from"./math-CLmVsdoQ.js";import{n as nt,a as ot,s as it,i as lt,d as ct}from"./math-ChT2bETV.js";/* empty css              */const N="protractor.settings",rt=.3,_=.9,j=.1,v=Math.PI/180,D=n=>`${Math.abs(n).toFixed(1)}°`,dt=n=>n>.05?"+":n<-.05?"−":"";function ut(){let n="";for(let i=0;i<360;i+=5){const a=i%30===0,e=!a&&i%15===0,o=96,u=a?82:e?87:90,l=i*v;n+=`<line class="${a?"tick major":e?"tick mid":"tick"}" x1="${(o*Math.cos(l)).toFixed(2)}" y1="${(o*Math.sin(l)).toFixed(2)}" x2="${(u*Math.cos(l)).toFixed(2)}" y2="${(u*Math.sin(l)).toFixed(2)}"/>`}const b=[[-90,"90"],[-60,"60"],[-30,"30"],[0,"0"],[30,"30"],[60,"60"],[90,"90"],[120,"60"],[150,"30"],[180,"0"],[210,"30"],[240,"60"]];for(const[i,a]of b){const e=i*v,o=70;n+=`<text class="lbl" x="${(o*Math.cos(e)).toFixed(2)}" y="${(o*Math.sin(e)).toFixed(2)}">${a}</text>`}return n}async function ft(n){const b=await W();let a=(await X(N,{})).mode==="slope"?"slope":"plane";n.innerHTML=`
    <section class="level proto" data-mode="${a}">
      <div class="seg">
        <button data-id="m-plane" type="button">В плоскости</button>
        <button data-id="m-slope" type="button">Склон</button>
      </div>
      <div class="readout">
        <div class="value" data-id="value">0.0°</div>
        <div class="sub" data-id="sub">&nbsp;</div>
      </div>
      <div class="vis">
        <svg class="dial" viewBox="-110 -110 220 220" aria-hidden="true">
          <circle class="rim" r="100"/>
          ${ut()}
          <line class="refline" x1="-80" y1="0" x2="80" y2="0"/>
          <path class="arc" data-id="arc" d=""/>
          <g data-id="needle">
            <line class="needle-line" x1="-78" y1="0" x2="78" y2="0"/>
            <path class="sky" d="M0 -6 L0 -30 M-6 -26 L0 -36 L6 -26 Z"/>
          </g>
          <circle class="hub" r="5"/>
        </svg>
        <svg class="ramp" viewBox="0 0 220 140" aria-hidden="true">
          <line class="ground" x1="20" y1="120" x2="205" y2="120"/>
          <path class="slope-arc" data-id="sarc" d=""/>
          <line class="slope-line" data-id="sline" x1="20" y1="120" x2="130" y2="120"/>
          <text class="slope-lbl" data-id="slbl" x="98" y="112">0°</text>
        </svg>
      </div>
      <div class="tip" data-id="tip"></div>
      <div class="controls">
        <button data-id="hold" type="button">Hold</button>
        <button data-id="zero" type="button" class="primary only-plane">Ноль</button>
        <button data-id="rzero" type="button" class="only-plane">Сброс нуля</button>
      </div>
    </section>
  `;const e=t=>n.querySelector(`[data-id="${t}"]`),o=n.querySelector(".proto"),u=e("value"),l=e("sub"),C=e("tip"),G=e("needle"),H=e("arc"),E=e("sarc"),S=e("sline"),$=e("slbl"),w=e("hold"),T=e("m-plane"),B=e("m-slope");let r=null,h=!1,f=0,M=!1,P=0,g=0,p={beta:0,flatness:1,slope:0};const J=et(t=>{r=t}),R=(t,s)=>{if(Math.abs(s)<.05)return"";const c=s*v,x=(t*Math.cos(c)).toFixed(2),A=(t*Math.sin(c)).toFixed(2),d=s>0?1:0,y=Math.abs(s)>180?1:0;return`M ${t} 0 A ${t} ${t} 0 ${y} ${d} ${x} ${A}`},F=t=>{const s=performance.now();t&&!M&&s-P>400&&(P=s,V("Light")),M=t},Z=()=>{const t=p.flatness<_,s=nt(p.beta-f);if(G.setAttribute("transform",`rotate(${s.toFixed(2)})`),H.setAttribute("d",R(58,Math.max(-179.9,Math.min(179.9,s)))),!t){u.textContent="—",l.textContent="Поставьте телефон вертикально",o.classList.remove("ok"),F(!1);return}u.textContent=`${dt(s)}${D(s)}`;const c=s>.05?"правый край выше":s<-.05?"левый край выше":"горизонтально";l.textContent=f!==0?`${c} · от нуля`:c;const x=ct(s)<=rt;o.classList.toggle("ok",x),F(x)},K=()=>{const t=p.slope,s=t*v,c=110,x=20+c*Math.cos(s),A=120-c*Math.sin(s);S.setAttribute("x2",x.toFixed(2)),S.setAttribute("y2",A.toFixed(2));const d=60;if(t<.05)E.setAttribute("d","");else{const Y=20+d*Math.cos(s),Q=120-d*Math.sin(s);E.setAttribute("d",`M ${20+d} 120 A ${d} ${d} 0 0 0 ${Y.toFixed(2)} ${Q.toFixed(2)}`)}const y=s/2;$.setAttribute("x",(20+82*Math.cos(y)).toFixed(2)),$.setAttribute("y",(120-82*Math.sin(y)+5).toFixed(2)),$.textContent=`${t.toFixed(1)}°`,u.textContent=D(t);const k=Math.tan(Math.min(t,89.9)*v),U=k>5e-4?`1:${(1/k).toFixed(1)}`:"—";l.textContent=t<=j?"✓ ровно":`${(k*100).toFixed(1)}%  ·  ${U}`;const I=t<=j;o.classList.toggle("ok",I),F(I)},m=()=>a==="plane"?Z():K(),q=()=>{if(g=requestAnimationFrame(q),!r||h)return;const t=b.invert?{x:-r.x,y:-r.y,z:-r.z}:r,s=ot(t,b.ox,b.oy);p={beta:lt(s,st()),flatness:at(s).flatness,slope:it(s)},m()};g=requestAnimationFrame(q);const L=()=>{o.dataset.mode=a,T.classList.toggle("on",a==="plane"),B.classList.toggle("on",a==="slope"),w.classList.toggle("on",h),C.textContent=a==="plane"?"Телефон стоит вертикально. Приложите ребро к первой поверхности, нажмите «Ноль», затем приложите ко второй — на экране угол между ними.":"Положите телефон экраном вверх на склон — крышу, пандус, лестницу. Ровная калибровка берётся из «Уровня»."},O=t=>{a=t,M=!1,tt(N,{mode:a}),L(),m()};return T.addEventListener("click",()=>O("plane")),B.addEventListener("click",()=>O("slope")),w.addEventListener("click",()=>{h=!h,L()}),e("zero").addEventListener("click",()=>{if(!r||p.flatness>=_){z("Поставьте телефон вертикально");return}f=p.beta,z("Ноль установлен"),m()}),e("rzero").addEventListener("click",()=>{f=0,z("Ноль сброшен"),m()}),L(),m(),{unmount(){cancelAnimationFrame(g),J(),n.replaceChildren()}}}export{ft as default};
