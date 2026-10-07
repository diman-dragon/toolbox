import{a as $,m as k,t as y}from"./index-CqXGOPU-.js";import{t as z}from"./haptics-BdN-ohAe.js";import{g as C}from"./screen-DszJUCvo.js";import{a as T,d as q}from"./math-CLmVsdoQ.js";import{a as w,i as E,n as S}from"./math-ChT2bETV.js";/* empty css              */const I=[15,30,45,60,90],R=.5,G=.9,f=Math.PI/180;async function _(l){const c=await $();let i=45,d=0;const a=k(l,`<section class="level tpl">
      <div class="seg" data-id="chips">${I.map(t=>`<button type="button" data-t="${t}">${t}°</button>`).join("")}</div>
      <div class="readout">
        <div class="value" data-id="value">—</div>
        <div class="sub" data-id="sub">&nbsp;</div>
      </div>
      <div class="vis">
        <svg viewBox="0 0 220 140" aria-hidden="true">
          <line class="ground" x1="20" y1="120" x2="205" y2="120"/>
          <line class="tray" data-id="tray" x1="20" y1="120" x2="20" y2="120"/>
          <line class="lray" data-id="lray" x1="20" y1="120" x2="20" y2="120"/>
          <circle cx="20" cy="120" r="4" class="lhub"/>
        </svg>
      </div>
      <div class="tip">Телефон стоит вертикально. Приложите ребро к основанию (ноль), затем к детали — когда угол совпадёт с шаблоном, экран позеленеет.</div>
      <div class="controls">
        <button type="button" data-id="zero" class="primary">Ноль</button>
        <button type="button" data-id="rzero">Сброс нуля</button>
      </div>
    </section>`),p=l.querySelector(".tpl"),M=a("tray"),L=a("lray"),x=a("chips"),g=(t,e)=>{const s=Math.min(170,105/Math.max(Math.sin(e*f),.01));t.setAttribute("x2",(20+s*Math.cos(e*f)).toFixed(2)),t.setAttribute("y2",(120-s*Math.sin(e*f)).toFixed(2))},h=()=>{g(M,i);for(const t of x.querySelectorAll("button"))t.classList.toggle("on",Number(t.dataset.t)===i)};let n=null,u=0,b=!1,o=!1,v=0;const F=T(t=>n=t),A=()=>{if(v=requestAnimationFrame(A),!n)return;const t=c.invert?{x:-n.x,y:-n.y,z:-n.z}:n,e=w(t,c.ox,c.oy);if(u=E(e,C()),b=q(e).flatness<G,!b){a("value").textContent="—",a("sub").textContent="Поставьте телефон вертикально",p.classList.remove("ok"),o=!1;return}let s=(S(u-d)%180+180)%180;s>90&&(s=180-s);const m=s-i,r=Math.abs(m)<=R;g(L,s),a("value").textContent=`${s.toFixed(1)}°`,a("sub").textContent=r?`✓ совпало с ${i}°`:`до ${i}°: ${m>0?"−":"+"}${Math.abs(m).toFixed(1)}°`,p.classList.toggle("ok",r),r&&!o&&z("Medium"),o=r};return v=requestAnimationFrame(A),x.addEventListener("click",t=>{const e=t.target.closest("button");e&&(i=Number(e.dataset.t),o=!1,h())}),a("zero").addEventListener("click",()=>{if(!n||!b){y("Поставьте телефон вертикально");return}d=u,y("Ноль установлен")}),a("rzero").addEventListener("click",()=>{d=0,y("Ноль сброшен")}),h(),{unmount(){cancelAnimationFrame(v),F(),l.replaceChildren()}}}export{_ as default};
