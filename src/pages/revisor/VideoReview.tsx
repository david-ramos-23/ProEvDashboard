/**
 * Panel de Revisión de Videos — Vista principal del Revisor.
 * 
 * Split layout: Lista de pendientes (izq) + Detalle de revisión (der).
 * Permite aprobar/rechazar videos con puntuación y feedback.
 */

import { useState, useEffect } from 'react';
import { KPICard, KPIGrid, StatusBadge, LoadingSpinner } from '@/components/shared';
import { fetchRevisiones, fetchRevisionStats, updateRevision } from '@/data/adapters/airtable/RevisionesAdapter';
import { RevisionVideo, EstadoRevision } from '@/types';
import { formatDate, renderStars, timeAgo } from '@/utils/formatters';
import styles from './VideoReview.module.css';

export default function VideoReviewPage() {
  const [revisiones, setRevisiones] = useState<RevisionVideo[]>([]);
  const [selected, setSelected] = useState<RevisionVideo | null>(null);
  const [stats, setStats] = useState({ pendientes: 0, revisadasHoy: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Campos editables del detalle
  const [feedback, setFeedback] = useState('');
  const [puntuacion, setPuntuacion] = useState(0);
  const [notas, setNotas] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [revs, st] = await Promise.all([
        fetchRevisiones({ estado: 'Pendiente' }),
        fetchRevisionStats(),
      ]);
      setRevisiones(revs);
      setStats(st);
      if (revs.length > 0 && !selected) {
        selectRevision(revs[0]);
      }
    } catch (err) {
      console.error('Error cargando revisiones:', err);
    } finally {
      setIsLoading(false);
    }
  }

  function selectRevision(rev: RevisionVideo) {
    setSelected(rev);
    setFeedback(rev.feedback || '');
    setPuntuacion(rev.puntuacion || 0);
    setNotas(rev.notasInternas || '');
  }

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

      // Recargar datos
      await loadData();

      // Seleccionar siguiente pendiente
      const remaining = revisiones.filter(r => r.id !== selected.id);
      if (remaining.length > 0) {
        selectRevision(remaining[0]);
      } else {
        setSelected(null);
      }
    } catch (err) {
      console.error('Error guardando revisión:', err);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando revisiones..." />;

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* KPIs */}
      <KPIGrid columns={3}>
        <KPICard label="Pendientes" value={stats.pendientes} icon="⏳" color="var(--color-accent-warning)" />
        <KPICard label="Revisados Hoy" value={stats.revisadasHoy} icon="✅" color="var(--color-accent-success)" />
        <KPICard label="Total Revisiones" value={stats.total} icon="🎬" color="var(--color-accent-primary)" />
      </KPIGrid>

      {/* Split view */}
      <div className={styles.splitView}>
        {/* Lista de pendientes */}
        <div className={styles.list}>
          <div className={styles.listHeader}>
            <h3>Cola de Revisión</h3>
            <span className={styles.count}>{revisiones.length}</span>
          </div>

          {revisiones.length === 0 ? (
            <div className={styles.emptyList}>
              <span style={{ fontSize: '2.5rem' }}>🎉</span>
              <p>¡Sin videos pendientes!</p>
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
                  <a href={selected.videoEnviado} target="_blank" rel="noopener noreferrer" className={styles.videoLink}>
                    <span>🎥</span> Ver Video
                  </a>
                ) : (
                  <p style={{ color: 'var(--color-text-muted)' }}>Sin enlace de video</p>
                )}
              </div>

              {/* IA Insights */}
              {(selected.clasificacionAutomatica || selected.resumenInteligente) && (
                <div className={styles.aiSection}>
                  <h4>🤖 Análisis IA</h4>
                  {selected.clasificacionAutomatica && (
                    <p><strong>Clasificación:</strong> {selected.clasificacionAutomatica}</p>
                  )}
                  {selected.resumenInteligente && (
                    <p>{selected.resumenInteligente}</p>
                  )}
                </div>
              )}

              {/* Puntuación */}
              <div className={styles.field}>
                <label>Puntuación</label>
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
                <label>Feedback</label>
                <textarea
                  className={styles.textarea}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Escribe tu evaluación del video..."
                  rows={4}
                />
              </div>

              {/* Notas internas */}
              <div className={styles.field}>
                <label>Notas Internas</label>
                <textarea
                  className={styles.textarea}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Notas privadas..."
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
                  {isSaving ? 'Guardando...' : '✅ Aprobar'}
                </button>
                <button
                  className="btn-danger btn-lg"
                  onClick={() => handleSave('Rechazado')}
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando...' : '❌ Rechazar'}
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => handleSave('Revision Necesaria')}
                  disabled={isSaving}
                >
                  🔄 Revisión Necesaria
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noSelection}>
              <span style={{ fontSize: '3rem' }}>👈</span>
              <p>Selecciona un video de la cola para revisar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
