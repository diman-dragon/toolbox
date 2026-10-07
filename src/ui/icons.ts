const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

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
  plumb: svg(
    '<path d="M24 5v22"/><path d="M24 27l-7 8 7 8 7-8z"/><path d="M16 5h16"/>',
  ),
  ruler: svg(
    '<rect x="4" y="16" width="40" height="16" rx="2"/><path d="M12 16v6M20 16v9M28 16v6M36 16v9"/>',
  ),
};
