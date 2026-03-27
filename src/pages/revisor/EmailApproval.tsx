/**
 * Aprobación de Emails — Vista Revisor para aprobar/rechazar emails pendientes.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICard, KPIGrid, KPICardSkeleton, SkeletonBlock, StatusBadge, ConfirmDialog } from '@/components/shared';
import { fetchColaEmails, aprobarEmail } from '@/data/adapters';
import { ColaEmail } from '@/types';
import { timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import { ESTADO_EMAIL } from '@/utils/constants';
import { useHighlightRow } from '@/hooks/useHighlightRow';

export default function EmailApprovalPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  useHighlightRow();
  const [selected, setSelected] = useState<ColaEmail | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['email-approval'],
    queryFn: () => fetchColaEmails({ estado: ESTADO_EMAIL.PENDIENTE_APROBACION }),
  });

  // Auto-select first email when data loads
  useEffect(() => {
    if (emails.length > 0 && !selected) {
      setSelected(emails[0]);
    }
  }, [emails]);

  async function handleAprobar() {
    if (!selected) return;
    setIsApproving(true);
    try {
      await aprobarEmail(selected.id);
      const remaining = emails.filter(e => e.id !== selected.id);
      setSelected(remaining.length > 0 ? remaining[0] : null);
      await queryClient.invalidateQueries({ queryKey: ['email-approval'] });
      await queryClient.invalidateQueries({ queryKey: ['cola-emails'] });
    } catch (err) {
      console.error('Error aprobando:', err);
    } finally {
      setIsApproving(false);
    }
  }

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <KPIGrid columns={2}>
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label={t('emailApproval.pendientesAprobacion')} value={emails.length} icon="⏳" color="var(--color-accent-warning)" />
            <KPICard label={t('emailApproval.estado')} value={emails.length === 0 ? `${t('emailApproval.alDia')} ✅` : t('emailApproval.requiereAtencion')} icon="📧" color={emails.length === 0 ? 'var(--color-accent-success)' : 'var(--color-accent-warning)'} />
          </>
        )}
      </KPIGrid>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-lg)' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)' }}>
              <SkeletonBlock width="60%" height="16px" />
            </div>
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <SkeletonBlock width={`${55 + (i % 3) * 12}%`} height="14px" />
                  <SkeletonBlock width="50%" height="12px" />
                </div>
              ))}
            </div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <SkeletonBlock width="45%" height="22px" />
            <SkeletonBlock width="30%" height="16px" />
            <SkeletonBlock width="100%" height="200px" borderRadius="var(--radius-md)" />
          </div>
        </div>
      ) : emails.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-3xl)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎉</div>
          <h3>{t('emailApproval.sinPendientes')}</h3>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>{t('emailApproval.todosRevisados')}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-lg)' }}>
          {/* Lista */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 'var(--space-md) var(--space-lg)', borderBottom: '1px solid var(--color-border)', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              {t('emailApproval.emailsPendientes')} ({emails.length})
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {emails.map((e, idx) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="animate-cardEnter"
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
                    animationDelay: `${Math.min(idx * 40, 400)}ms`,
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
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t('comunicaciones.asunto')}</label>
                  <p style={{ fontSize: '0.875rem', marginTop: '2px' }}>{selected.asunto}</p>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>{t('emailApproval.mensaje')}</label>
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
                <button className="btn-success btn-lg" onClick={() => setConfirmOpen(true)} disabled={isApproving}>
                  {isApproving ? t('emailApproval.aprobando') : `${t('emailApproval.aprobarEnviar')}`}
                </button>
                {/* Reject functionality not yet implemented — button hidden */}
              </div>

              <ConfirmDialog
                open={confirmOpen}
                title={t('emailApproval.aprobarEnviar')}
                message={`${selected.alumnoNombre || ''} — ${selected.asunto || selected.tipo}`}
                icon="📧"
                confirmLabel={t('emailApproval.aprobarEnviar')}
                variant="success"
                onConfirm={() => {
                  setConfirmOpen(false);
                  handleAprobar();
                }}
                onCancel={() => setConfirmOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
