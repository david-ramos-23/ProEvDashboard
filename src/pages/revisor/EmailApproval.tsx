/**
 * Aprobación de Emails — Vista Revisor para aprobar/rechazar emails pendientes.
 */

import { useState, useEffect } from 'react';
import { KPICard, KPIGrid, LoadingSpinner, StatusBadge } from '@/components/shared';
import { fetchColaEmails, aprobarEmail } from '@/data/adapters/airtable/OtherAdapters';
import { ColaEmail } from '@/types';
import { timeAgo } from '@/utils/formatters';

export default function EmailApprovalPage() {
  const [emails, setEmails] = useState<ColaEmail[]>([]);
  const [selected, setSelected] = useState<ColaEmail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    loadEmails();
  }, []);

  async function loadEmails() {
    try {
      const data = await fetchColaEmails({ estado: 'Pendiente Aprobacion' });
      setEmails(data);
      if (data.length > 0 && !selected) setSelected(data[0]);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAprobar() {
    if (!selected) return;
    setIsApproving(true);
    try {
      await aprobarEmail(selected.id);
      await loadEmails();
      const remaining = emails.filter(e => e.id !== selected.id);
      setSelected(remaining.length > 0 ? remaining[0] : null);
    } catch (err) {
      console.error('Error aprobando:', err);
    } finally {
      setIsApproving(false);
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando emails..." />;

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <KPIGrid columns={2}>
        <KPICard label="Pendientes de Aprobación" value={emails.length} icon="⏳" color="var(--color-accent-warning)" />
        <KPICard label="Estado" value={emails.length === 0 ? 'Al día ✅' : 'Requiere atención'} icon="📧" color={emails.length === 0 ? 'var(--color-accent-success)' : 'var(--color-accent-warning)'} />
      </KPIGrid>

      {emails.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎉</div>
          <h3>¡Sin emails pendientes de aprobación!</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>Todos los emails han sido revisados.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-lg)' }}>
          {/* Lista */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              Emails Pendientes ({emails.length})
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {emails.map(e => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: selected?.id === e.id ? 'var(--color-accent-primary-glow)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    transition: 'background 150ms ease',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{e.alumnoNombre || '—'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{e.tipo}</span>
                    <span>{timeAgo(e.createdTime)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {selected && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3>{selected.alumnoNombre || 'Sin nombre'}</h3>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '4px' }}>
                    <StatusBadge status={selected.tipo} />
                    <StatusBadge status={selected.estado} type="email" />
                  </div>
                </div>
              </div>

              {selected.asunto && (
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Asunto</label>
                  <p style={{ fontSize: '0.875rem', marginTop: '2px' }}>{selected.asunto}</p>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Mensaje</label>
                <div style={{
                  marginTop: '4px',
                  padding: 'var(--space-md)',
                  background: 'var(--color-bg-input)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.6,
                  maxHeight: 300,
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}>
                  {selected.mensaje}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-md)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)' }}>
                <button className="btn-success btn-lg" onClick={handleAprobar} disabled={isApproving}>
                  {isApproving ? 'Aprobando...' : '✅ Aprobar y Enviar'}
                </button>
                <button className="btn-danger" disabled={isApproving}>
                  ❌ Rechazar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
