import{a as H,m as k,u as g,f as z,b as M,c as x,n as h,d as R,t as D,e as l}from"./index-CqXGOPU-.js";import{a as F}from"./math-CLmVsdoQ.js";import{a as I}from"./math-ChT2bETV.js";const P=180/Math.PI,v=Math.PI/180,m=a=>(a<0?"−":"+")+Math.abs(a).toFixed(1)+"°";async function $(a,w){const p=await H(),n=w==="height",e=k(a,`<section class="pane">
      <div class="box"><div class="big" data-id="ang">0.0°</div>
        <div class="note">угол верхнего ребра телефона к горизонту</div></div>
      <div class="box">
        ${n?`<div class="row"><label>Расстояние до объекта, ${g()}</label>
               <input class="in" data-id="dist" inputmode="decimal" placeholder="10"></div>`:""}
        <div class="row" ${n?'style="margin-top:10px"':""}><label>Высота глаз, ${g()}</label>
          <input class="in" data-id="eye" inputmode="decimal"></div>
      </div>
      <div class="box">
        <div class="row"><span>${n?"Верх":"Основание"}</span><b data-id="a1">—</b></div>
        ${n?'<div class="row"><span>Низ (необязательно)</span><b data-id="a2">—</b></div>':""}
        <div class="big good" data-id="res">—</div>
        <div class="note" data-id="how">&nbsp;</div>
      </div>
      <div class="btns">
        <button type="button" class="btn primary" data-id="m1">${n?"Зафиксировать верх":"Замер"}</button>
        ${n?'<button type="button" class="btn" data-id="m2">Зафиксировать низ</button>':""}
        <button type="button" class="btn" data-id="reset">Сброс</button>
      </div>
      <div class="note">${n?"Встаньте на известном расстоянии, держите телефон на вытянутой руке, наводите по верхнему ребру на верх объекта, затем (по желанию) на его основание. Без «низа» к результату добавляется высота глаз.":"Наведите верхнее ребро на точку, где объект стоит на земле. Расстояние считается по высоте глаз и углу вниз."}</div>
    </section>`),c=e("eye"),y=n?e("dist"):null;c.value=z(M().eyeHeight).toFixed(2);let d=0,f=!1,o=null,r=null;const E=F(t=>{const s=p.invert?{x:-t.x,y:-t.y,z:-t.z}:t,i=I(s,p.ox,p.oy),L=Math.hypot(i.x,i.y,i.z)||1;d=Math.asin(Math.max(-1,Math.min(1,i.y/L)))*P,f=!0,e("ang").textContent=m(d)}),u=()=>{const t=x(h(c));return t>0?t:M().eyeHeight},b=()=>{const t=e("res"),s=e("how");if(t.textContent="—",s.textContent=" ",o!==null)if(n){const i=x(h(y));if(!(i>0)){s.textContent="Введите расстояние до объекта";return}r!==null?(t.textContent=l(i*(Math.tan(o*v)-Math.tan(r*v))),s.textContent="по двум углам: верх и низ"):(t.textContent=l(i*Math.tan(o*v)+u()),s.textContent=`верх + высота глаз ${l(u())}`)}else{if(o>-1){s.textContent="Наведите ниже горизонта — на основание объекта";return}t.textContent=l(u()/Math.tan(-o*v)),s.textContent=`до основания, глаза на высоте ${l(u())}`}},C=t=>{if(!f){D("Нет данных с датчика");return}t===1?(o=d,e("a1").textContent=m(d)):(r=d,e("a2").textContent=m(d)),b()};return e("m1").addEventListener("click",()=>C(1)),n&&e("m2").addEventListener("click",()=>C(2)),e("reset").addEventListener("click",()=>{o=r=null,e("a1").textContent="—",n&&(e("a2").textContent="—"),b()}),y?.addEventListener("input",b),c.addEventListener("input",()=>{const t=x(h(c));t>=.5&&t<=2.5&&R({eyeHeight:t}),b()}),{unmount(){E(),a.replaceChildren()}}}const j=a=>$(a,"height"),A=a=>$(a,"range");export{A as createRange,j as default};
