import { useState, useEffect, useRef } from 'react';

/**
 * Animates a number from 0 to target with ease-out cubic.
 */
export function useCountUp(target: number, decimals: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }

    const t0 = performance.now();
    const animate = () => {
      const elapsed = performance.now() - t0;
      const p = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = target * eased;
      setDisplay(decimals > 0 ? parseFloat(val.toFixed(decimals)) : Math.round(val));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, decimals, duration]);

  return display;
}

/**
 * Parses a formatted value string and returns the numeric value,
 * decimal count, and a re-formatter function.
 */
export function parseFormattedValue(value: string | number): {
  num: number;
  decimals: number;
  format: (n: number) => string;
} | null {
  const str = String(value);
  if (str === '—' || str === '0') return null;

  const m = str.match(/^([^0-9]*?)([\d.,]+)(.*)$/);
  if (!m) return null;

  const [, prefix, numStr, suffix] = m;

  const hasCommaDecimal = /,\d{1,2}$/.test(numStr);
  const hasDotDecimal = /\.\d{1,2}$/.test(numStr) && !hasCommaDecimal;

  let num: number;
  let decimals = 0;
  let localeFormat: 'es' | 'en' = 'es';

  if (hasCommaDecimal) {
    const commaIdx = numStr.lastIndexOf(',');
    decimals = numStr.length - commaIdx - 1;
    num = parseFloat(numStr.replace(/\./g, '').replace(',', '.'));
    localeFormat = 'es';
  } else if (hasDotDecimal) {
    const dotIdx = numStr.lastIndexOf('.');
    decimals = numStr.length - dotIdx - 1;
    num = parseFloat(numStr.replace(/,/g, ''));
    localeFormat = 'en';
  } else {
    num = parseInt(numStr.replace(/[.,]/g, ''), 10);
    localeFormat = numStr.includes('.') ? 'es' : 'en';
  }

  if (isNaN(num)) return null;

  const locale = localeFormat === 'es' ? 'es-ES' : 'en-US';
  const format = (n: number) => {
    const formatted = decimals > 0
      ? n.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toLocaleString(locale);
    return prefix + formatted + suffix;
  };

  return { num, decimals, format };
}

export function AnimatedValue({ value }: { value: string | number }) {
  const parsed = parseFormattedValue(value);
  const animatedNum = useCountUp(parsed?.num ?? 0, parsed?.decimals ?? 0);

  if (!parsed) return <>{value}</>;
  return <>{parsed.format(animatedNum)}</>;
}
