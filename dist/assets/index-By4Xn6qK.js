import{m as p,c,g as v,e as m,u}from"./index-CqXGOPU-.js";const r=i=>Number.isFinite(i)?String(i):"";function N(i){const a=[{l:NaN,w:NaN,sub:!1}],l=p(i,`<section class="pane">
      <div class="box"><div class="big" data-id="total">—</div>
        <div class="note" data-id="sub">Введите длину и ширину</div></div>
      <div data-id="list" style="display:flex;flex-direction:column;gap:12px"></div>
      <div class="btns">
        <button type="button" class="btn primary" data-id="add">+ Прямоугольник</button>
        <button type="button" class="btn" data-id="clear">Очистить</button>
      </div>
      <div class="note">Для комнаты сложной формы разбейте её на прямоугольники; выемки (колонны, ниши) добавьте со знаком «−».</div>
    </section>`),b=l("list"),o=()=>{let s=0,t=!1;for(const e of a)Number.isFinite(e.l)&&Number.isFinite(e.w)&&(t=!0,s+=(e.sub?-1:1)*c(e.l)*c(e.w));l("total").textContent=t?v(Math.max(s,0)):"—";const n=a.length===1&&t;l("sub").textContent=n?`периметр ${m(2*(c(a[0].l)+c(a[0].w)))}`:t?`прямоугольников: ${a.length}`:"Введите длину и ширину"},d=()=>{b.innerHTML=a.map((s,t)=>`<div class="box">
          <div class="row"><b>№ ${t+1}</b><span style="display:flex;gap:6px">
            <button type="button" class="btn" data-a="sign" data-i="${t}">${s.sub?"− вычитается":"+ прибавляется"}</button>
            ${a.length>1?`<button type="button" class="btn" data-a="del" data-i="${t}">✕</button>`:""}
          </span></div>
          <div class="row" style="margin-top:10px">
            <input class="in" data-f="l" data-i="${t}" inputmode="decimal" placeholder="Длина, ${u()}" value="${r(s.l)}">
            <span>×</span>
            <input class="in" data-f="w" data-i="${t}" inputmode="decimal" placeholder="Ширина, ${u()}" value="${r(s.w)}">
          </div></div>`).join(""),o()};return i.addEventListener("input",s=>{const t=s.target,n=t.dataset.f;if(!n)return;const e=parseFloat(t.value.replace(",","."));a[Number(t.dataset.i)][n]=Number.isFinite(e)&&e>=0?e:NaN,o()}),i.addEventListener("click",s=>{const t=s.target.closest("[data-a]");if(!t)return;const n=Number(t.dataset.i);t.dataset.a==="sign"?a[n].sub=!a[n].sub:a.splice(n,1),d()}),l("add").addEventListener("click",()=>{a.push({l:NaN,w:NaN,sub:!1}),d()}),l("clear").addEventListener("click",()=>{a.length=0,a.push({l:NaN,w:NaN,sub:!1}),d()}),d(),{unmount:()=>i.replaceChildren()}}export{N as default};
