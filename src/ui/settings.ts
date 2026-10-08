import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { resetAim } from '../core/aim';
import { LEVEL_SETTINGS_KEY } from '../core/calib';
import { settings, updateSettings, type LenUnit, type Theme } from '../core/settings';
import { loadJSON, saveJSON } from '../core/storage';
import { fromM, toM, uLabel } from '../core/units';
import { mount, num } from './dom';
import { toast } from './toast';

async function versionText(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    try {
      const i = await App.getInfo();
      return `${i.version} (сборка ${i.build})`;
    } catch {
      /* ниже вернём версию из package.json */
    }
  }
  return __APP_VERSION__;
}

export function renderSettings(root: HTMLElement): void {
  const s = settings();
  const q = mount(
    root,
    `<section class="pane">
      <div class="box"><div class="set-title">Тема</div>
        <div class="seg" data-g="theme">
          <button type="button" data-v="system">Системная</button>
          <button type="button" data-v="light">Светлая</button>
          <button type="button" data-v="dark">Тёмная</button>
        </div></div>
      <div class="box"><div class="set-title">Единицы длины</div>
        <div class="seg" data-g="lenUnit">
          <button type="button" data-v="m">Метры</button>
          <button type="button" data-v="ft">Футы</button>
        </div></div>
      <div class="box row"><label>Высота камеры над землёй, ${uLabel()}</label>
        <input class="in" data-id="eye" inputmode="decimal" value="${fromM(s.eyeHeight).toFixed(2)}"></div>
      <div class="box row"><label>Вибро-отклик</label>
        <button type="button" class="btn" data-id="hap"></button></div>
      <div class="btns">
        <button type="button" class="btn" data-id="rc">Сбросить калибровку уровня</button>
        <button type="button" class="btn" data-id="ra">Сбросить калибровку горизонта камеры</button>
      </div>
      <div class="box"><div class="set-title">О приложении</div>
        <div class="ver"><span>Версия</span><span data-id="ver">…</span></div></div>
      <div class="note">Toolbox работает офлайн, не собирает и не передаёт данные. Камера нужна высотомеру, дальномеру, отвесу и сканеру, микрофон — шумомеру; кадры и звук нигде не сохраняются.</div>
    </section>`,
  );

  void versionText().then((v) => {
    q('ver').textContent = v;
  });

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
    else toast('Высота камеры от 0.5 до 2.5 м');
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
      toast('Калибровка уровня сброшена');
    })();
  });

  q('ra').addEventListener('click', () => {
    void resetAim().then(() => toast('Калибровка горизонта камеры сброшена'));
  });

  mark();
}
