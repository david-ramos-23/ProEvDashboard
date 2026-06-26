import { AnimatedValue } from 'dashboard';

const frame = {
  display: 'flex',
  gap: 'var(--space-2xl)',
  flexWrap: 'wrap',
  padding: 'var(--space-lg)',
  background: 'var(--color-bg-primary)',
  fontFamily: 'var(--font-family)',
};
const value = { fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-accent-primary)' };
const label = { fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', fontWeight: 500 };

/** Count-up on mount; the input format (locale, currency, %) is preserved. */
export const Formatos = () => (
  <div style={frame}>
    <div><div style={label}>Entero</div><div style={value}><AnimatedValue value={1248} /></div></div>
    <div><div style={label}>Moneda</div><div style={value}><AnimatedValue value="€124.500" /></div></div>
    <div><div style={label}>Porcentaje</div><div style={value}><AnimatedValue value="68%" /></div></div>
    <div><div style={label}>Decimal</div><div style={value}><AnimatedValue value="4,8" /></div></div>
  </div>
);
