// Генератор кодов Premium для тестеров: node tools/make-codes.mjs [N]
// Тот же секрет и алгоритм, что в src/core/premium.ts (тест premium сверяет совпадение).
import { createHmac, randomBytes } from 'node:crypto';

export const CODE_SECRET = 'datalaw-design-premium-v1';
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function b32(bytes) {
  let bits = 0, acc = 0, out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(acc >> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

export function makeCode(idBytes) {
  const id = b32(idBytes.subarray(0, 5));
  const sig = b32(createHmac('sha256', CODE_SECRET).update(`premium:${id}`).digest().subarray(0, 5));
  const c = id + sig;
  return `DLD-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}-${c.slice(12, 16)}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = Math.max(1, Math.min(500, Number(process.argv[2]) || 1));
  for (let i = 0; i < n; i++) console.log(makeCode(randomBytes(5)));
}
