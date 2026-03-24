/**
 * Gestión de Ediciones — CRUD con capacidad de módulos y toggle activa.
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICardSkeleton, SkeletonBlock, DataTable, Column, StatusBadge } from '@/components/shared';
import { fetchEdiciones, updateEdicion } from '@/data/adapters/airtable/EdicionesAdapter';
import { fetchModulos } from '@/data/adapters/airtable/ModulosAdapter';
import { Edicion, Modulo } from '@/types';
import { formatDate } from '@/utils/formatters';
import { EDITION_ESTADO_COLORS } from '@/utils/constants';
import { useTranslation } from '@/i18n';

/** Animated progress bar that fills from 0 to target width on mount */
function AnimatedBar({ percent, color }: { percent: number; color: string }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(Math.min(percent, 100)));
    return () => cancelAnimationFrame(raf);
  }, [percent]);
  return (
    <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: color,
        borderRadius: 3,
        transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1)',
      }} />
    </div>
  );
}

/** Animated count from 0 to target */
function CountUp({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const t0 = performance.now();
    const animate = () => {
      const p = Math.min((performance.now() - t0) / 800, 1);
      setVal(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return <>{val}</>;
}

export default function EdicionesPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: ediciones = [], isLoading: edicionesLoading } = useQuery({
    queryKey: ['ediciones'],
    queryFn: fetchEdiciones,
  });
  const { data: modulos = [] } = useQuery({
    queryKey: ['modulos'],
    queryFn: fetchModulos,
  });

  function isPastEdicion(e: Edicion): boolean {
    if (e.estado === 'Finalizada') return true;
    if (e.fechaFinCurso && new Date(e.fechaFinCurso) < new Date()) return true;
    if (e.fechaFinInscripcion && new Date(e.fechaFinInscripcion) < new Date() && !e.fechaFinCurso) return true;
    return false;
  }

  async function activarEdicion(edicion: Edicion) {
    try {
      await updateEdicion(edicion.id, { esEdicionActiva: true });
      await queryClient.invalidateQueries({ queryKey: ['ediciones'] });
    } catch (err) {
      console.error('Error activando edicion:', err);
    }
  }

  async function finalizarEdicion(edicion: Edicion) {
    try {
      await updateEdicion(edicion.id, { esEdicionActiva: false, estado: 'Finalizada' });
      await queryClient.invalidateQueries({ queryKey: ['ediciones'] });
    } catch (err) {
      console.error('Error finalizando edicion:', err);
    }
  }

  const activa = ediciones.find(e => e.esEdicionActiva);

  const edicionColumns: Column<Edicion>[] = [
    {
      key: 'nombre', header: t('nav.ediciones'), width: '220px', sortable: true,
      render: (e) => (
        <span style={{ fontWeight: 500 }}>{e.nombre}{e.esEdicionActiva ? ' ★' : ''}</span>
      ),
    },
    {
      key: 'estado', header: t('alumnos.estado'), width: '140px', sortable: true,
      render: (e) => {
        const color = EDITION_ESTADO_COLORS[e.estado] || 'var(--color-text-muted)';
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', borderRadius: 9999,
            fontSize: '0.75rem', fontWeight: 500,
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
            {e.estado}
          </span>
        );
      },
    },
    {
      key: 'fechaInicioInscripcion', header: t('ediciones.inscripciones'), width: '200px',
      render: (e) => <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDate(e.fechaInicioInscripcion)} → {formatDate(e.fechaFinInscripcion)}</span>,
    },
    {
      key: 'actions', header: '', width: '120px', hideable: false,
      render: (e) => {
        const past = isPastEdicion(e);
        const canActivate = e.esEdicionActiva || !past;
        return (
          <button
            className={`btn-sm ${e.esEdicionActiva ? 'btn-danger' : canActivate ? 'btn-primary' : 'btn-ghost'}`}
            disabled={!e.esEdicionActiva && past}
            title={!e.esEdicionActiva && past ? 'No se puede activar una edición pasada' : undefined}
            onClick={(ev) => { ev.stopPropagation(); e.esEdicionActiva ? finalizarEdicion(e) : activarEdicion(e); }}
            style={!e.esEdicionActiva && past ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            {e.esEdicionActiva ? t('common.finalizar') : t('common.activate')}
          </button>
        );
      },
    },
  ];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Info edición activa */}
      {edicionesLoading ? (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SkeletonBlock width="50%" height="20px" />
              <SkeletonBlock width="35%" height="14px" />
            </div>
            <SkeletonBlock width="80px" height="24px" borderRadius="9999px" />
          </div>
        </div>
      ) : activa ? (
        <div className="card" style={{
          borderColor: 'rgba(12, 90, 69, 0.3)',
          background: 'linear-gradient(135deg, rgba(12, 90, 69, 0.06) 0%, rgba(12, 90, 69, 0.02) 100%)',
          boxShadow: '0 0 0 1px rgba(12, 90, 69, 0.1), 0 4px 24px rgba(12, 90, 69, 0.1)',
          animation: 'cardGlow 3s ease-in-out infinite',
        }}>
          <style>{`
            @keyframes cardGlow {
              0%, 100% { box-shadow: 0 0 0 1px rgba(12, 90, 69, 0.1), 0 4px 24px rgba(12, 90, 69, 0.1); }
              50% { box-shadow: 0 0 0 1px rgba(12, 90, 69, 0.2), 0 4px 32px rgba(12, 90, 69, 0.18); }
            }
            @keyframes badgePulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(12, 90, 69, 0.5); }
              50% { box-shadow: 0 0 0 8px rgba(12, 90, 69, 0); }
            }
          `}</style>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-accent-primary)' }}>
                📅 {t('ediciones.edicionActiva')}: {activa.nombre}
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                Inscripciones: {formatDate(activa.fechaInicioInscripcion)} → {formatDate(activa.fechaFinInscripcion)}
              </p>
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 16px', borderRadius: 9999,
              fontSize: '0.8125rem', fontWeight: 600,
              color: '#fff',
              background: 'var(--color-accent-primary)',
              animation: 'badgePulse 2s ease-in-out infinite',
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block', flexShrink: 0 }} />
              Abierta
            </span>
          </div>
        </div>
      ) : null}

      {/* Capacidad de módulos */}
      <div>
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-md)' }}>{t('ediciones.capacidadModulos')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
          {edicionesLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <SkeletonBlock width="55%" height="16px" />
                  <SkeletonBlock width="20%" height="13px" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <SkeletonBlock width="40%" height="13px" />
                  <SkeletonBlock width="30%" height="13px" />
                </div>
                <SkeletonBlock width="100%" height="6px" borderRadius="3px" />
              </div>
            ))
          ) : modulos.map(mod => {
            const capacidad = mod.capacidad || 20;
            const inscritos = mod.inscritos || 0;
            const restantes = capacidad - inscritos;
            const porcentaje = Math.round((inscritos / capacidad) * 100);
            const barColor = porcentaje >= 90 ? 'var(--color-accent-danger)' : porcentaje >= 70 ? 'var(--color-accent-warning)' : 'var(--color-accent-success)';

            return (
              <div key={mod.id} className="card" style={{ padding: 'var(--space-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <span style={{ fontWeight: 600 }}>{mod.nombre}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{mod.moduloId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
                  <span style={{ color: barColor, fontWeight: 600 }}><CountUp target={inscritos} />/{capacidad} {t('ediciones.inscritos')}</span>
                  <span style={{ color: restantes <= 3 ? 'var(--color-accent-danger)' : 'var(--color-text-muted)' }}>
                    <CountUp target={restantes} /> {t('ediciones.plazasLibres')}
                  </span>
                </div>
                <AnimatedBar percent={porcentaje} color={barColor} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                  {mod.precioOnline != null && <span>{mod.precioOnline} EUR</span>}
                  {mod.reservaPrelanzamiento != null && mod.reservaPrelanzamiento > 0 && (
                    <span style={{ color: 'var(--color-accent-warning)' }}>
                      {mod.reservaPrelanzamiento} {t('ediciones.reservasPrelanzamiento')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabla ediciones */}
      <DataTable
        tableId="ediciones"
        title={t('ediciones.todasEdiciones')}
        columns={edicionColumns}
        data={ediciones}
        isLoading={edicionesLoading}
        emptyMessage={t('ediciones.sinEdiciones')}
        emptyIcon="📅"
      />
    </div>
  );
}
