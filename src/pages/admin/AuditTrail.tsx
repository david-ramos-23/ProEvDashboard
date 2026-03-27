/**
 * Audit Trail — registro de todos los cambios realizados en el sistema.
 * Solo disponible cuando VITE_DATA_SOURCE=supabase (retorna vacío con Airtable).
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/shared';
import { fetchRecentAudit } from '@/data/adapters';
import type { AuditEntry } from '@/data/adapters';
import { useTranslation } from '@/i18n';
import { formatDateTime } from '@/utils/formatters';
import styles from './AuditTrail.module.css';

const TABLE_LABELS: Record<string, string> = {
  alumnos: 'Alumnos',
  revisiones_video: 'Revisiones',
  pagos: 'Pagos',
  cola_emails: 'Emails',
  inbox: 'Inbox',
  ediciones: 'Ediciones',
  historial: 'Historial',
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  INSERT: { label: 'Crear', color: 'var(--color-success, #22c55e)' },
  UPDATE: { label: 'Editar', color: 'var(--color-warning, #f59e0b)' },
  DELETE: { label: 'Eliminar', color: 'var(--color-danger, #ef4444)' },
};

const TABLES = ['', 'alumnos', 'revisiones_video', 'pagos', 'cola_emails', 'inbox', 'ediciones', 'historial'];

function FieldChanges({ changes, action }: { changes: AuditEntry['fieldChanges']; action: string }) {
  if (!changes || Object.keys(changes).length === 0) return <span className={styles.noChanges}>—</span>;

  if (action === 'INSERT') {
    return <span className={styles.insertLabel}>Registro creado</span>;
  }

  if (action === 'DELETE') {
    return <span className={styles.deleteLabel}>Registro eliminado</span>;
  }

  const entries = Object.entries(changes).filter(
    ([key]) => !['id', 'created_at', 'updated_at'].includes(key)
  );

  if (entries.length === 0) return <span className={styles.noChanges}>—</span>;

  return (
    <div className={styles.changesList}>
      {entries.slice(0, 3).map(([field, diff]) => (
        <div key={field} className={styles.changeItem}>
          <span className={styles.fieldName}>{field}</span>
          {diff && typeof diff === 'object' && 'old' in diff ? (
            <>
              <span className={styles.oldValue}>{String(diff.old || '—').slice(0, 30)}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.newValue}>{String(diff.new || '—').slice(0, 30)}</span>
            </>
          ) : null}
        </div>
      ))}
      {entries.length > 3 && (
        <span className={styles.moreChanges}>+{entries.length - 3} más</span>
      )}
    </div>
  );
}

export default function AuditTrailPage() {
  const { t } = useTranslation();
  const [filtroTabla, setFiltroTabla] = useState('');
  const [filtroAccion, setFiltroAccion] = useState('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit-trail', 200],
    queryFn: () => fetchRecentAudit(200),
  });

  const filtered = useMemo(() => {
    let result = entries;
    if (filtroTabla) result = result.filter((e) => e.tableName === filtroTabla);
    if (filtroAccion) result = result.filter((e) => e.action === filtroAccion);
    return result;
  }, [entries, filtroTabla, filtroAccion]);

  const stats = useMemo(() => {
    const inserts = entries.filter((e) => e.action === 'INSERT').length;
    const updates = entries.filter((e) => e.action === 'UPDATE').length;
    const deletes = entries.filter((e) => e.action === 'DELETE').length;
    const users = new Set(entries.map((e) => e.userEmail).filter(Boolean)).size;
    return { inserts, updates, deletes, users };
  }, [entries]);

  const columns = useMemo<Column<AuditEntry>[]>(
    () => [
      {
        key: 'createdAt',
        header: t('inbox.fecha'),
        width: '150px',
        sortable: true,
        minWidth: 120,
        render: (e) => (
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
            {formatDateTime(e.createdAt)}
          </span>
        ),
      },
      {
        key: 'action',
        header: 'Acción',
        width: '90px',
        sortable: true,
        minWidth: 70,
        render: (e) => {
          const info = ACTION_LABELS[e.action] || { label: e.action, color: 'var(--color-text-secondary)' };
          return (
            <span className={styles.actionBadge} style={{ '--badge-color': info.color } as React.CSSProperties}>
              {info.label}
            </span>
          );
        },
      },
      {
        key: 'tableName',
        header: 'Tabla',
        width: '120px',
        sortable: true,
        minWidth: 90,
        render: (e) => <span className={styles.tableBadge}>{TABLE_LABELS[e.tableName] || e.tableName}</span>,
      },
      {
        key: 'userEmail',
        header: 'Usuario',
        width: '180px',
        sortable: true,
        minWidth: 120,
        render: (e) => (
          <span style={{ fontSize: '0.8125rem' }}>{e.userEmail || 'sistema'}</span>
        ),
      },
      {
        key: 'fieldChanges' as keyof AuditEntry,
        header: 'Cambios',
        width: '1fr',
        minWidth: 200,
        render: (e) => <FieldChanges changes={e.fieldChanges} action={e.action} />,
      },
    ],
    [t]
  );

  const isSupabase = import.meta.env.VITE_DATA_SOURCE === 'supabase';

  if (!isSupabase) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>{t('audit.title')}</h2>
          <p>{t('audit.onlySupabase')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.inserts}</span>
          <span className={styles.statLabel}>Creaciones</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.updates}</span>
          <span className={styles.statLabel}>Ediciones</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.deletes}</span>
          <span className={styles.statLabel}>Eliminaciones</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.users}</span>
          <span className={styles.statLabel}>Usuarios</span>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select
          value={filtroTabla}
          onChange={(e) => setFiltroTabla(e.target.value)}
          className={styles.select}
        >
          <option value="">Todas las tablas</option>
          {TABLES.filter(Boolean).map((t) => (
            <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>
          ))}
        </select>
        <select
          value={filtroAccion}
          onChange={(e) => setFiltroAccion(e.target.value)}
          className={styles.select}
        >
          <option value="">Todas las acciones</option>
          <option value="INSERT">Crear</option>
          <option value="UPDATE">Editar</option>
          <option value="DELETE">Eliminar</option>
        </select>
        <span className={styles.resultCount}>
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(e) => e.id}
        isLoading={isLoading}
        emptyMessage={t('audit.sinRegistros')}
        defaultSortKey="createdAt"
        defaultSortDir="desc"
      />
    </div>
  );
}
