const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  level: svg(
    '<rect x="4" y="16" width="40" height="16" rx="4"/><circle cx="24" cy="24" r="4"/><path d="M16 16v5M32 16v5M16 32v-5M32 32v-5"/>',
  ),
  rangefinder: svg(
    '<circle cx="24" cy="24" r="11"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10"/><circle cx="24" cy="24" r="1.5"/>',
  ),
  protractor: svg(
    '<path d="M5 38a19 19 0 0 1 38 0z"/><path d="M24 38V30M11 33l3-3M37 33l-3-3M17 21l2 3M31 21l-2 3"/>',
  ),
  compass: svg(
    '<circle cx="24" cy="24" r="18"/><path d="M30 18l-4 12-8 0 4-12z"/><path d="M24 6v4M24 38v4"/>',
  ),
  height: svg(
    '<path d="M24 6v36M18 12l6-6 6 6M18 36l6 6 6-6"/><path d="M8 42h8M32 42h8M34 10h6M34 24h6"/>',
  ),
  angles: svg(
    '<path d="M6 40h36M6 40L36 14"/><path d="M22 40a16 16 0 0 0-5-12M6 40L36 40" stroke-dasharray="2 4"/>',
  ),
  metal: svg(
    '<path d="M12 8v18a12 12 0 0 0 24 0V8"/><path d="M12 14h8M28 14h8"/>',
  ),
  plumb: svg(
    '<path d="M24 5v22"/><path d="M24 27l-7 8 7 8 7-8z"/><path d="M16 5h16"/>',
  ),
  ruler: svg(
    '<rect x="4" y="16" width="40" height="16" rx="2"/><path d="M12 16v6M20 16v9M28 16v6M36 16v9"/>',
  ),
  scanner: svg(
    '<path d="M6 16V9a3 3 0 0 1 3-3h7M32 6h7a3 3 0 0 1 3 3v7M42 32v7a3 3 0 0 1-3 3h-7M16 42H9a3 3 0 0 1-3-3v-7"/><rect x="14" y="14" width="8" height="8" rx="1"/><rect x="26" y="14" width="8" height="8" rx="1"/><rect x="14" y="26" width="8" height="8" rx="1"/><path d="M27 27h2v2h-2zM31 31h3v3h-3zM27 33h2"/>',
  ),
  sound: svg(
    '<path d="M12 18v12M18 10v28M24 15v18M30 6v36M36 14v20M42 21v6"/>',
  ),
  gear: svg(
    '<circle cx="24" cy="24" r="6"/><path d="M24 5v7M24 36v7M5 24h7M36 24h7M10.5 10.5l5 5M32.5 32.5l5 5M37.5 10.5l-5 5M15.5 32.5l-5 5"/>',
  ),
  pin: svg(
    '<path d="M18 6h12l-2 14 7 7H13l7-7z"/><path d="M24 27v15"/>',
  ),
  home: svg(
    '<rect x="6" y="6" width="15" height="15" rx="3"/><rect x="27" y="6" width="15" height="15" rx="3"/><rect x="6" y="27" width="15" height="15" rx="3"/><rect x="27" y="27" width="15" height="15" rx="3"/>',
  ),
  search: svg('<circle cx="21" cy="21" r="13"/><path d="M31 31l12 12"/>'),
  star: svg('<path d="M24 5l5.6 11.6 12.7 1.8-9.2 8.9 2.2 12.6L24 34l-11.3 5.9 2.2-12.6-9.2-8.9 12.7-1.8z"/>'),
  heart: svg('<path d="M24 41S6 30 6 17a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 13-18 24-18 24z"/>'),
  tools: svg('<rect x="6" y="6" width="15" height="15" rx="3"/><rect x="27" y="6" width="15" height="15" rx="3"/><rect x="6" y="27" width="15" height="15" rx="3"/><rect x="27" y="27" width="15" height="15" rx="3"/>'),
  close: svg('<path d="M10 10l28 28M38 10L10 38"/>'),
};
