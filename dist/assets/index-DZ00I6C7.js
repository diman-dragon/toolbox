import{m as o,u as l,g as u,c as v}from"./index-CqXGOPU-.js";function f(e){const n=o(e,`<section class="pane">
      <div class="box"><div class="big" data-id="area">—</div>
        <div class="note">площадь круга</div></div>
      <div class="box">
        <div class="row"><label>Диаметр, ${l()}</label><input class="in" data-f="d" inputmode="decimal"></div>
        <div class="row" style="margin-top:10px"><label>Радиус, ${l()}</label><input class="in" data-f="r" inputmode="decimal"></div>
        <div class="row" style="margin-top:10px"><label>Обхват, ${l()}</label><input class="in" data-f="c" inputmode="decimal"></div>
      </div>
      <div class="btns"><button type="button" class="btn" data-id="clear">Очистить</button></div>
      <div class="note">Введите любую величину — остальные пересчитаются. Для ствола дерева, трубы или колонны удобно измерить обхват рулеткой или шнуром и узнать диаметр.</div>
    </section>`),t={d:e.querySelector('[data-f="d"]'),r:e.querySelector('[data-f="r"]'),c:e.querySelector('[data-f="c"]')},s=a=>String(Math.round(a*1e3)/1e3),r=a=>{const i=parseFloat(t[a].value.replace(",","."));if(!(i>=0)){for(const c of["d","r","c"])c!==a&&(t[c].value="");n("area").textContent="—";return}const d=a==="d"?i:a==="r"?i*2:i/Math.PI;a!=="d"&&(t.d.value=s(d)),a!=="r"&&(t.r.value=s(d/2)),a!=="c"&&(t.c.value=s(d*Math.PI)),n("area").textContent=u(Math.PI*(v(d)/2)**2)};for(const a of["d","r","c"])t[a].addEventListener("input",()=>r(a));return n("clear").addEventListener("click",()=>{for(const a of["d","r","c"])t[a].value="";n("area").textContent="—"}),{unmount:()=>e.replaceChildren()}}export{f as default};
