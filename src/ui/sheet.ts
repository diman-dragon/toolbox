export interface SheetAction {
  label: string;
  run: () => void;
  primary?: boolean;
}

/** Нижняя шторка с действиями (долгое нажатие на инструмент). */
export function showSheet(title: string, actions: SheetAction[]): void {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const h = document.createElement('h2');
  h.textContent = title;
  sheet.append(h);

  const close = () => back.remove();
  for (const a of [...actions, { label: 'Отмена', run: () => undefined }]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'btn primary' : 'btn';
    b.textContent = a.label;
    b.addEventListener('click', () => {
      close();
      a.run();
    });
    sheet.append(b);
  }
  back.addEventListener('click', (e) => {
    if (e.target === back) close();
  });
  back.append(sheet);
  document.body.append(back);
}
