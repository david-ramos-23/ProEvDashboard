import { DataTable, StatusBadge } from 'dashboard';

const alumnos = [
  { id: '1', nombre: 'María García López', email: 'maria.garcia@email.com', modulo: 'Módulo 3', estado: 'Aprobado' },
  { id: '2', nombre: 'Carlos Ruiz Méndez', email: 'carlos.ruiz@email.com', modulo: 'Módulo 2', estado: 'En revisión de video' },
  { id: '3', nombre: 'Lucía Fernández', email: 'lucia.fdez@email.com', modulo: 'Módulo 1', estado: 'Pendiente de pago' },
  { id: '4', nombre: 'Javier Moreno', email: 'j.moreno@email.com', modulo: 'Módulo 3', estado: 'Rechazado' },
  { id: '5', nombre: 'Ana Torres Gil', email: 'ana.torres@email.com', modulo: 'Módulo 2', estado: 'Finalizado' },
];

const columns = [
  { key: 'nombre', header: 'Alumno', sortable: true },
  { key: 'email', header: 'Email' },
  { key: 'modulo', header: 'Módulo', sortable: true },
  { key: 'estado', header: 'Estado', render: (a: any) => <StatusBadge status={a.estado} /> },
];

const frame = { padding: 'var(--space-md)', background: 'var(--color-bg-primary)' };

/** Full table: title, sortable headers, a custom-rendered StatusBadge column. */
export const Listado = () => (
  <div style={frame}>
    <DataTable title="Alumnos — Edición 2026" columns={columns} data={alumnos} />
  </div>
);

/** Loading state: shimmer skeleton rows while data is fetched. */
export const Cargando = () => (
  <div style={frame}>
    <DataTable title="Alumnos — Edición 2026" columns={columns} data={[]} isLoading />
  </div>
);

/** Empty state: configurable icon + message when there are no rows. */
export const Vacio = () => (
  <div style={frame}>
    <DataTable
      title="Alumnos — Edición 2026"
      columns={columns}
      data={[]}
      emptyIcon="📭"
      emptyMessage="No hay alumnos en esta edición todavía"
    />
  </div>
);
