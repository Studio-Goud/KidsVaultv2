/** How a recorded sound effect is trimmed and levelled; see `src/platform/samples.ts`. */

/**
 * Where the sound really starts, and how loud to play it.
 *
 * Pure, and in a file of its own so the tests can reach it without a browser.
 */
export function measure(data: Float32Array, rate: number): { start: number; level: number } {
  let peak = 0;
  for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; }
  if (peak <= 0) return { start: 0, level: 0 };
  let first = 0;
  while (first < data.length && Math.abs(data[first]) < peak * 0.08) first++;
  // a few milliseconds of run-up, so the attack is not clipped off
  const start = Math.max(0, first / rate - 0.004);
  return { start, level: 0.4 / peak };
}
