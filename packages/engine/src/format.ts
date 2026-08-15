/**
 * Number formatting. Guidance text embeds these, so their output is part of the
 * engine's contract, not a display concern, and is asserted in the tests.
 */

/** `R48,000`. South African rands, no cents: these are monthly trading figures. */
export function money(n: number): string {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

/** `R1.2m` / `R48k` / `R950`. For chart axes and tiles where space is tight. */
export function moneyShort(n: number): string {
  if (n >= 1000000) return 'R' + (n / 1000000).toFixed(1) + 'm';
  if (n >= 1000) return 'R' + Math.round(n / 1000) + 'k';
  return 'R' + Math.round(n);
}

/** `+3.8%`. Always signed, so a growth figure never reads as ambiguous. */
export function pct(n: number, d = 1): string {
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(d) + '%';
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** One decimal place. Every score on screen is rounded this way. */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
