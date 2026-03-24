/**
 * Inbox — Bandeja de entrada de emails del sistema ProEv.
 *
 * Layout de dos paneles: lista de emails (izquierda) + detalle (derecha).
 * Filtros por dirección y atención. Permite marcar estado y guardar respuesta.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge, LoadingSpinner } from '@/components/shared';
import { fetchInbox, updateInboxEmail } from '@/data/adapters/airtable/InboxAdapter';
import { InboxEmail } from '@/types';
import { formatDateTime, timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import styles from './Inbox.module.css';

type FilterType = 'all' | 'Recibido' | 'Enviado' | 'atencion';

function buildQueryFilters(filter: FilterType) {
  if (filter === 'Recibido') return { direccion: 'Recibido' };
  if (filter === 'Enviado') return { direccion: 'Enviado' };
  if (filter === 'atencion') return { requiereAtencion: true };
  return {};
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [respuestaFinal, setRespuestaFinal] = useState('');
  const [copied, setCopied] = useState(false);

  const queryFilters = buildQueryFilters(filter);

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['inbox', queryFilters],
    queryFn: () => fetchInbox(queryFilters),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { estado?: string; respuestaFinal?: string } }) =>
      updateInboxEmail(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });

  const filteredEmails = useMemo(() => {
    if (!search.trim()) return emails;
    const q = search.toLowerCase();
    return emails.filter(
      (e) =>
        e.asunto.toLowerCase().includes(q) ||
        e.de.toLowerCase().includes(q) ||
        e.para.toLowerCase().includes(q),
    );
  }, [emails, search]);

  const selected = useMemo(
    () => filteredEmails.find((e) => e.id === selectedId) ?? null,
    [filteredEmails, selectedId],
  );

  function handleSelect(email: InboxEmail) {
    setSelectedId(email.id);
    setRespuestaFinal(email.respuestaFinal || '');
  }

  function handleMarcarLeido() {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, updates: { estado: 'Leido' } });
  }

  function handleMarcarRespondido() {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, updates: { estado: 'Respondido' } });
  }

  function handleGuardarRespuesta() {
    if (!selected) return;
    updateMutation.mutate({ id: selected.id, updates: { respuestaFinal } });
  }

  async function handleCopySugerida() {
    if (!selected?.respuestaSugerida) return;
    await navigator.clipboard.writeText(selected.respuestaSugerida);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filters: { key: FilterType; label: string; icon: string }[] = [
    { key: 'all', label: t('inbox.todos'), icon: '📬' },
    { key: 'Recibido', label: t('inbox.recibidos'), icon: '📥' },
    { key: 'Enviado', label: t('inbox.enviados'), icon: '📤' },
    { key: 'atencion', label: t('inbox.requiereAtencion'), icon: '🔴' },
  ];

  if (isLoading) return <LoadingSpinner text={t('common.loading')} />;

  return (
    <div className={`animate-fadeIn ${styles.page}`}>
      <div className={styles.splitView}>
        {/* ── Panel izquierdo: lista ── */}
        <div className={styles.listPanel}>
          {/* Filtros */}
          <div className={styles.filterBar}>
            {filters.map((f) => (
              <button
                key={f.key}
                className={`${styles.filterBtn} ${filter === f.key ? styles.filterBtnActive : ''}`}
                onClick={() => setFilter(f.key)}
              >
                <span>{f.icon}</span>
                {f.label}
              </button>
            ))}
          </div>

          {/* Buscador */}
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t('common.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Items */}
          <div className={styles.listItems}>
            {filteredEmails.length === 0 ? (
              <div className={styles.emptyList}>
                <span className={styles.emptyIcon}>📭</span>
                <p>{t('inbox.sinEmails')}</p>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <button
                  key={email.id}
                  className={`${styles.emailItem} ${selectedId === email.id ? styles.emailItemActive : ''}`}
                  onClick={() => handleSelect(email)}
                >
                  <div className={styles.emailItemTop}>
                    <span className={styles.dirIcon}>
                      {email.direccion === 'Recibido' ? '📥' : '📤'}
                    </span>
                    <span className={styles.emailAsunto}>{email.asunto || '(sin asunto)'}</span>
                    {email.requiereAtencion && <span className={styles.atenciónDot} aria-label="Requiere atención" />}
                  </div>
                  <div className={styles.emailItemMeta}>
                    <span className={styles.emailContact}>
                      {email.direccion === 'Recibido' ? email.de : email.para}
                    </span>
                    <span className={styles.emailDate}>{timeAgo(email.fecha || email.createdTime)}</span>
                  </div>
                  <div className={styles.emailItemBottom}>
                    <StatusBadge status={email.estado} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Panel derecho: detalle ── */}
        <div className={styles.detailPanel}>
          {selected ? (
            <>
              {/* Cabecera */}
              <div className={styles.detailHeader}>
                <div className={styles.detailHeaderMain}>
                  <h2 className={styles.detailAsunto}>{selected.asunto}</h2>
                  <div className={styles.detailMeta}>
                    <span>
                      <strong>{t('inbox.de')}:</strong> {selected.de}
                    </span>
                    <span>
                      <strong>{t('inbox.para')}:</strong> {selected.para}
                    </span>
                    <span>
                      <strong>{t('inbox.fecha')}:</strong>{' '}
                      {formatDateTime(selected.fecha || selected.createdTime)}
                    </span>
                  </div>
                </div>
                <StatusBadge status={selected.estado} />
              </div>

              {/* Banner atención */}
              {selected.requiereAtencion && (
                <div className={styles.warningBanner}>
                  <span>⚠️</span>
                  <span>{t('inbox.requiereAtencion')}</span>
                </div>
              )}

              {/* Cuerpo del email */}
              <div className={styles.emailBody}>
                <pre className={styles.emailBodyText}>{selected.contenido}</pre>
              </div>

              {/* Resumen IA */}
              {selected.resumenIA && (
                <div className={styles.aiCard}>
                  <div className={styles.aiCardTitle}>🤖 {t('inbox.resumenIA')}</div>
                  <p className={styles.aiCardText}>{selected.resumenIA}</p>
                </div>
              )}

              {/* Respuesta sugerida */}
              {selected.respuestaSugerida && (
                <div className={styles.sugeridaCard}>
                  <div className={styles.sugeridaCardHeader}>
                    <span className={styles.aiCardTitle}>💡 {t('inbox.respuestaSugerida')}</span>
                    <button
                      className="btn-ghost"
                      onClick={handleCopySugerida}
                    >
                      {copied ? '✅ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                  <p className={styles.aiCardText}>{selected.respuestaSugerida}</p>
                </div>
              )}

              {/* Textarea respuesta final */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{t('inbox.respuestaFinal')}</label>
                <textarea
                  className={styles.textarea}
                  value={respuestaFinal}
                  onChange={(e) => setRespuestaFinal(e.target.value)}
                  placeholder={t('inbox.respuestaFinal')}
                  rows={4}
                />
                <div className={styles.fieldActions}>
                  <button
                    className="btn-primary"
                    onClick={handleGuardarRespuesta}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? t('common.saving') : t('inbox.guardarRespuesta')}
                  </button>
                </div>
              </div>

              {/* Botones de estado */}
              <div className={styles.actionRow}>
                <button
                  className="btn-ghost"
                  onClick={handleMarcarLeido}
                  disabled={updateMutation.isPending || selected.estado === 'Leido'}
                >
                  👁 {t('inbox.marcarLeido')}
                </button>
                <button
                  className="btn-ghost"
                  onClick={handleMarcarRespondido}
                  disabled={updateMutation.isPending || selected.estado === 'Respondido'}
                >
                  ✅ {t('inbox.marcarRespondido')}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.noSelection}>
              <span className={styles.noSelectionIcon}>✉️</span>
              <p>{t('inbox.seleccionaEmail')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
