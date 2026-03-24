/**
 * Inbox — Bandeja de entrada de emails del sistema ProEv.
 *
 * Task-queue style: prioritized card list with inline accordion expansion.
 * Sort: requiereAtencion → Nuevo (unread) → by date.
 * Each card expands inline to show full content + response area.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge, SkeletonBlock } from '@/components/shared';
import { fetchInbox, updateInboxEmail } from '@/data/adapters/airtable/InboxAdapter';
import { InboxEmail } from '@/types';
import { timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import styles from './Inbox.module.css';

type FilterType = 'all' | 'atencion' | 'sinResponder' | 'Recibido' | 'Enviado';

function buildQueryFilters(filter: FilterType) {
  if (filter === 'Recibido') return { direccion: 'Recibido' };
  if (filter === 'Enviado') return { direccion: 'Enviado' };
  if (filter === 'atencion') return { requiereAtencion: true };
  return {};
}

function sortEmails(emails: InboxEmail[]): InboxEmail[] {
  return [...emails].sort((a, b) => {
    // 1. requiereAtencion first
    if (a.requiereAtencion && !b.requiereAtencion) return -1;
    if (!a.requiereAtencion && b.requiereAtencion) return 1;
    // 2. Nuevo (unread) before others
    const aNew = a.estado === 'Nuevo';
    const bNew = b.estado === 'Nuevo';
    if (aNew && !bNew) return -1;
    if (!aNew && bNew) return 1;
    // 3. Date descending
    const aDate = a.fecha || a.createdTime;
    const bDate = b.fecha || b.createdTime;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

interface EmailCardProps {
  email: InboxEmail;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, updates: { estado?: string; respuestaFinal?: string }) => void;
  isPending: boolean;
}

function EmailCard({ email, isExpanded, onToggle, onUpdate, isPending }: EmailCardProps) {
  const { t } = useTranslation();
  const [respuesta, setRespuesta] = useState(email.respuestaFinal || '');
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!email.respuestaSugerida) return;
    await navigator.clipboard.writeText(email.respuestaSugerida);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isUnread = email.estado === 'Nuevo';

  return (
    <div className={`${styles.emailCard} ${isExpanded ? styles.emailCardExpanded : ''} ${email.requiereAtencion ? styles.emailCardAlert : ''}`}>
      {/* Card header — always visible, click to expand */}
      <button className={styles.emailCardHeader} onClick={onToggle}>
        <div className={styles.cardLeft}>
          <div className={styles.cardIconRow}>
            <span className={styles.dirIcon} title={email.direccion}>
              {email.direccion === 'Recibido' ? '📥' : '📤'}
            </span>
            {isUnread && <span className={styles.unreadDot} />}
            {email.requiereAtencion && <span className={styles.alertDot} title="Requiere atención">!</span>}
          </div>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardTopRow}>
            <span className={`${styles.cardSubject} ${isUnread ? styles.cardSubjectUnread : ''}`}>
              {email.asunto || '(sin asunto)'}
            </span>
            <span className={styles.cardTime}>{timeAgo(email.fecha || email.createdTime)}</span>
          </div>
          <div className={styles.cardMetaRow}>
            <span className={styles.cardContact}>
              {email.direccion === 'Recibido' ? email.de : email.para}
            </span>
            <StatusBadge status={email.estado} />
          </div>
          {email.resumenIA && !isExpanded && (
            <div className={styles.cardSnippet}>{email.resumenIA}</div>
          )}
        </div>
        <span className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ''}`}>›</span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className={styles.expandedBody}>
          {email.requiereAtencion && (
            <div className={styles.alertBanner}>
              <span>⚠️</span> {t('inbox.requiereAtencion')}
            </div>
          )}

          {/* Email body */}
          <div className={styles.emailBodySection}>
            <div className={styles.emailMeta}>
              <span><strong>De:</strong> {email.de}</span>
              <span><strong>Para:</strong> {email.para}</span>
            </div>
            <pre className={styles.emailBodyText}>{email.contenido || '(sin contenido)'}</pre>
          </div>

          {/* AI summary */}
          {email.resumenIA && (
            <div className={styles.aiCard}>
              <div className={styles.aiCardTitle}>🤖 {t('inbox.resumenIA')}</div>
              <p className={styles.aiCardText}>{email.resumenIA}</p>
            </div>
          )}

          {/* Suggested reply */}
          {email.respuestaSugerida && (
            <div className={styles.sugeridaCard}>
              <div className={styles.sugeridaHeader}>
                <span className={styles.aiCardTitle}>💡 {t('inbox.respuestaSugerida')}</span>
                <button className="btn-ghost btn-sm" onClick={handleCopy}>
                  {copied ? '✅ Copiado' : '📋 Copiar'}
                </button>
              </div>
              <p className={styles.aiCardText}>{email.respuestaSugerida}</p>
            </div>
          )}

          {/* Response area */}
          <div className={styles.responseSection}>
            <label className={styles.responseLabel}>{t('inbox.respuestaFinal')}</label>
            <textarea
              className={styles.responseTextarea}
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              placeholder={t('inbox.respuestaFinal')}
              rows={4}
            />
            <div className={styles.responseActions}>
              <button
                className="btn-primary btn-sm"
                onClick={() => onUpdate(email.id, { respuestaFinal: respuesta })}
                disabled={isPending}
              >
                {isPending ? t('common.saving') : t('inbox.guardarRespuesta')}
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className={styles.quickActions}>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onUpdate(email.id, { estado: 'Leido' })}
              disabled={isPending || email.estado === 'Leido'}
            >
              👁 {t('inbox.marcarLeido')}
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onUpdate(email.id, { estado: 'Respondido' })}
              disabled={isPending || email.estado === 'Respondido'}
            >
              ✅ {t('inbox.marcarRespondido')}
            </button>
            <button
              className="btn-ghost btn-sm"
              onClick={() => onUpdate(email.id, { estado: 'Archivado' })}
              disabled={isPending || email.estado === 'Archivado'}
            >
              📁 Archivar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InboxPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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

  const sorted = useMemo(() => {
    let list = filter === 'sinResponder'
      ? emails.filter(e => e.estado !== 'Respondido' && e.estado !== 'Archivado')
      : emails;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.asunto?.toLowerCase().includes(q) ||
        e.de?.toLowerCase().includes(q) ||
        e.para?.toLowerCase().includes(q)
      );
    }

    return sortEmails(list);
  }, [emails, filter, search]);

  const filters: { key: FilterType; label: string; icon: string }[] = [
    { key: 'all', label: t('inbox.todos'), icon: '📬' },
    { key: 'atencion', label: t('inbox.requiereAtencion'), icon: '⚠️' },
    { key: 'sinResponder', label: 'Sin responder', icon: '💬' },
    { key: 'Recibido', label: t('inbox.recibidos'), icon: '📥' },
    { key: 'Enviado', label: t('inbox.enviados'), icon: '📤' },
  ];

  return (
    <div className={`animate-fadeIn ${styles.page}`}>
      {/* Filter bar + search */}
      <div className={styles.toolbar}>
        <div className={styles.filterRow}>
          {filters.map(f => (
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
      </div>

      {/* Count */}
      {!isLoading && (
        <div className={styles.resultCount}>
          {sorted.length} {sorted.length === 1 ? 'mensaje' : 'mensajes'}
        </div>
      )}

      {/* Card list */}
      <div className={styles.cardList}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.emailCard}>
              <div className={styles.emailCardHeader} style={{ pointerEvents: 'none' }}>
                <div className={styles.cardLeft}>
                  <SkeletonBlock width="20px" height="20px" borderRadius="4px" />
                </div>
                <div className={styles.cardBody} style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                  <SkeletonBlock width={`${55 + (i % 3) * 15}%`} height="14px" />
                  <SkeletonBlock width="40%" height="12px" />
                </div>
              </div>
            </div>
          ))
        ) : sorted.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📭</span>
            <p>{t('inbox.sinEmails')}</p>
          </div>
        ) : (
          sorted.map(email => (
            <EmailCard
              key={email.id}
              email={email}
              isExpanded={expandedId === email.id}
              onToggle={() => setExpandedId(expandedId === email.id ? null : email.id)}
              onUpdate={(id, updates) => updateMutation.mutate({ id, updates })}
              isPending={updateMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
