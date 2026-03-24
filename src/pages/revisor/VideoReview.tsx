/**
 * Panel de Revisión de Videos — Vista principal del Revisor.
 * 
 * Split layout: Lista de pendientes (izq) + Detalle de revisión (der).
 * Permite aprobar/rechazar videos con puntuación y feedback.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICard, KPIGrid, KPICardSkeleton, SkeletonBlock, StatusBadge } from '@/components/shared';
import { fetchRevisiones, fetchRevisionStats, updateRevision } from '@/data/adapters/airtable/RevisionesAdapter';
import { RevisionVideo, EstadoRevision } from '@/types';
import { formatDate, renderStars, timeAgo } from '@/utils/formatters';
import styles from './VideoReview.module.css';
import { useTranslation } from '@/i18n';

function VideoPlayer({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
  if (ytMatch) {
    return (
      <iframe
        className={styles.videoEmbed}
        src={`https://www.youtube.com/embed/${ytMatch[1]}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Video de admisión"
      />
    );
  }

  if (!errored && /\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) {
    return (
      <video
        className={styles.videoEmbed}
        src={url}
        controls
        onError={() => setErrored(true)}
      />
    );
  }

  if (!errored) {
    return (
      <iframe
        className={styles.videoEmbed}
        src={url}
        title="Video de admisión"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.videoFallback}>
      <span>🎥</span> Abrir video externamente →
    </a>
  );
}

export default function VideoReviewPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [selected, setSelected] = useState<RevisionVideo | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Campos editables del detalle
  const [feedback, setFeedback] = useState('');
  const [puntuacion, setPuntuacion] = useState(0);
  const [notas, setNotas] = useState('');

  const { data: revisiones = [], isLoading } = useQuery({
    queryKey: ['revisiones', { estado: 'Pendiente' }],
    queryFn: () => fetchRevisiones({ estado: 'Pendiente' }),
  });
  const { data: stats = { pendientes: 0, revisadasHoy: 0, total: 0 } } = useQuery({
    queryKey: ['revision-stats'],
    queryFn: fetchRevisionStats,
  });

  function selectRevision(rev: RevisionVideo) {
    setSelected(rev);
    setFeedback(rev.feedback || '');
    setPuntuacion(rev.puntuacion || 0);
    setNotas(rev.notasInternas || '');
  }

  // Auto-select first revision when data loads
  useEffect(() => {
    if (revisiones.length > 0 && !selected) {
      selectRevision(revisiones[0]);
    }
  }, [revisiones]);

  async function handleSave(estado: EstadoRevision) {
    if (!selected) return;
    setIsSaving(true);
    try {
      await updateRevision(selected.id, {
        estadoRevision: estado,
        puntuacion: puntuacion || undefined,
        feedback: feedback || undefined,
        notasInternas: notas || undefined,
      });

      // Select next before invalidating so we don't lose context
      const remaining = revisiones.filter(r => r.id !== selected.id);
      if (remaining.length > 0) {
        selectRevision(remaining[0]);
      } else {
        setSelected(null);
      }

      await queryClient.invalidateQueries({ queryKey: ['revisiones'] });
      await queryClient.invalidateQueries({ queryKey: ['revision-stats'] });
    } catch (err) {
      console.error('Error guardando revision:', err);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <KPIGrid columns={3}>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <KPICardSkeleton key={i} />)
        ) : (
          <>
            <KPICard label={t('videoReview.pendientes')} value={stats.pendientes} icon="⏳" color="var(--color-accent-warning)" />
            <KPICard label={t('videoReview.revisadosHoy')} value={stats.revisadasHoy} icon="✅" color="var(--color-accent-success)" />
            <KPICard label={t('videoReview.totalRevisiones')} value={stats.total} icon="🎬" color="var(--color-accent-primary)" />
          </>
        )}
      </KPIGrid>

      {/* Split view */}
      <div className={styles.splitView}>
        {/* Lista de pendientes */}
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h3>{t('videoReview.colaRevision')}</h3>
            <span className={styles.count}>{revisiones.length}</span>
          </div>

          {isLoading ? (
            <div className={styles.listItems}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <SkeletonBlock width={`${55 + (i % 3) * 12}%`} height="15px" />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <SkeletonBlock width="70px" height="20px" borderRadius="9999px" />
                    <SkeletonBlock width="50px" height="12px" />
                  </div>
                </div>
              ))}
            </div>
          ) : revisiones.length === 0 ? (
            <div className={styles.emptyList}>
              <span style={{ fontSize: '2.5rem' }}>🎉</span>
              <p>{t('videoReview.sinPendientes')}</p>
            </div>
          ) : (
            <div className={styles.listItems}>
              {revisiones.map((rev) => (
                <button
                  key={rev.id}
                  className={`${styles.listItem} ${selected?.id === rev.id ? styles.listItemActive : ''}`}
                  onClick={() => selectRevision(rev)}
                >
                  <div className={styles.itemName}>{rev.alumnoNombre || 'Sin nombre'}</div>
                  <div className={styles.itemMeta}>
                    {rev.clasificacionAutomatica && (
                      <StatusBadge status={rev.clasificacionAutomatica} type="revision" />
                    )}
                    <span className={styles.itemDate}>{timeAgo(rev.createdTime)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detalle de revisión */}
        <div className={styles.detail}>
          {selected ? (
            <>
              {/* Header */}
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{selected.alumnoNombre || 'Sin nombre'}</h2>
                  <p className={styles.detailSub}>{selected.redesSociales || selected.usuariosRRSS || ''}</p>
                </div>
                <StatusBadge status={selected.estadoRevision} type="revision" />
              </div>

              {/* Video */}
              <div className={styles.videoSection}>
                {selected.videoEnviado ? (
                  <>
                    <VideoPlayer url={selected.videoEnviado} />
                    <a href={selected.videoEnviado} target="_blank" rel="noopener noreferrer" className={styles.videoExternalLink}>
                      Abrir en nueva pestaña →
                    </a>
                  </>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>{t('videoReview.sinVideo')}</p>
                )}
              </div>

              {/* IA Insights */}
              {(selected.clasificacionAutomatica || selected.resumenInteligente) && (
                <div className={styles.aiSection}>
                  <h4>🤖 {t('videoReview.analisisIA')}</h4>
                  {selected.clasificacionAutomatica && (
                    <p><strong>{t('videoReview.clasificacion')}:</strong> {selected.clasificacionAutomatica}</p>
                  )}
                  {selected.resumenInteligente && (
                    <p>{selected.resumenInteligente}</p>
                  )}
                </div>
              )}

              {/* Puntuación */}
              <div className={styles.field}>
                <label>{t('videoReview.puntuacion')}</label>
                <div className={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      className={`${styles.star} ${star <= puntuacion ? styles.starFilled : ''}`}
                      onClick={() => setPuntuacion(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Feedback */}
              <div className={styles.field}>
                <label>{t('videoReview.feedback')}</label>
                <textarea
                  className={styles.textarea}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={t('videoReview.feedbackPlaceholder')}
                  rows={4}
                />
              </div>

              {/* Notas internas */}
              <div className={styles.field}>
                <label>{t('alumnos.notasInternas')}</label>
                <textarea
                  className={styles.textarea}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder={t('videoReview.notasPlaceholder')}
                  rows={2}
                />
              </div>

              {/* Botones de acción */}
              <div className={styles.actions}>
                <button
                  className="btn-success btn-lg"
                  onClick={() => handleSave('Aprobado')}
                  disabled={isSaving}
                >
                  {isSaving ? t('common.saving') : `✅ ${t('videoReview.aprobar')}`}
                </button>
                <button
                  className="btn-danger btn-lg"
                  onClick={() => handleSave('Rechazado')}
                  disabled={isSaving}
                >
                  {isSaving ? t('common.saving') : `❌ ${t('videoReview.rechazar')}`}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => handleSave('Revision Necesaria')}
                  disabled={isSaving}
                >
                  🔄 {t('videoReview.revisionNecesaria')}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noSelection}>
              <span style={{ fontSize: '3rem' }}>👈</span>
              <p>{t('videoReview.seleccionaVideo')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
