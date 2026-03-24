/**
 * Detalle de Alumno — Vista individual con tabs.
 * 
 * Muestra: Info general, revisiones, pagos, historial, IA insights.
 * Permite editar estado, notas internas, y plazos.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBadge, SkeletonBlock } from '@/components/shared';
import { fetchAlumnoById, updateAlumno } from '@/data/adapters/airtable/AlumnosAdapter';
import { fetchRevisiones } from '@/data/adapters/airtable/RevisionesAdapter';
import { fetchPagos } from '@/data/adapters/airtable/PagosAdapter';
import { fetchHistorial } from '@/data/adapters/airtable/HistorialAdapter';
import { EstadoGeneral } from '@/types';
import { formatDate, formatCurrency, timeAgo, renderStars } from '@/utils/formatters';
import { ESTADO_ICONS } from '@/utils/constants';
import { useTranslation } from '@/i18n';
import styles from './AlumnoDetail.module.css';

type TabType = 'info' | 'revisiones' | 'pagos' | 'historial' | 'ia';

const ESTADOS: EstadoGeneral[] = [
  'Privado', 'Preinscrito', 'En revision de video', 'Aprobado', 'Rechazado',
  'Pendiente de pago', 'Reserva', 'Pagado', 'Finalizado', 'Plazo Vencido', 'Pago Fallido'
];

export default function AlumnoDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [isSaving, setIsSaving] = useState(false);

  // Campos editables
  const [editEstado, setEditEstado] = useState<EstadoGeneral | ''>('');
  const [editNotas, setEditNotas] = useState('');
  const [editPlazo, setEditPlazo] = useState('');

  const { data: alumno, isLoading } = useQuery({
    queryKey: ['alumno', id],
    queryFn: () => fetchAlumnoById(id!),
    enabled: !!id,
  });
  const { data: revisiones = [] } = useQuery({
    queryKey: ['revisiones', { alumnoId: id }],
    queryFn: () => fetchRevisiones({ alumnoId: id }),
    enabled: !!id,
  });
  const { data: pagos = [] } = useQuery({
    queryKey: ['pagos', { alumnoId: id }],
    queryFn: () => fetchPagos({ alumnoId: id }),
    enabled: !!id,
  });
  const { data: historial = [] } = useQuery({
    queryKey: ['historial', { alumnoId: id, maxRecords: 20 }],
    queryFn: () => fetchHistorial({ alumnoId: id, maxRecords: 20 }),
    enabled: !!id,
  });

  // Sync edit fields when alumno data loads
  useEffect(() => {
    if (alumno) {
      setEditEstado(alumno.estadoGeneral);
      setEditNotas(alumno.notasInternas || '');
      setEditPlazo(alumno.fechaPlazo || '');
    }
  }, [alumno]);

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
        await updateAlumno(id, updates);
        await queryClient.invalidateQueries({ queryKey: ['alumno', id] });
        await queryClient.invalidateQueries({ queryKey: ['alumnos'] });
      }
    } catch (err) {
      console.error('Error guardando cambios:', err);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading || !alumno) return (
    <div className={`animate-fadeIn ${styles.container}`}>
      <div className={styles.header}>
        <button className="btn-ghost btn-sm" onClick={() => navigate('/admin/alumnos')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          ← {t('common.back')}
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-md)' }}>
          <SkeletonBlock width="280px" height="28px" />
          <SkeletonBlock width="180px" height="16px" />
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <SkeletonBlock width="100px" height="22px" borderRadius="9999px" />
            <SkeletonBlock width="80px" height="22px" borderRadius="9999px" />
          </div>
        </div>
      </div>
      <div className={styles.tabs}>
        {['info', 'revisiones', 'pagos', 'historial', 'ia'].map((tab) => (
          <div key={tab} className={styles.tab} style={{ opacity: 0.4 }}>
            <SkeletonBlock width="70px" height="14px" />
          </div>
        ))}
      </div>
      <div className={styles.tabContent}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-xl)' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <SkeletonBlock width="30%" height="12px" />
              <SkeletonBlock width={`${50 + i * 8}%`} height="18px" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const tabs: { key: TabType; label: string; icon: string; count?: number }[] = [
    { key: 'info', label: t('alumnos.info'), icon: '📋' },
    { key: 'revisiones', label: t('alumnos.revisiones'), icon: '🎬', count: revisiones.length },
    { key: 'pagos', label: t('nav.pagos'), icon: '💰', count: pagos.length },
    { key: 'historial', label: t('alumnos.historial'), icon: '📜', count: historial.length },
    { key: 'ia', label: t('alumnos.iaInsights'), icon: '🤖' },
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
          ← {t('common.back')}
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
            <span className={styles.quickLabel}>{t('alumnos.modulo')}</span>
            <span className={styles.quickValue}>{alumno.moduloSolicitado || '—'}</span>
          </div>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>{t('alumnos.idioma')}</span>
            <span className={styles.quickValue}>{alumno.idioma === 'Ingles' ? '🇬🇧 EN' : '🇪🇸 ES'}</span>
          </div>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>{t('alumnos.engagementCol')}</span>
            <span className={styles.quickValue} style={{
              color: (alumno.engagementScore || 0) > 70 ? 'var(--color-accent-success)' : (alumno.engagementScore || 0) > 40 ? 'var(--color-accent-warning)' : 'var(--color-accent-danger)'
            }}>
              {alumno.engagementScore != null ? `${alumno.engagementScore}%` : '—'}
            </span>
          </div>
          <div className={styles.quickStat}>
            <span className={styles.quickLabel}>{t('alumnos.puntuacionVideo')}</span>
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
              <h3 style={{ marginBottom: 'var(--space-md)' }}>{t('alumnos.datosAlumno')}</h3>
              <div className={styles.fieldGroup}>
                <div className={styles.field}>
                  <label>{t('alumnos.estado')}</label>
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
                  <label>{t('alumnos.fechaPlazo')}</label>
                  <input
                    type="date"
                    value={editPlazo}
                    onChange={(e) => setEditPlazo(e.target.value)}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label>{t('alumnos.preinscripcion')}</label>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{formatDate(alumno.fechaPreinscripcion)}</span>
                </div>
                <div className={styles.field}>
                  <label>{t('alumnos.ultimaModificacion')}</label>
                  <span style={{ color: 'var(--color-text-muted)' }}>{timeAgo(alumno.ultimaModificacion)}</span>
                </div>
              </div>
            </div>

            {/* Columna derecha: notas internas */}
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h3 style={{ marginBottom: 'var(--space-md)' }}>{t('alumnos.notasInternas')}</h3>
              <textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                className={styles.textarea}
                placeholder={t('alumnos.notasPlaceholder')}
                rows={6}
              />
              {hasChanges && (
                <div style={{ marginTop: 'var(--space-md)', display: 'flex', gap: 'var(--space-sm)' }}>
                  <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? t('common.saving') : `💾 ${t('common.save')}`}
                  </button>
                  <button className="btn-ghost" onClick={() => {
                    setEditEstado(alumno.estadoGeneral);
                    setEditNotas(alumno.notasInternas || '');
                    setEditPlazo(alumno.fechaPlazo || '');
                  }}>
                    {t('common.discard')}
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
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>{t('alumnos.sinRevisiones')}</p>
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
                    🎥 {t('alumnos.verVideo')} →
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
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>{t('alumnos.sinPagos')}</p>
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
                  <a href={pago.linkRecibo} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">📄 {t('alumnos.recibo')}</a>
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
                <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>{t('alumnos.sinHistorial')}</p>
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
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>🤖 {t('alumnos.resumenIA')}</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {alumno.resumenFeedbackIA || t('alumnos.sinAnalisisIA')}
              </p>
            </div>
            <div className="card" style={{ padding: 'var(--space-lg)', background: 'rgba(6, 182, 212, 0.04)', borderColor: 'rgba(6, 182, 212, 0.15)' }}>
              <h4 style={{ marginBottom: 'var(--space-sm)' }}>📌 {t('alumnos.siguienteAccion')}</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                {alumno.siguienteAccionIA || t('alumnos.sinAccionIA')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
