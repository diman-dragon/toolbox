import{t as h}from"./haptics-BdN-ohAe.js";import{s as A}from"./magnetometer-C73SmGug.js";import{l as T,m as C,s as L,t as y}from"./index-CqXGOPU-.js";const x="metal.settings",S=[20,8,3];async function M(c){const b=await T(x,{});let r=S.includes(b.range??0)?b.range:8;const n=C(c,`<section class="pane">
      <div class="box"><div class="big" data-id="val">0.0 µT</div>
        <div class="note" data-id="sub">Ожидание датчика…</div></div>
      <div class="meter"><i data-id="bar"></i></div>
      <div class="big" data-id="verdict" style="font-size:24px">&nbsp;</div>
      <div class="note" style="text-align:left">Чувствительность</div>
      <div class="seg" data-id="seg">
        <button type="button" data-r="20">Низкая</button>
        <button type="button" data-r="8">Средняя</button>
        <button type="button" data-r="3">Высокая</button>
      </div>
      <div class="btns">
        <button type="button" class="btn primary" data-id="zero">Обнулить</button>
        <button type="button" class="btn" data-id="sound">Звук</button>
      </div>
      <div class="note" data-id="tip">Отведите телефон от металла и нажмите «Обнулить», затем медленно проводите над поверхностью, не меняя наклон. Датчик реагирует на железо, сталь и магниты; цветные металлы (медь, алюминий, золото) не определяются. Это не замена профессиональному детектору проводки и арматуры.</div>
    </section>`);let s=0,o=NaN,d=!1,v=0,u=0;const N=A(t=>{const e=Math.hypot(t.x,t.y,t.z);s=s?s+(e-s)*.3:e,o=Number.isNaN(o)?s:o+(s-o)*8e-4,d=!0},()=>{n("sub").textContent="На этом устройстве нет магнитометра",n("tip").textContent="Металлоискатель работает только при наличии магнитного датчика.";for(const t of c.querySelectorAll("button"))t.disabled=!0});let a=null,i=null,l=null;const g=()=>{try{i?.stop(),a?.close()}catch{}a=i=l=null},m=()=>{for(const t of n("seg").querySelectorAll("button"))t.classList.toggle("on",Number(t.dataset.r)===r)},f=()=>{if(u=requestAnimationFrame(f),!d)return;const t=s-o,e=Math.min(1,Math.abs(t)/r);n("val").textContent=`${t<0?"−":"+"}${Math.abs(t).toFixed(1)} µT`,n("sub").textContent=`поле ${s.toFixed(1)} µT`,n("bar").style.width=`${(e*100).toFixed(0)}%`,n("verdict").textContent=e>.6?"Металл рядом":e>.25?"Слабый сигнал":"Чисто",n("verdict").classList.toggle("good",e>.25);const p=performance.now();e>.5&&p-v>250&&(v=p,h("Light")),a&&i&&l&&(i.frequency.setTargetAtTime(220+e*1100,a.currentTime,.04),l.gain.setTargetAtTime(e>.12?.06:0,a.currentTime,.04))};return u=requestAnimationFrame(f),n("seg").addEventListener("click",t=>{const e=t.target.closest("button");e&&(r=Number(e.dataset.r),L(x,{range:r}),m())}),n("zero").addEventListener("click",()=>{if(!d){y("Нет данных с датчика");return}o=s,y("Обнулено")}),n("sound").addEventListener("click",()=>{a?g():(a=new AudioContext,i=a.createOscillator(),l=a.createGain(),l.gain.value=0,i.connect(l).connect(a.destination),i.start()),n("sound").classList.toggle("on",!!a)}),m(),{unmount(){cancelAnimationFrame(u),N(),g(),c.replaceChildren()}}}export{M as default};
