/**
 * Emails — Bandeja de entrada + Cola de emails del sistema ProEv.
 *
 * Two sections:
 *  - Bandeja: Gmail inbox (task-queue card list with inline expansion)
 *  - Cola:    Automated email queue (approve / track status)
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge, SkeletonBlock, DataTable, Column, ConfirmDialog } from '@/components/shared';
import { fetchInbox, updateInboxEmail } from '@/data/adapters/airtable/InboxAdapter';
import { fetchColaEmails, aprobarEmail } from '@/data/adapters/airtable/ColaEmailsAdapter';
import { InboxEmail, ColaEmail, EstadoEmail } from '@/types';
import { timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import { ESTADO_EMAIL } from '@/utils/constants';
import styles from './Inbox.module.css';

type SectionType = 'bandeja' | 'cola';

type FilterType = 'all' | 'atencion' | 'sinResponder' | 'Recibido' | 'Enviado';
type EstadoFilter = '' | 'Nuevo' | 'Leido' | 'Respondido' | 'Archivado';

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
            {email.contenidoHtml ? (
              <div
                className={styles.emailBodyText}
                dangerouslySetInnerHTML={{ __html: email.contenidoHtml }}
              />
            ) : (
              <pre className={styles.emailBodyText}>{email.contenido || '(sin contenido)'}</pre>
            )}
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

// ── Cola de Emails section ─────────────────────────────────────────────────

type ColaTab = 'pendientes' | 'cola' | 'enviados' | 'errores';
const COLA_TABS: { key: ColaTab; label: string; icon: string; estado: EstadoEmail }[] = [
  { key: 'pendientes', label: 'Por aprobar', icon: '⏳', estado: ESTADO_EMAIL.PENDIENTE_APROBACION },
  { key: 'cola',       label: 'En cola',     icon: '📤', estado: 'Pendiente' },
  { key: 'enviados',   label: 'Enviados',    icon: '✅', estado: 'Enviado' },
  { key: 'errores',    label: 'Errores',     icon: '❌', estado: 'Error' },
];
const TIPOS_EMAIL = ['informacion', 'recordatorio', 'seguimiento', 'bienvenida', 'alerta'];

function ColaSection() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [colaTab, setColaTab] = useState<ColaTab>('pendientes');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [approving, setApproving] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const activeEstado = COLA_TABS.find(t => t.key === colaTab)!.estado;

  const { data: colaEmails = [], isLoading } = useQuery({
    queryKey: ['cola-emails', { estado: activeEstado, tipo: filtroTipo || undefined }],
    queryFn: () => fetchColaEmails({ estado: activeEstado, tipo: filtroTipo || undefined }),
  });

  async function handleAprobar(id: string) {
    setApproving(id);
    try {
      await aprobarEmail(id);
      await queryClient.invalidateQueries({ queryKey: ['cola-emails'] });
    } finally {
      setApproving(null);
    }
  }

  const columns = useMemo<Column<ColaEmail>[]>(() => {
    const cols: Column<ColaEmail>[] = [
      {
        key: 'alumnoNombre', header: 'Alumno', width: '160px', sortable: true, minWidth: 110,
        render: (e) => <span style={{ fontWeight: 500 }}>{e.alumnoNombre || '—'}</span>,
      },
      {
        key: 'tipo', header: 'Tipo', width: '120px', sortable: true, minWidth: 80,
        render: (e) => <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--color-accent-info)' }}>{e.tipo}</span>,
      },
      {
        key: 'asunto', header: 'Asunto / Mensaje',
        render: (e) => <span style={{ fontSize: '0.8125rem' }}>{e.asunto || e.descripcion || e.mensaje?.slice(0, 80) || '—'}</span>,
      },
      {
        key: 'estado', header: 'Estado', width: '140px', sortable: true, minWidth: 100,
        render: (e) => <StatusBadge status={e.estado} type="email" />,
      },
      {
        key: 'createdTime', header: 'Hace', width: '90px', sortable: true, minWidth: 60,
        render: (e) => <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{timeAgo(e.createdTime)}</span>,
      },
    ];
    if (colaTab === 'pendientes') {
      cols.push({
        key: 'actions', header: '', width: '100px', hideable: false,
        render: (e) => (
          <button
            className="btn-success btn-sm"
            onClick={(ev) => { ev.stopPropagation(); setConfirmId(e.id); }}
            disabled={approving === e.id}
          >
            {approving === e.id ? '...' : t('common.approve')}
          </button>
        ),
      });
    }
    return cols;
  }, [colaTab, approving]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-xs)' }}>
        {COLA_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setColaTab(tab.key)}
            className={styles.filterBtn}
            style={{
              background: colaTab === tab.key ? 'var(--color-accent-primary-glow)' : 'transparent',
              borderColor: colaTab === tab.key ? 'rgba(12, 90, 69, 0.3)' : 'transparent',
              color: colaTab === tab.key ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
              borderRadius: '8px 8px 0 0',
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Tipo filter */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
        <button className={`btn-sm ${!filtroTipo ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltroTipo('')}>Todos</button>
        {TIPOS_EMAIL.map(tipo => (
          <button key={tipo} className={`btn-sm ${filtroTipo === tipo ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setFiltroTipo(filtroTipo === tipo ? '' : tipo)}
            style={{ textTransform: 'capitalize' }}>
            {tipo}
          </button>
        ))}
      </div>

      <DataTable
        tableId="inbox-cola"
        columns={columns}
        data={colaEmails}
        isLoading={isLoading}
        emptyMessage={`No hay emails en "${COLA_TABS.find(t => t.key === colaTab)!.label}"`}
        emptyIcon="📧"
      />

      <ConfirmDialog
        open={!!confirmId}
        title={t('common.approve')}
        message={colaEmails.find(e => e.id === confirmId)?.alumnoNombre || ''}
        icon="📧"
        confirmLabel={t('common.approve')}
        variant="success"
        onConfirm={() => {
          if (confirmId) handleAprobar(confirmId);
          setConfirmId(null);
        }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function InboxPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const [section, setSection] = useState<SectionType>('bandeja');
  const [filter, setFilter] = useState<FilterType>('all');
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const queryFilters = buildQueryFilters(filter);

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ['inbox', queryFilters],
    queryFn: () => fetchInbox(queryFilters),
    enabled: section === 'bandeja',
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
    if (estadoFilter) list = list.filter(e => e.estado === estadoFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.asunto?.toLowerCase().includes(q) ||
        e.de?.toLowerCase().includes(q) ||
        e.para?.toLowerCase().includes(q)
      );
    }
    return sortEmails(list);
  }, [emails, filter, estadoFilter, search]);

  const filters: { key: FilterType; label: string; icon: string }[] = [
    { key: 'all', label: t('inbox.todos'), icon: '📬' },
    { key: 'atencion', label: t('inbox.requiereAtencion'), icon: '⚠️' },
    { key: 'sinResponder', label: 'Sin responder', icon: '💬' },
    { key: 'Recibido', label: t('inbox.recibidos'), icon: '📥' },
    { key: 'Enviado', label: t('inbox.enviados'), icon: '📤' },
  ];

  return (
    <div className={`animate-fadeIn ${styles.page}`}>
      {/* Section switcher */}
      <div className={styles.sectionSwitcher}>
        <button
          className={`${styles.sectionBtn} ${section === 'bandeja' ? styles.sectionBtnActive : ''}`}
          onClick={() => setSection('bandeja')}
        >
          <span>📬</span> Bandeja de entrada
        </button>
        <button
          className={`${styles.sectionBtn} ${section === 'cola' ? styles.sectionBtnActive : ''}`}
          onClick={() => setSection('cola')}
        >
          <span>📧</span> Cola de emails
        </button>
      </div>

      {/* Cola section */}
      {section === 'cola' && <ColaSection />}

      {/* Bandeja section */}
      {section === 'bandeja' && (
        <>
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

          {/* Estado filter chips */}
          <div className={styles.filterRow}>
            {([
              { key: '' as EstadoFilter, label: 'Todos los estados' },
              { key: 'Nuevo' as EstadoFilter, label: '🔵 Nuevo' },
              { key: 'Leido' as EstadoFilter, label: '👁 Leído' },
              { key: 'Respondido' as EstadoFilter, label: '✅ Respondido' },
              { key: 'Archivado' as EstadoFilter, label: '📁 Archivado' },
            ]).map(opt => (
              <button
                key={opt.key}
                className={`${styles.filterBtn} ${estadoFilter === opt.key ? styles.filterBtnActive : ''}`}
                onClick={() => setEstadoFilter(opt.key)}
              >
                {opt.label}
              </button>
            ))}
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
              sorted.map((email, idx) => (
                <div key={email.id} className={styles.cardEnter} style={{ animationDelay: `${Math.min(idx * 40, 400)}ms` }}>
                <EmailCard
                  email={email}
                  isExpanded={expandedId === email.id}
                  onToggle={() => setExpandedId(expandedId === email.id ? null : email.id)}
                  onUpdate={(id, updates) => updateMutation.mutate({ id, updates })}
                  isPending={updateMutation.isPending}
                  />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
