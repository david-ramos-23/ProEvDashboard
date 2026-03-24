/**
 * Gestión de Ediciones — CRUD con capacidad de módulos y toggle activa.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICardSkeleton, SkeletonBlock, DataTable, StatusBadge, Column } from '@/components/shared';
import { fetchEdiciones, updateEdicion } from '@/data/adapters/airtable/EdicionesAdapter';
import { fetchModulos } from '@/data/adapters/airtable/ModulosAdapter';
import { Edicion, Modulo } from '@/types';
import { formatDate } from '@/utils/formatters';
import { useTranslation } from '@/i18n';

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

  async function toggleActiva(edicion: Edicion) {
    try {
      await updateEdicion(edicion.id, { esEdicionActiva: !edicion.esEdicionActiva });
      await queryClient.invalidateQueries({ queryKey: ['ediciones'] });
    } catch (err) {
      console.error('Error actualizando edicion:', err);
    }
  }

  const activa = ediciones.find(e => e.esEdicionActiva);

  const edicionColumns: Column<Edicion>[] = [
    {
      key: 'nombre', header: t('nav.ediciones'), width: '200px',
      render: (e) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 500 }}>{e.nombre}</span>
          {e.esEdicionActiva && <span style={{ fontSize: '0.65rem', background: 'var(--color-accent-success)', color: 'white', padding: '1px 6px', borderRadius: '9999px' }}>Activa</span>}
        </div>
      ),
    },
    {
      key: 'estado', header: t('alumnos.estado'), width: '130px',
      render: (e) => <StatusBadge status={e.estado} />,
    },
    {
      key: 'fechaInicioInscripcion', header: t('ediciones.inscripciones'), width: '200px',
      render: (e) => <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDate(e.fechaInicioInscripcion)} → {formatDate(e.fechaFinInscripcion)}</span>,
    },
    {
      key: 'actions', header: '', width: '120px',
      render: (e) => {
        const past = isPastEdicion(e);
        const canActivate = e.esEdicionActiva || !past;
        return (
          <button
            className={`btn-sm ${e.esEdicionActiva ? 'btn-ghost' : canActivate ? 'btn-primary' : 'btn-ghost'}`}
            disabled={!e.esEdicionActiva && past}
            title={!e.esEdicionActiva && past ? 'No se puede activar una edición pasada' : undefined}
            onClick={(ev) => { ev.stopPropagation(); toggleActiva(e); }}
            style={!e.esEdicionActiva && past ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
          >
            {e.esEdicionActiva ? t('common.deactivate') : t('common.activate')}
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
        <div className="card" style={{ borderColor: 'rgba(34, 197, 94, 0.2)', background: 'rgba(34, 197, 94, 0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 'var(--font-size-lg)' }}>📅 {t('ediciones.edicionActiva')}: {activa.nombre}</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                Inscripciones: {formatDate(activa.fechaInicioInscripcion)} → {formatDate(activa.fechaFinInscripcion)}
              </p>
            </div>
            <StatusBadge status={activa.estado} />
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
                  <span style={{ color: barColor, fontWeight: 600 }}>{inscritos}/{capacidad} {t('ediciones.inscritos')}</span>
                  <span style={{ color: restantes <= 3 ? 'var(--color-accent-danger)' : 'var(--color-text-muted)' }}>
                    {restantes} {t('ediciones.plazasLibres')}
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(porcentaje, 100)}%`, background: barColor, borderRadius: 3, transition: 'width 300ms ease' }} />
                </div>
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
