import { LEVEL_SETTINGS_KEY } from '../core/calib';
import { settings, updateSettings, type LenUnit, type Theme } from '../core/settings';
import { loadJSON, saveJSON } from '../core/storage';
import { fromM, toM, uLabel } from '../core/units';
import { mount, num } from './dom';
import { toast } from './toast';

export function renderSettings(root: HTMLElement): void {
  const s = settings();
  const q = mount(
    root,
    `<section class="pane">
      <div class="box"><div class="note" style="text-align:left;margin-bottom:8px">Тема</div>
        <div class="seg" data-g="theme">
          <button type="button" data-v="system">Системная</button>
          <button type="button" data-v="light">Светлая</button>
          <button type="button" data-v="dark">Тёмная</button>
        </div></div>
      <div class="box"><div class="note" style="text-align:left;margin-bottom:8px">Единицы длины</div>
        <div class="seg" data-g="lenUnit">
          <button type="button" data-v="m">Метры</button>
          <button type="button" data-v="ft">Футы</button>
        </div></div>
      <div class="box row"><label>Высота глаз, ${uLabel()}</label>
        <input class="in" data-id="eye" inputmode="decimal" value="${fromM(s.eyeHeight).toFixed(2)}"></div>
      <div class="box row"><label>Вибро-отклик</label>
        <button type="button" class="btn" data-id="hap"></button></div>
      <div class="btns"><button type="button" class="btn" data-id="rc">Сбросить калибровку уровня</button></div>
      <div class="note">Toolbox работает офлайн, не собирает и не передаёт данные.<br>Датчики: акселерометр и магнитометр.</div>
    </section>`,
  );

  const mark = () => {
    for (const g of root.querySelectorAll<HTMLElement>('[data-g]')) {
      const cur = String(settings()[g.dataset.g as 'theme' | 'lenUnit']);
      for (const b of g.querySelectorAll<HTMLElement>('button'))
        b.classList.toggle('on', b.dataset.v === cur);
    }
    q('hap').textContent = settings().haptics ? 'Вкл' : 'Выкл';
    q('hap').classList.toggle('on', settings().haptics);
  };

  root.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-g] button');
    if (!b) return;
    const key = (b.parentElement as HTMLElement).dataset.g;
    if (key === 'theme') updateSettings({ theme: b.dataset.v as Theme });
    else if (key === 'lenUnit') {
      updateSettings({ lenUnit: b.dataset.v as LenUnit });
      renderSettings(root);
      return;
    }
    mark();
  });

  q<HTMLInputElement>('eye').addEventListener('change', (e) => {
    const v = toM(num(e.target as HTMLInputElement));
    if (v >= 0.5 && v <= 2.5) updateSettings({ eyeHeight: v });
    else toast('Высота глаз от 0.5 до 2.5 м');
    (e.target as HTMLInputElement).value = fromM(settings().eyeHeight).toFixed(2);
  });

  q('hap').addEventListener('click', () => {
    updateSettings({ haptics: !settings().haptics });
    mark();
  });

  q('rc').addEventListener('click', () => {
    void (async () => {
      const cur = await loadJSON<Record<string, unknown>>(LEVEL_SETTINGS_KEY, {});
      await saveJSON(LEVEL_SETTINGS_KEY, { ...cur, ox: 0, oy: 0 });
      toast('Калибровка сброшена');
    })();
  });

  mark();
}
