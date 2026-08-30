import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlumnos, crearEnvio } from '@/data/adapters';
import { useSchema } from '@/hooks/useSchema';
import { useEdicion } from '@/context/EdicionContext';
import { useTranslation } from '@/i18n';
import { ComposeModalShell } from '@/components/ComposeModalShell';
import { bulkTemplateOptions, resolveRecipients } from '@/lib/bulkTemplates';
import { formatDateTime } from '@/utils/formatters';
import { StatusBadge } from '@/components/shared';
import type { EstadoGeneral } from '@/types';
import styles from './BulkComposeModal.module.css';

type ModalState = 'idle' | 'creating' | 'success' | 'error';

interface BulkComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after `crearEnvio` succeeds — lets the caller refresh a campaign list. */
  onCreated?: () => void;
}

/**
 * Multi-recipient campaign composer. Writes exactly one `Envios de Emails`
 * record with `Estado: 'Borrador'` via `crearEnvio` — never `/api/emails/compose`,
 * and never a per-recipient `Cola de Emails` write.
 */
export function BulkComposeModal({ open, onClose, onCreated }: BulkComposeModalProps) {
  const { t } = useTranslation();
  const { getOptions } = useSchema();
  const { selectedNombre } = useEdicion();

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombre, setNombre] = useState('');
  const [modalState, setModalState] = useState<ModalState>('idle');

  const estadoOptions = getOptions('Alumnos', 'Estado General');
  const tipoOptions = useMemo(
    () => bulkTemplateOptions(getOptions('Envios de Emails', 'Tipo')),
    [getOptions],
  );

  const { data: candidatos = [], isLoading } = useQuery({
    queryKey: ['alumnos-bulk-picker', { estado: estadoFilter, search }],
    queryFn: () => fetchAlumnos({
      estado: (estadoFilter || undefined) as EstadoGeneral | undefined,
      search: search || undefined,
    }),
    enabled: open,
  });

  const { eligible, sinEmail } = useMemo(
    () => resolveRecipients(candidatos, { edicionNombre: selectedNombre || undefined }),
    [candidatos, selectedNombre],
  );

  // Reset the form every time the modal opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setEstadoFilter('');
      setSelectedIds(new Set());
      setTipo('');
      setMensaje('');
      setNombre(`${t('bulkCompose.defaultNamePrefix')} ${selectedNombre || t('bulkCompose.defaultNameFallback')} — ${formatDateTime(new Date().toISOString())}`);
      setModalState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedRecipients = eligible.filter((a) => selectedIds.has(a.id));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedRecipients.length === 0 || !tipo || !mensaje.trim()) return;
    setModalState('creating');
    try {
      await crearEnvio({
        nombre: nombre.trim() || t('bulkCompose.defaultNameFallback'),
        alumnosIds: selectedRecipients.map((a) => a.id),
        tipo,
        mensaje,
      });
      setModalState('success');
      onCreated?.();
    } catch {
      setModalState('error');
    }
  }

  const snapshotTimestamp = formatDateTime(new Date().toISOString());

  return (
    <ComposeModalShell
      open={open}
      onClose={onClose}
      isBusy={modalState === 'creating'}
      titleId="bulk-compose-title"
      showSuccess={modalState === 'success'}
      successTitle={t('bulkCompose.successTitle')}
      successDescription={t('bulkCompose.successDescription')}
      successCloseLabel={t('bulkCompose.closeButton')}
    >
      <h2 id="bulk-compose-title" className={styles.title}>{t('bulkCompose.title')}</h2>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label htmlFor="bulk-nombre" className={styles.label}>{t('bulkCompose.nombreLabel')}</label>
          <input
            id="bulk-nombre"
            type="text"
            className={styles.input}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            disabled={modalState === 'creating'}
            required
          />
        </div>

        <div className={styles.filterRow}>
          <div className={styles.fieldGroup} style={{ flex: 1 }}>
            <label htmlFor="bulk-search" className={styles.label}>{t('bulkCompose.searchLabel')}</label>
            <input
              id="bulk-search"
              type="text"
              className={styles.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('bulkCompose.searchPlaceholder')}
              disabled={modalState === 'creating'}
            />
          </div>
          <div className={styles.fieldGroup} style={{ flex: 1 }}>
            <label htmlFor="bulk-estado" className={styles.label}>{t('bulkCompose.estadoLabel')}</label>
            <select
              id="bulk-estado"
              className={styles.select}
              value={estadoFilter}
              onChange={(e) => setEstadoFilter(e.target.value)}
              disabled={modalState === 'creating'}
            >
              <option value="">{t('bulkCompose.estadoAny')}</option>
              {estadoOptions.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
          </div>
        </div>

        <div className={styles.recipientsPanel}>
          <div className={styles.selectAllBar}>
            <span>{eligible.length} {t('bulkCompose.recipientsFound')}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setSelectedIds(new Set(eligible.map((a) => a.id)))}
                disabled={eligible.length === 0 || modalState === 'creating'}
              >
                {t('bulkCompose.selectAll')}
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setSelectedIds(new Set())}
                disabled={selectedIds.size === 0 || modalState === 'creating'}
              >
                {t('bulkCompose.clearSelection')}
              </button>
            </div>
          </div>
          <div className={styles.recipientList}>
            {isLoading ? (
              <p className={styles.emptyState}>{t('common.loading')}</p>
            ) : eligible.length === 0 && sinEmail.length === 0 ? (
              <p className={styles.emptyState}>{t('bulkCompose.noResults')}</p>
            ) : (
              <>
                {eligible.map((a) => (
                  <label key={a.id} className={styles.recipientRow}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleId(a.id)}
                      disabled={modalState === 'creating'}
                    />
                    <span className={styles.recipientName}>{a.nombre || a.email}</span>
                    <StatusBadge status={a.estadoGeneral} type="estado" />
                  </label>
                ))}
                {sinEmail.map((a) => (
                  <div
                    key={a.id}
                    className={`${styles.recipientRow} ${styles.recipientRowDisabled}`}
                    title={t('bulkCompose.noEmailHint')}
                  >
                    <input type="checkbox" checked={false} disabled readOnly />
                    <span className={styles.recipientName}>{a.nombre || a.id}</span>
                    <span className={styles.noEmailBadge}>{t('bulkCompose.noEmailBadge')}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <p className={styles.previewNote}>
          {selectedRecipients.length} {t('bulkCompose.recipientsSelected')} — {t('bulkCompose.snapshotNote')} {snapshotTimestamp}
        </p>

        <div className={styles.fieldGroup}>
          <label htmlFor="bulk-tipo" className={styles.label}>{t('bulkCompose.templateLabel')}</label>
          <select
            id="bulk-tipo"
            className={styles.select}
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            disabled={modalState === 'creating'}
            required
          >
            <option value="">{t('bulkCompose.templatePlaceholder')}</option>
            {tipoOptions.map(({ key, labelKey }) => <option key={key} value={key}>{t(labelKey)}</option>)}
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label htmlFor="bulk-mensaje" className={styles.label}>{t('bulkCompose.bodyLabel')}</label>
          <textarea
            id="bulk-mensaje"
            className={styles.textarea}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={6}
            disabled={modalState === 'creating'}
            required
          />
        </div>

        {modalState === 'error' && (
          <p className={styles.errorMessage} role="alert">{t('bulkCompose.errorMessage')}</p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
            disabled={modalState === 'creating'}
          >
            {t('bulkCompose.cancelButton')}
          </button>
          <button
            type="submit"
            className={styles.sendButton}
            disabled={modalState === 'creating' || selectedRecipients.length === 0 || !tipo || !mensaje.trim()}
          >
            {modalState === 'creating' ? t('bulkCompose.creatingButton') : t('bulkCompose.confirmButton')}
          </button>
        </div>
      </form>
    </ComposeModalShell>
  );
}
