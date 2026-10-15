declare module '@capacitor/core' {
  export interface PluginListenerHandle { remove(): Promise<void> }
  export const Capacitor: { isNativePlatform(): boolean };
  export function registerPlugin<T>(name: string): T;
}
declare module '@capacitor/app' {
  export const App: { exitApp(): Promise<void>; getInfo(): Promise<{ version: string; build: string }>; addListener(ev: string, cb: () => void): Promise<{ remove(): Promise<void> }> };
}
declare module '@capacitor/haptics' {
  export enum ImpactStyle { Light = 'LIGHT', Medium = 'MEDIUM' }
  export const Haptics: { impact(o: { style: ImpactStyle }): Promise<void> };
}
declare module '@capacitor/motion' {
  import type { PluginListenerHandle } from '@capacitor/core';
  export const Motion: { addListener(ev: 'accel', cb: (e: { accelerationIncludingGravity?: { x: number; y: number; z: number } }) => void): Promise<PluginListenerHandle> };
}
declare module '@capacitor/preferences' {
  export const Preferences: { get(o: { key: string }): Promise<{ value: string | null }>; set(o: { key: string; value: string }): Promise<void> };
}
declare module '@zxing/library';
declare module '*.md?raw' { const s: string; export default s; }
declare module '*.css';
declare const __APP_VERSION__: string;
