/**
 * Gestión de Ediciones — CRUD con capacidad de módulos y toggle activa.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICard, KPIGrid, DataTable, StatusBadge, LoadingSpinner, Column } from '@/components/shared';
import { fetchEdiciones, fetchModulos, updateEdicion } from '@/data/adapters/airtable/OtherAdapters';
import { Edicion, Modulo } from '@/types';
import { formatDate } from '@/utils/formatters';

export default function EdicionesPage() {
  const queryClient = useQueryClient();

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

  if (edicionesLoading) return <LoadingSpinner text="Cargando ediciones..." />;

  const activa = ediciones.find(e => e.esEdicionActiva);

  const edicionColumns: Column<Edicion>[] = [
    {
      key: 'nombre', header: 'Edición', width: '200px',
      render: (e) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 500 }}>{e.nombre}</span>
          {e.esEdicionActiva && <span style={{ fontSize: '0.65rem', background: 'var(--color-accent-success)', color: 'white', padding: '1px 6px', borderRadius: '9999px' }}>Activa</span>}
        </div>
      ),
    },
    {
      key: 'estado', header: 'Estado', width: '130px',
      render: (e) => <StatusBadge status={e.estado} />,
    },
    {
      key: 'fechaInicioInscripcion', header: 'Inscripciones', width: '200px',
      render: (e) => <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDate(e.fechaInicioInscripcion)} → {formatDate(e.fechaFinInscripcion)}</span>,
    },
    {
      key: 'actions', header: '', width: '100px',
      render: (e) => (
        <button
          className={`btn-sm ${e.esEdicionActiva ? 'btn-ghost' : 'btn-primary'}`}
          onClick={(ev) => { ev.stopPropagation(); toggleActiva(e); }}
        >
          {e.esEdicionActiva ? 'Desactivar' : 'Activar'}
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
              <h3 style={{ fontSize: 'var(--font-size-lg)' }}>📅 Edición Activa: {activa.nombre}</h3>
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
        <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--font-size-md)' }}>Capacidad de Módulos</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 'var(--space-md)' }}>
          {modulos.map(mod => (
            <div key={mod.id} className="card" style={{ padding: 'var(--space-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <span style={{ fontWeight: 600 }}>{mod.nombre}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{mod.moduloId}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {mod.precioOnline && <span>€{mod.precioOnline}</span>}
              </div>
              {mod.reservaPrelanzamiento != null && mod.reservaPrelanzamiento > 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-accent-warning)', marginTop: '4px' }}>
                  🔒 {mod.reservaPrelanzamiento} plazas reservadas prelanzamiento
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Tabla ediciones */}
      <DataTable
        title="Todas las Ediciones"
        columns={edicionColumns}
        data={ediciones}
        emptyMessage="Sin ediciones registradas"
        emptyIcon="📅"
      />
    </div>
  );
}
