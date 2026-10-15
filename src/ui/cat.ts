/**
 * Котик (контракт 1.6): оригинальный серый полосатый кот — не персонаж фильма и не чужой дизайн.
 * Анимации: хвост, глаза, рот, лапы, пар, сердечки. Реагирует на покупку улыбкой и сердечками (класс .happy).
 * Цвета — токены --cat-* из variables.css (одинаковые во всех трёх темах, «магических» значений в компонентах нет).
 */
export function catSvg(): string {
  return `<svg class="cat" viewBox="0 0 200 180" role="img" aria-hidden="true">
  <g class="cat-tail"><path d="M150 140c34-6 44-40 26-58" fill="none" stroke-width="13" stroke-linecap="round" style="stroke:var(--cat-body)"/><path d="M170 96l8 6M176 112l8 2" stroke-width="4" stroke-linecap="round" style="stroke:var(--cat-stripe)"/></g>
  <ellipse cx="100" cy="142" rx="52" ry="34" style="fill:var(--cat-body)"/>
  <path d="M70 118l6 12M88 112l3 15M112 112l-3 15M130 118l-6 12" stroke-width="5" stroke-linecap="round" style="stroke:var(--cat-stripe)"/>
  <g class="cat-head">
    <path d="M52 66l-6-36 30 16z" style="fill:var(--cat-body)"/><path d="M148 66l6-36-30 16z" style="fill:var(--cat-body)"/>
    <path d="M56 58l-2-16 14 8zM144 58l2-16-14 8z" style="fill:var(--cat-ear)"/>
    <ellipse cx="100" cy="80" rx="54" ry="46" style="fill:var(--cat-head)"/>
    <path d="M100 36v14M86 38l3 12M114 38l-3 12M50 74h12M52 88l11-3M150 74h-12M148 88l-11-3" stroke-width="5" stroke-linecap="round" style="stroke:var(--cat-stripe)"/>
    <ellipse cx="100" cy="98" rx="24" ry="17" style="fill:var(--cat-light)"/>
    <g class="cat-eyes"><ellipse class="eye" cx="78" cy="78" rx="8" ry="10" style="fill:var(--cat-eye)"/><ellipse class="eye" cx="122" cy="78" rx="8" ry="10" style="fill:var(--cat-eye)"/>
      <ellipse cx="78" cy="78" rx="3.4" ry="8" style="fill:var(--cat-pupil)"/><ellipse cx="122" cy="78" rx="3.4" ry="8" style="fill:var(--cat-pupil)"/></g>
    <path d="M95 92h10l-5 6z" style="fill:var(--cat-nose)"/>
    <path class="cat-mouth" d="M88 104q6 6 12 0q6 6 12 0" fill="none" stroke-width="3" stroke-linecap="round" style="stroke:var(--cat-stripe)"/>
    <path d="M70 96l-24-4M70 102l-24 6M130 96l24-4M130 102l24 6" stroke-width="2" stroke-linecap="round" style="stroke:var(--cat-light)"/>
  </g>
  <g class="cat-cup"><path d="M78 132h44l-5 26a6 6 0 0 1-6 5H89a6 6 0 0 1-6-5z" style="fill:var(--cat-light)"/><path d="M122 138q16 2 12 14q-3 6-12 6" fill="none" stroke-width="5" style="stroke:var(--cat-light)"/>
    <path class="steam s1" d="M92 124q-6-8 0-14" fill="none" stroke-width="3" stroke-linecap="round" opacity=".7" style="stroke:var(--cat-light)"/>
    <path class="steam s2" d="M106 124q-6-8 0-14" fill="none" stroke-width="3" stroke-linecap="round" opacity=".7" style="stroke:var(--cat-light)"/></g>
  <ellipse class="paw pl" cx="72" cy="140" rx="11" ry="8" style="fill:var(--cat-head)"/><ellipse class="paw pr" cx="128" cy="140" rx="11" ry="8" style="fill:var(--cat-head)"/>
  <g class="hearts"><path class="h h1" d="M60 40c-4-6-12 0-6 7l6 6 6-6c6-7-2-13-6-7z" style="fill:var(--cat-heart)"/><path class="h h2" d="M146 34c-4-6-12 0-6 7l6 6 6-6c6-7-2-13-6-7z" style="fill:var(--cat-heart)"/><path class="h h3" d="M100 14c-4-6-12 0-6 7l6 6 6-6c6-7-2-13-6-7z" style="fill:var(--cat-heart)"/></g>
</svg>`;
}
