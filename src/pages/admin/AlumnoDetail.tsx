/**
 * Detalle de Alumno — Vista individual con tabs.
 * 
 * Muestra: Info general, revisiones, pagos, historial, IA insights.
 * Permite editar estado, notas internas, y plazos.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StatusBadge, LoadingSpinner } from '@/components/shared';
import { fetchAlumnoById, updateAlumno } from '@/data/adapters/airtable/AlumnosAdapter';
import { fetchRevisiones } from '@/data/adapters/airtable/RevisionesAdapter';
import { fetchPagos } from '@/data/adapters/airtable/PagosAdapter';
import { fetchHistorial } from '@/data/adapters/airtable/OtherAdapters';
import { Alumno, RevisionVideo, Pago, Historial, EstadoGeneral } from '@/types';
import { formatDate, formatCurrency, timeAgo, renderStars } from '@/utils/formatters';
import { ESTADO_ICONS } from '@/utils/constants';
import styles from './AlumnoDetail.module.css';

type TabType = 'info' | 'revisiones' | 'pagos' | 'historial' | 'ia';

const ESTADOS: EstadoGeneral[] = [
  'Privado', 'Preinscrito', 'En revision de video', 'Aprobado', 'Rechazado',
  'Pendiente de pago', 'Reserva', 'Pagado', 'Finalizado', 'Plazo Vencido', 'Pago Fallido'
];

export default function AlumnoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [alumno, setAlumno] = useState<Alumno | null>(null);
  const [revisiones, setRevisiones] = useState<RevisionVideo[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Campos editables
  const [editEstado, setEditEstado] = useState<EstadoGeneral | ''>('');
  const [editNotas, setEditNotas] = useState('');
  const [editPlazo, setEditPlazo] = useState('');

  useEffect(() => {
    if (!id) return;
    loadData(id);
  }, [id]);

  async function loadData(alumnoId: string) {
    setIsLoading(true);
    try {
      const a = await fetchAlumnoById(alumnoId);
      setAlumno(a);
      setEditEstado(a.estadoGeneral);
      setEditNotas(a.notasInternas || '');
      setEditPlazo(a.fechaPlazo || '');

      // Cargar datos relacionados en paralelo
      const [revs, pgs, hist] = await Promise.all([
        fetchRevisiones({ alumnoId }).catch(() => []),
        fetchPagos({ alumnoId }).catch(() => []),
        fetchHistorial({ alumnoId, maxRecords: 20 }).catch(() => []),
      ]);
      setRevisiones(revs);
      setPagos(pgs);
      setHistorial(hist);
    } catch (err) {
      console.error('Error cargando alumno:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!alumno || !id) return;
    setIsSaving(true);
    try {
      const updates: Parameters<typeof updateAlumno>[1] = {};
      if (editEstado && editEstado !== alumno.estadoGeneral) {
        updates.estadoGeneral = editEstado;
      }
      if (editNotas !== (alumno.notasInternas || '')) {
        updates.notasInternas = editNotas;
      }
      if (editPlazo !== (alumno.fechaPlazo || '')) {
        updates.fechaPlazo = editPlazo;
      }

      if (Object.keys(updates).length > 0) {
        const updated = await updateAlumno(id, updates);
        setAlumno(updated);
      }
    } catch (err) {
      console.error('Error guardando cambios:', err);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !alumno) return <LoadingSpinner text="Cargando alumno..." />;

  const tabs: { key: TabType; label: string; icon: string; count?: number }[] = [
    { key: 'info', label: 'Información', icon: '📋' },
    { key: 'revisiones', label: 'Revisiones', icon: '🎬', count: revisiones.length },
    { key: 'pagos', label: 'Pagos', icon: '💰', count: pagos.length },
    { key: 'historial', label: 'Historial', icon: '📜', count: historial.length },
    { key: 'ia', label: 'IA Insights', icon: '🤖' },
  ];

  const hasChanges = (
    (editEstado && editEstado !== alumno.estadoGeneral) ||
    editNotas !== (alumno.notasInternas || '') ||
    editPlazo !== (alumno.fechaPlazo || '')
  );

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div className={styles.header}>
        <button className="btn-ghost" onClick={() => navigate('/admin/alumnos')}>
          ← Volver
        </button>
        <div className={styles.headerInfo}>
          <div className={styles.avatar}>
            {alumno.fotoPerfil ? (
              <img src={alumno.fotoPerfil} alt={alumno.nombre} />
            ) : (
              <span>{alumno.nombre.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 className={styles.name}>{alumno.nombre}</h1>
            <div className={styles.meta}>
              <span>{alumno.email}</span>
              {alumno.telefono && <span>📱 {alumno.telefono}</span>}
              <StatusBadge status={alumno.estadoGeneral} type="estado" showIcon />
            </div>
          </div>
        </div>
        {/* Métricas rápidas */}
        <div className={styles.quickStats}>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>Módulo</span>
            <span className={styles.quickValue}>{alumno.moduloSolicitado || '—'}</span>
          </div>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>Idioma</span>
            <span className={styles.quickValue}>{alumno.idioma === 'Ingles' ? '🇬🇧 EN' : '🇪🇸 ES'}</span>
          </div>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>Engagement</span>
            <span className={styles.quickValue} style={{
              color: (alumno.engagementScore || 0) > 70 ? 'var(--color-accent-success)' : (alumno.engagementScore || 0) > 40 ? 'var(--color-accent-warning)' : 'var(--color-accent-danger)'
            }}>
              {alumno.engagementScore != null ? `${alumno.engagementScore}%` : '—'}
            </span>
          </div>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>Puntuación Video</span>
            <span className={styles.quickValue}>{alumno.puntuacionVideo ? renderStars(alumno.puntuacionVideo) : '—'}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span>{tab.icon}</span> {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={styles.tabCount}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      <div className={styles.tabContent}>
        {/* TAB: Info */}
        {activeTab === 'info' && (
          <div className={styles.infoGrid}>
            {/* Columna izquierda: datos */}
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Datos del Alumno</h3>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label>Estado</label>
                  <select
                    value={editEstado}
                    onChange={(e) => setEditEstado(e.target.value as EstadoGeneral)}
                    className={styles.select}
                  >
                    {ESTADOS.map(est => (
                      <option key={est} value={est}>{ESTADO_ICONS[est]} {est}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label>Fecha Plazo</label>
                  <input
                    type="date"
                    value={editPlazo}
                    onChange={(e) => setEditPlazo(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>Preinscripción</label>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{formatDate(alumno.fechaPreinscripcion)}</span>
                </div>
                <div className={styles.field}>
                  <label>Última Modificación</label>
                  <span style={{ color: 'var(--color-text-muted)' }}>{timeAgo(alumno.ultimaModificacion)}</span>
                </div>
              </div>
            </div>

            {/* Columna derecha: notas internas */}
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h3 style={{ marginBottom: 'var(--space-md)' }}>Notas Internas</h3>
              <textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                className={styles.textarea}
                placeholder="Notas privadas sobre este alumno..."
                rows={6}
              />
              {hasChanges && (
                <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : '💾 Guardar Cambios'}
                  </button>
                  <button className="btn-ghost" onClick={() => {
                    setEditEstado(alumno.estadoGeneral);
                    setEditNotas(alumno.notasInternas || '');
                    setEditPlazo(alumno.fechaPlazo || '');
                  }}>
                    Descartar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: Revisiones */}
        {activeTab === 'revisiones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {revisiones.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <span style={{ fontSize: '2rem' }}>🎬</span>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>Sin revisiones de video</p>
              </div>
            ) : revisiones.map(rev => (
              <div key={rev.id} className="card" style={{ padding: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <StatusBadge status={rev.estadoRevision} type="revision" />
                    <span style={{ marginLeft: 'var(--space-sm)', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {formatDate(rev.fechaRevision || rev.createdTime)}
                    </span>
                  </div>
                  <div>{rev.puntuacion ? renderStars(rev.puntuacion) : '—'}</div>
                </div>
                {rev.feedback && (
                  <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{rev.feedback}</p>
                )}
                {rev.videoEnviado && (
                  <a href={rev.videoEnviado} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'inline-block' }}>
                    🎥 Ver video →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: Pagos */}
        {activeTab === 'pagos' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {pagos.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <span style={{ fontSize: '2rem' }}>💳</span>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>Sin pagos registrados</p>
              </div>
            ) : pagos.map(pago => (
              <div key={pago.id} className="card" style={{ padding: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 'var(--font-size-lg)' }}>{formatCurrency(pago.importe, pago.moneda)}</span>
                  <div style={{ marginTop: '2px' }}>
                    <StatusBadge status={pago.estadoPago} type="pago" />
                    <span style={{ marginLeft: 'var(--space-sm)', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{formatDate(pago.fechaPago)}</span>
                  </div>
                </div>
                {pago.linkRecibo && (
                  <a href={pago.linkRecibo} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">📄 Recibo</a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: Historial */}
        {activeTab === 'historial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            {historial.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
                <span style={{ fontSize: '2rem' }}>📜</span>
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>Sin historial</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {historial.map((h, i) => (
                  <div key={h.id} style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    borderBottom: i < historial.length - 1 ? '1px solid var(--color-border)' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ fontSize: '0.8125rem' }}>{h.descripcion || h.tipoAccion}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '8px' }}>{h.origenEvento}</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{timeAgo(h.createdTime)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: IA Insights */}
        {activeTab === 'ia' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="card" style={{ padding: 'var(--space-lg)', background: 'rgba(167, 139, 250, 0.04)', borderColor: 'rgba(167, 139, 250, 0.15)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>🤖 Resumen de Feedback IA</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {alumno.resumenFeedbackIA || 'Sin análisis IA disponible para este alumno.'}
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-lg)', background: 'rgba(6, 182, 212, 0.04)', borderColor: 'rgba(6, 182, 212, 0.15)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>📌 Siguiente Acción Recomendada</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {alumno.siguienteAccionIA || 'Sin acción recomendada por el momento.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
