import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { settings } from './settings';

export function tick(style: 'Light' | 'Medium' = 'Light'): void {
  if (!settings().haptics) return;
  void Haptics.impact({ style: style === 'Light' ? ImpactStyle.Light : ImpactStyle.Medium }).catch(
    () => undefined,
  );
}
