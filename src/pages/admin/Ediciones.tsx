/**
 * Gestión de Ediciones — CRUD con capacidad de módulos y toggle activa.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICard, KPIGrid, DataTable, StatusBadge, LoadingSpinner, Column } from '@/components/shared';
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

  async function toggleActiva(edicion: Edicion) {
    try {
      await updateEdicion(edicion.id, { esEdicionActiva: !edicion.esEdicionActiva });
      await queryClient.invalidateQueries({ queryKey: ['ediciones'] });
    } catch (err) {
      console.error('Error actualizando edicion:', err);
    }
  }

  if (edicionesLoading) return <LoadingSpinner text={t('common.loading')} />;

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
      key: 'actions', header: '', width: '100px',
      render: (e) => (
        <button
          className={`btn-sm ${e.esEdicionActiva ? 'btn-ghost' : 'btn-primary'}`}
          onClick={(ev) => { ev.stopPropagation(); toggleActiva(e); }}
        >
          {e.esEdicionActiva ? t('common.deactivate') : t('common.activate')}
        </button>
      ),
    },
  ];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      {/* Info edición activa */}
      {activa && (
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
      )}

      {/* Capacidad de módulos */}
      <div>
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-md)' }}>{t('ediciones.capacidadModulos')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
          {modulos.map(mod => {
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
        emptyMessage={t('ediciones.sinEdiciones')}
        emptyIcon="📅"
      />
    </div>
  );
}
