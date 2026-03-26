/**
 * Emails — Gmail-like split-panel inbox + Cola de emails.
 *
 * Bandeja: master-detail layout (email list left, detail right)
 * Cola: DataTable with approval flow (unchanged)
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge, SkeletonBlock, DataTable, Column, ConfirmDialog } from '@/components/shared';
import { fetchInbox, updateInboxEmail } from '@/data/adapters';
import { fetchColaEmails, aprobarEmail } from '@/data/adapters';
import { InboxEmail, ColaEmail, EstadoEmail } from '@/types';
import { timeAgo } from '@/utils/formatters';
import { useTranslation } from '@/i18n';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { ESTADO_EMAIL } from '@/utils/constants';
import styles from './Inbox.module.css';

type SectionType = 'bandeja' | 'cola';
type DirectionTab = 'Recibido' | 'Enviado';
type EstadoFilter = '' | 'Nuevo' | 'Leido' | 'Respondido' | 'Archivado';

function buildQueryFilters(tab: DirectionTab, atencionOnly: boolean) {
  const filters: Record<string, unknown> = {};
  if (tab === 'Recibido') filters.direccion = 'Recibido';
  if (tab === 'Enviado') filters.direccion = 'Enviado';
  if (atencionOnly) filters.requiereAtencion = true;
  return filters;
}

function sortEmails(emails: InboxEmail[]): InboxEmail[] {
  return [...emails].sort((a, b) => {
    if (a.requiereAtencion && !b.requiereAtencion) return -1;
    if (!a.requiereAtencion && b.requiereAtencion) return 1;
    const aNew = a.estado === 'Nuevo';
    const bNew = b.estado === 'Nuevo';
    if (aNew && !bNew) return -1;
    if (!aNew && bNew) return 1;
    const aDate = a.fecha || a.createdTime;
    const bDate = b.fecha || b.createdTime;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

// ── Email Detail Panel ───────────────────────────────────────────────────────

interface DetailPanelProps {
  email: InboxEmail | null;
  onUpdate: (id: string, updates: { estado?: string; respuestaFinal?: string }) => void;
  isPending: boolean;
  onBack?: () => void;
}

function DetailPanel({ email, onUpdate, isPending, onBack }: DetailPanelProps) {
  const { t } = useTranslation();
  const [respuesta, setRespuesta] = useState('');
  const [copied, setCopied] = useState(false);

  // Sync respuesta when email changes
  const emailId = email?.id;
  useState(() => { setRespuesta(email?.respuestaFinal || ''); });
  // Reset on email change
  if (email && respuesta === '' && email.respuestaFinal) {
    // handled by memo below
  }

  useMemo(() => {
    setRespuesta(email?.respuestaFinal || '');
  }, [emailId]);

  async function handleCopy() {
    if (!email?.respuestaSugerida) return;
    await navigator.clipboard.writeText(email.respuestaSugerida);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleUseSuggestion() {
    if (!email?.respuestaSugerida) return;
    setRespuesta(email.respuestaSugerida);
  }

  if (!email) {
    return (
      <div className={styles.detailEmpty}>
        <span>📧</span>
        <p>{t('inbox.seleccionaEmail') || 'Selecciona un email para ver su contenido'}</p>
      </div>
    );
  }

  return (
    <div className={styles.detail}>
      {/* Mobile back button */}
      {onBack && (
        <button className={styles.backBtn} onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('inbox.todos')}
        </button>
      )}

      {/* Email header */}
      <div className={styles.detailHeader}>
        <div className={styles.detailHeaderTop}>
          <h2 className={styles.detailSubject}>{email.asunto || '(sin asunto)'}</h2>
          <StatusBadge status={email.estado} />
        </div>
        <div className={styles.detailMeta}>
          <span><strong>De:</strong> {email.de}</span>
          <span><strong>Para:</strong> {email.para}</span>
          <span className={styles.detailDate}>{timeAgo(email.fecha || email.createdTime)}</span>
        </div>
      </div>

      {/* Attention banner */}
      {email.requiereAtencion && (
        <div className={styles.alertBanner}>
          <span>⚠️</span> {t('inbox.requiereAtencion')}
        </div>
      )}

      {/* Email body */}
      <div className={styles.detailBody}>
        {email.contenidoHtml ? (
          <div
            className={styles.emailBodyText}
            dangerouslySetInnerHTML={{ __html: email.contenidoHtml }}
          />
        ) : (
          <pre className={styles.emailBodyText}>{email.contenido || '(sin contenido)'}</pre>
        )}
      </div>

      {/* AI Summary */}
      {email.resumenIA && (
        <div className={styles.aiCard}>
          <div className={styles.aiCardTitle}>🤖 {t('inbox.resumenIA')}</div>
          <p className={styles.aiCardText}>{email.resumenIA}</p>
        </div>
      )}

      {/* AI Suggested Reply */}
      {email.respuestaSugerida && (
        <div className={styles.sugeridaCard}>
          <div className={styles.sugeridaHeader}>
            <span className={styles.aiCardTitle}>💡 {t('inbox.respuestaSugerida')}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn-ghost btn-sm" onClick={handleCopy}>
                {copied ? '✅ Copiado' : '📋 Copiar'}
              </button>
              <button className="btn-ghost btn-sm" onClick={handleUseSuggestion}>
                ✏️ Usar
              </button>
            </div>
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
      </div>

      {/* Actions */}
      <div className={styles.detailActions}>
        <button
          className="btn-primary btn-sm"
          onClick={() => onUpdate(email.id, { respuestaFinal: respuesta })}
          disabled={isPending}
        >
          {isPending ? t('common.saving') : t('inbox.guardarRespuesta')}
        </button>
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
    </div>
  );
}

// ── Cola de Emails section (unchanged) ───────────────────────────────────────

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
  const isMobile = useIsMobile();

  const [section, setSection] = useState<SectionType>('bandeja');
  const [dirTab, setDirTab] = useState<DirectionTab>('Recibido');
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('');
  const [atencionOnly, setAtencionOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [search, setSearch] = useState('');
  const [estadoDropdownOpen, setEstadoDropdownOpen] = useState(false);
  const estadoRef = useRef<HTMLDivElement>(null);

  // Close estado dropdown on outside click
  useEffect(() => {
    if (!estadoDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (estadoRef.current && !estadoRef.current.contains(e.target as Node)) setEstadoDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [estadoDropdownOpen]);

  const queryFilters = buildQueryFilters(dirTab, atencionOnly);

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
    let list = emails;
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
  }, [emails, dirTab, estadoFilter, search]);

  const atencionCount = useMemo(() => emails.filter(e => e.requiereAtencion).length, [emails]);

  const selectedEmail = sorted.find(e => e.id === selectedId) || null;

  function selectEmail(email: InboxEmail) {
    setSelectedId(email.id);
    if (isMobile) setShowDetail(true);
  }

  const directionTabs: { key: DirectionTab; label: string }[] = [
    { key: 'Recibido', label: t('inbox.recibidos') },
    { key: 'Enviado', label: t('inbox.enviados') },
  ];

  const estadoOptions: { key: EstadoFilter; label: string }[] = [
    { key: '', label: 'Todos' },
    { key: 'Nuevo', label: 'Nuevo' },
    { key: 'Leido', label: 'Leído' },
    { key: 'Respondido', label: 'Respondido' },
    { key: 'Archivado', label: 'Archivado' },
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

      {/* Bandeja section — split panel */}
      {section === 'bandeja' && (
        <div className={styles.splitView}>
          {/* Left: email list */}
          <div className={`${styles.listPanel} ${isMobile && showDetail ? styles.mobileHidden : ''}`}>
            {/* Filters */}
            <div className={styles.listFilters}>
              {/* Segmented tabs: Recibidos | Enviados | Sin responder */}
              <div className={styles.segmentedTabs}>
                {directionTabs.map(tab => (
                  <button
                    key={tab.key}
                    className={`${styles.segmentedTab} ${dirTab === tab.key ? styles.segmentedTabActive : ''}`}
                    onClick={() => setDirTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Estado dropdown + search row */}
              <div className={styles.filterControls}>
                <div ref={estadoRef} className={styles.estadoDropdown}>
                  <button
                    className={`${styles.estadoBtn} ${estadoFilter ? styles.estadoBtnActive : ''}`}
                    onClick={() => setEstadoDropdownOpen(o => !o)}
                  >
                    {estadoFilter || 'Estado'}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {estadoDropdownOpen && (
                    <div className={styles.estadoMenu}>
                      {estadoOptions.map(opt => (
                        <button
                          key={opt.key}
                          className={`${styles.estadoMenuItem} ${estadoFilter === opt.key ? styles.estadoMenuItemActive : ''}`}
                          onClick={() => { setEstadoFilter(opt.key); setEstadoDropdownOpen(false); }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
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

              {/* Attention toggle + count */}
              <div className={styles.filterMeta}>
                {atencionCount > 0 && (
                  <button
                    className={`${styles.atencionToggle} ${atencionOnly ? styles.atencionToggleActive : ''}`}
                    onClick={() => setAtencionOnly(o => !o)}
                  >
                    ⚠️ {atencionCount} {t('inbox.requiereAtencion')}
                  </button>
                )}
                {!isLoading && (
                  <span className={styles.resultCount}>
                    {sorted.length} {sorted.length === 1 ? 'mensaje' : 'mensajes'}
                  </span>
                )}
              </div>
            </div>

            {/* Email list */}
            <div className={styles.listItems}>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className={styles.listItem} style={{ pointerEvents: 'none' }}>
                    <SkeletonBlock width={`${55 + (i % 3) * 15}%`} height="14px" />
                    <SkeletonBlock width="70%" height="12px" />
                    <SkeletonBlock width="40%" height="11px" />
                  </div>
                ))
              ) : sorted.length === 0 ? (
                <div className={styles.emptyState}>
                  <span className={styles.emptyIcon}>📭</span>
                  <p>{t('inbox.sinEmails')}</p>
                </div>
              ) : (
                sorted.map((email, idx) => {
                  const isUnread = email.estado === 'Nuevo';
                  const isSelected = selectedId === email.id;
                  return (
                    <button
                      key={email.id}
                      className={`${styles.listItem} ${isSelected ? styles.listItemActive : ''} ${isUnread ? styles.listItemUnread : ''} ${email.requiereAtencion ? styles.listItemAlert : ''}`}
                      style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
                      onClick={() => selectEmail(email)}
                    >
                      <div className={styles.listItemTop}>
                        <span className={`${styles.listItemSubject} ${isUnread ? styles.listItemSubjectUnread : ''}`}>
                          {email.asunto || '(sin asunto)'}
                        </span>
                        <span className={styles.listItemTime}>{timeAgo(email.fecha || email.createdTime)}</span>
                      </div>
                      <div className={styles.listItemBottom}>
                        <span className={styles.listItemContact}>
                          {email.direccion === 'Recibido' ? email.de : email.para}
                        </span>
                        <StatusBadge status={email.estado} />
                      </div>
                      {email.resumenIA && (
                        <div className={styles.listItemSnippet}>{email.resumenIA}</div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          <div className={`${styles.detailPanel} ${isMobile && !showDetail ? styles.mobileHidden : ''}`}>
            <DetailPanel
              email={selectedEmail}
              onUpdate={(id, updates) => updateMutation.mutate({ id, updates })}
              isPending={updateMutation.isPending}
              onBack={isMobile ? () => setShowDetail(false) : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
