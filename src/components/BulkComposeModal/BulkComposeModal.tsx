import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlumnos, crearEnvio, actualizarEnvio } from '@/data/adapters';
import { useSchema } from '@/hooks/useSchema';
import { useEdicion } from '@/context/EdicionContext';
import { useTranslation } from '@/i18n';
import { ComposeModalShell } from '@/components/ComposeModalShell';
import { bulkTipoOptions, resolveRecipients } from '@/lib/bulkTemplates';
import { formatDateTime } from '@/utils/formatters';
import { StatusBadge } from '@/components/shared';
import type { Alumno, EstadoGeneral, EnvioEmail } from '@/types';
import styles from './BulkComposeModal.module.css';

type ModalState = 'idle' | 'creating' | 'success' | 'error';

interface BulkComposeModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after `crearEnvio`/`actualizarEnvio` succeeds — lets the caller refresh a campaign list. */
  onCreated?: () => void;
  /** When set, the modal edits this existing Borrador campaign via `actualizarEnvio`
   * instead of creating a new one. Only Borrador campaigns should ever be passed here —
   * enforced by the caller (Comunicaciones section), not by this component. */
  editEnvio?: EnvioEmail | null;
  /** Pre-selects these student ids when the modal opens for a NEW campaign — e.g.
   * the Alumnos page's multi-select bulk action. Seeded into `pendingIds`, so it
   * hydrates through the same picker-resolution path as edit-mode ids. Ignored
   * when `editEnvio` is set (edit mode owns the seed in that case). */
  initialSelectedIds?: Set<string>;
}

/**
 * Multi-recipient campaign composer. Writes exactly one `Envios de Emails`
 * record — `Estado: 'Borrador'` via `crearEnvio` when creating, or a field-only
 * patch via `actualizarEnvio` when `editEnvio` is set (never touches `Estado`) —
 * never `/api/emails/compose`, and never a per-recipient `Cola de Emails` write.
 */
export function BulkComposeModal({ open, onClose, onCreated, editEnvio, initialSelectedIds }: BulkComposeModalProps) {
  const { t } = useTranslation();
  const { getOptions } = useSchema();
  const { selectedNombre } = useEdicion();

  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  // The selection holds the RECORDS, not just ids. Rebuilding recipients from
  // the currently visible `eligible` list would silently drop everyone selected
  // under a previous search or state filter: the campaign would go out to the
  // last filter's cohort only, and nothing would say so.
  const [selected, setSelected] = useState<Map<string, Alumno>>(new Map());
  // Edit mode receives recipient IDs without their records. They wait here until
  // the picker surfaces the matching student, then move into `selected`. An ID
  // that never resolves — a recipient chosen under a different edition, say —
  // stays here and is counted, so editing a draft can never quietly shrink it.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [tipo, setTipo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [nombre, setNombre] = useState('');
  const [modalState, setModalState] = useState<ModalState>('idle');

  const estadoOptions = getOptions('Alumnos', 'Estado General');
  const tipoOptions = useMemo(
    () => bulkTipoOptions(getOptions('Envios de Emails', 'Tipo')),
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

  const isEditing = !!editEnvio;

  // Reset (or pre-fill from editEnvio) every time the modal opens
  useEffect(() => {
    if (open) {
      setSearch('');
      setEstadoFilter('');
      // Both paths seed ids that hydrate into records as the picker resolves
      // them, but an id that NEVER hydrates means opposite things:
      //   - editing: a recipient outside the current edition. Legitimate, and
      //     dropping it would shrink a campaign someone already composed.
      //   - new campaign: a student with no email. Including them would count a
      //     recipient that can never be delivered, so `Emails Creados ===
      //     Total Emails` could never hold.
      // Hence the same hydration, different fate on submit (see handleSubmit).
      setSelected(new Map());
      setPendingIds(new Set(editEnvio?.alumnosIds || initialSelectedIds || []));
      setTipo(editEnvio?.tipo || '');
      setMensaje(editEnvio?.mensaje || '');
      setNombre(editEnvio?.nombre ||
        `${t('bulkCompose.defaultNamePrefix')} ${selectedNombre || t('bulkCompose.defaultNameFallback')} — ${formatDateTime(new Date().toISOString())}`);
      setModalState('idle');
    }
    // Depends on `open` ALONE, deliberately. `initialSelectedIds` is a fresh Set
    // on every parent render, and the caller clears its selection in `onCreated`
    // — so listing it here re-ran this block right after a successful save,
    // flipping modalState from 'success' back to 'idle' and replacing the
    // confirmation with a blank form for a campaign that had just been created.
    // Seeding belongs to the closed → open transition, nothing else.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleId(alumno: Alumno) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(alumno.id)) next.delete(alumno.id);
      else next.set(alumno.id, alumno);
      return next;
    });
  }

  // Hydrate pending edit-mode IDs into records as the picker resolves them.
  useEffect(() => {
    if (pendingIds.size === 0) return;
    const found = eligible.filter((a) => pendingIds.has(a.id));
    if (found.length === 0) return;
    setSelected((prev) => {
      const next = new Map(prev);
      for (const a of found) next.set(a.id, a);
      return next;
    });
    setPendingIds((prev) => {
      const next = new Set(prev);
      for (const a of found) next.delete(a.id);
      return next;
    });
  }, [eligible, pendingIds]);

  const selectedRecipients = useMemo(() => [...selected.values()], [selected]);
  // Selected under an earlier filter and no longer on screen, plus edit-mode IDs
  // still unresolved. Surfaced so the footer count never disagrees with the list.
  const offscreenCount = useMemo(() => {
    const visible = new Set(eligible.map((a) => a.id));
    // Pending ids count only when editing, matching what actually ships: on a
    // new campaign they are ineligible students being discarded, so counting
    // them would overstate the cohort the operator is about to mail.
    const pending = isEditing ? pendingIds.size : 0;
    return selectedRecipients.filter((a) => !visible.has(a.id)).length + pending;
  }, [eligible, selectedRecipients, pendingIds, isEditing]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (selectedRecipients.length === 0 || !tipo || !mensaje.trim()) return;
    setModalState('creating');
    try {
      const payload = {
        nombre: nombre.trim() || t('bulkCompose.defaultNameFallback'),
        // Unhydrated ids ship ONLY when editing, where they are recipients the
        // picker cannot currently surface (another edition) and dropping them
        // would shrink an existing campaign. On a NEW campaign an unhydrated id
        // is a student `resolveRecipients` rejected — no email on file — and
        // including them would guarantee `Emails Creados < Total Emails`.
        alumnosIds: isEditing
          ? [...selectedRecipients.map((a) => a.id), ...pendingIds]
          : selectedRecipients.map((a) => a.id),
        tipo,
        mensaje,
      };
      if (isEditing && editEnvio) {
        await actualizarEnvio(editEnvio.id, payload);
      } else {
        await crearEnvio(payload);
      }
      setModalState('success');
      onCreated?.();
    } catch (err) {
      console.error('Failed to save bulk campaign:', err);
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
      successTitle={isEditing ? t('bulkCompose.editSuccessTitle') : t('bulkCompose.successTitle')}
      successDescription={isEditing ? t('bulkCompose.editSuccessDescription') : t('bulkCompose.successDescription')}
      successCloseLabel={t('bulkCompose.closeButton')}
    >
      <h2 id="bulk-compose-title" className={styles.title}>
        {isEditing ? t('bulkCompose.editTitle') : t('bulkCompose.title')}
      </h2>
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
                onClick={() => setSelected((prev) => {
                  // Adds the visible cohort to the selection instead of replacing
                  // it — "select all" under a second filter must not discard what
                  // was picked under the first.
                  const next = new Map(prev);
                  for (const a of eligible) next.set(a.id, a);
                  return next;
                })}
                disabled={eligible.length === 0 || modalState === 'creating'}
              >
                {t('bulkCompose.selectAll')}
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setSelected(new Map())}
                disabled={selectedRecipients.length === 0 || modalState === 'creating'}
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
                      checked={selected.has(a.id)}
                      onChange={() => toggleId(a)}
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
          {offscreenCount > 0 && (
            <span className={styles.offscreenNote}>
              {' · '}{offscreenCount} {t('bulkCompose.offscreenNote')}
            </span>
          )}
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
            {modalState === 'creating'
              ? t('bulkCompose.creatingButton')
              : isEditing ? t('common.save') : t('bulkCompose.confirmButton')}
          </button>
        </div>
      </form>
    </ComposeModalShell>
  );
}
