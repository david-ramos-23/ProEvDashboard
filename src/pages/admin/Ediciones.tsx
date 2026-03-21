/**
 * Gestión de Ediciones — CRUD con capacidad de módulos y toggle activa.
 */

import { useState, useEffect } from 'react';
import { KPICard, KPIGrid, DataTable, StatusBadge, LoadingSpinner, Column } from '@/components/shared';
import { fetchEdiciones, fetchModulos, updateEdicion } from '@/data/adapters/airtable/OtherAdapters';
import { Edicion, Modulo } from '@/types';
import { formatDate } from '@/utils/formatters';

export default function EdicionesPage() {
  const [ediciones, setEdiciones] = useState<Edicion[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [e, m] = await Promise.all([fetchEdiciones(), fetchModulos()]);
      setEdiciones(e);
      setModulos(m);
    } catch (err) {
      console.error('Error cargando ediciones:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleActiva(edicion: Edicion) {
    try {
      await updateEdicion(edicion.id, { esEdicionActiva: !edicion.esEdicionActiva });
      await loadData();
    } catch (err) {
      console.error('Error actualizando edición:', err);
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando ediciones..." />;

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
      key: 'esPrelanzamiento', header: 'Prelanzamiento', width: '120px',
      render: (e) => e.esPrelanzamiento ? <span style={{ color: 'var(--color-accent-warning)' }}>🚀 Sí</span> : <span style={{ color: 'var(--color-text-muted)' }}>No</span>,
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
                {activa.esPrelanzamiento && ' (🚀 Prelanzamiento)'}
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
              {/* Barra de capacidad */}
              <div style={{ height: 8, background: 'var(--color-bg-input)', borderRadius: 9999, overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{
                  height: '100%',
                  width: '0%', // Se actualizará con datos reales de inscritos
                  background: 'linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-info))',
                  borderRadius: 9999,
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                <span>Capacidad: {mod.capacidad}</span>
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
