import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { getSession } from '@/auth/AuthService';
import { fetchAlumnos } from '@/data/adapters';
import { useTranslation } from '@/i18n';
import { EMAIL_TEMPLATES, UI_TEMPLATE_OPTIONS, type TemplateKey } from '@/lib/emailTemplates';
import styles from './EmailComposeModal.module.css';

type ModalState = 'idle' | 'sending' | 'success' | 'error';

interface EmailComposeModalProps {
  open: boolean;
  alumnoRecordId?: string;
  alumnoNombre?: string;
  onClose: () => void;
  initialTemplateKey?: TemplateKey;
  onAfterSend?: () => void;
  skipAction?: { label: string; onSkip: () => void };
}

export function EmailComposeModal({
  open,
  alumnoRecordId = '',
  alumnoNombre = '',
  onClose,
  initialTemplateKey,
  onAfterSend,
  skipAction,
}: EmailComposeModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerPortalStyle, setPickerPortalStyle] = useState<React.CSSProperties>({});

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const [composeMode, setComposeMode] = useState<'template' | 'quick'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [modalState, setModalState] = useState<ModalState>('idle');

  const [composeAlumnoId, setComposeAlumnoId] = useState('');
  const [composeAlumnoNombre, setComposeAlumnoNombre] = useState('');
  const isPickerMode = !alumnoRecordId;
  const effectiveAlumnoId = alumnoRecordId || composeAlumnoId;
  const effectiveAlumnoNombre = alumnoNombre || composeAlumnoNombre;

  const { data: alumnosForPicker = [] } = useQuery({
    queryKey: ['alumnos-picker'],
    queryFn: () => fetchAlumnos(),
    enabled: open && isPickerMode,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setComposeMode('template');
      setComposeAlumnoId('');
      setComposeAlumnoNombre('');
      setPickerOpen(false);
      setPickerSearch('');
      const key = initialTemplateKey ?? '';
      setSelectedTemplate(key);
      if (key && EMAIL_TEMPLATES[key]) {
        setSubject(EMAIL_TEMPLATES[key].subject);
        setBody(EMAIL_TEMPLATES[key].body.replace('{nombre}', effectiveAlumnoNombre));
      } else {
        setSubject('');
        setBody('');
      }
      setModalState('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplateKey, alumnoNombre]);

  // Re-interpolate {nombre} when picker selection changes
  useEffect(() => {
    if (selectedTemplate && EMAIL_TEMPLATES[selectedTemplate as TemplateKey]) {
      setBody(EMAIL_TEMPLATES[selectedTemplate as TemplateKey].body.replace('{nombre}', effectiveAlumnoNombre));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeAlumnoNombre]);

  // Focus trap + Escape key
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel) {
      const firstInput = panel.querySelector<HTMLElement>('select, input, textarea, button');
      firstInput?.focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalState !== 'sending') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && panel) {
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, modalState, onClose]);


  // Close picker dropdown on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        pickerBtnRef.current && pickerBtnRef.current.contains(target)
      ) return;
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [pickerOpen]);

  function handleTemplateChange(key: TemplateKey | '') {
    setSelectedTemplate(key);
    if (key && EMAIL_TEMPLATES[key]) {
      setSubject(EMAIL_TEMPLATES[key].subject);
      setBody(EMAIL_TEMPLATES[key].body.replace('{nombre}', effectiveAlumnoNombre));
    } else {
      setSubject('');
      setBody('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!effectiveAlumnoId) return;
    if (composeMode === 'template' && !selectedTemplate) return;
    setModalState('sending');
    try {
      const sessionEmail = getSession()?.email ?? '';
      const origen = composeMode === 'quick' ? 'manual_quick' : 'manual_template';
      const response = await fetch('/api/emails/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ProEv-Session': sessionEmail,
        },
        body: JSON.stringify({
          alumnoRecordId: effectiveAlumnoId,
          ...(subject ? { asunto: subject } : {}),
          mensaje: body,
          ...(composeMode === 'template' ? { templateKey: selectedTemplate } : {}),
          origen,
        }),
      });
      if (response.ok) {
        setModalState('success');
        onAfterSend?.();
      } else {
        setModalState('error');
      }
    } catch {
      setModalState('error');
    }
  }

  const filteredPickerOptions = alumnosForPicker
    .filter((a) => {
      if (!pickerSearch) return true;
      const q = pickerSearch.toLowerCase();
      return (
        String(a.nombre || '').toLowerCase().includes(q) ||
        String(a.email || '').toLowerCase().includes(q)
      );
    })
    .slice(0, 50);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={modalState !== 'sending' ? onClose : undefined}>
      <div
        ref={panelRef}
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
      >
        {modalState === 'success' ? (
          <div className={styles.successState}>
            <div className={styles.successIcon} aria-hidden="true">✓</div>
            <h2 id="compose-title" className={styles.successTitle}>{t('emailCompose.successTitle')}</h2>
            <p className={styles.successDescription}>{t('emailCompose.successDescription')}</p>
            <button className={styles.closeButton} onClick={onClose}>{t('emailCompose.closeButton')}</button>
          </div>
        ) : (
          <>
            <h2 id="compose-title" className={styles.title}>{t('emailCompose.title')}</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              {/* Mode toggle */}
              <div className={styles.modeToggle} role="group" aria-label={t('emailCompose.modeToggleLabel')}>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${composeMode === 'template' ? styles.modeBtnActive : ''}`}
                  onClick={() => setComposeMode('template')}
                  disabled={modalState === 'sending'}
                  aria-pressed={composeMode === 'template'}
                >
                  {t('emailCompose.modeTemplate')}
                </button>
                <button
                  type="button"
                  className={`${styles.modeBtn} ${composeMode === 'quick' ? styles.modeBtnActive : ''}`}
                  onClick={() => setComposeMode('quick')}
                  disabled={modalState === 'sending'}
                  aria-pressed={composeMode === 'quick'}
                >
                  {t('emailCompose.modeQuick')}
                </button>
              </div>
              {isPickerMode ? (
                <div className={styles.pickerField}>
                  <label htmlFor="compose-alumno-trigger" className={styles.label}>
                    {t('emailCompose.alumnoLabel')}
                  </label>
                  <div ref={pickerRef} style={{ position: 'relative' }}>
                    <button
                      ref={pickerBtnRef}
                      id="compose-alumno-trigger"
                      type="button"
                      className={styles.input}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: composeAlumnoNombre ? 'var(--color-text-primary)' : 'var(--color-text-muted, var(--color-text-secondary))',
                      }}
                      onClick={() => {
                        const willOpen = !pickerOpen;
                        if (willOpen && pickerBtnRef.current) {
                          const rect = pickerBtnRef.current.getBoundingClientRect();
                          setPickerPortalStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 1100 });
                          setPickerSearch('');
                        }
                        setPickerOpen(willOpen);
                      }}
                      disabled={modalState === 'sending'}
                      aria-haspopup="listbox"
                      aria-expanded={pickerOpen}
                    >
                      {composeAlumnoNombre || t('emailCompose.searchAlumno')}
                    </button>
                    {pickerOpen && createPortal(
                      <div ref={pickerRef} className={styles.pickerDropdown} style={pickerPortalStyle} onClick={e => e.stopPropagation()}>
                        <div className={styles.pickerSearchWrapper}>
                          <input
                            autoFocus
                            type="text"
                            className={styles.pickerSearch}
                            value={pickerSearch}
                            onChange={(e) => setPickerSearch(e.target.value)}
                            placeholder={t('emailCompose.searchAlumno')}
                          />
                        </div>
                        <div className={styles.pickerList}>
                          {filteredPickerOptions.length === 0 ? (
                            <div className={styles.pickerEmpty}>Sin resultados</div>
                          ) : filteredPickerOptions.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className={styles.pickerOption}
                              onClick={() => {
                                setComposeAlumnoId(a.id ?? '');
                                setComposeAlumnoNombre(a.nombre ?? a.email ?? '');
                                setPickerOpen(false);
                                setPickerSearch('');
                              }}
                            >
                              <span className={styles.pickerOptionName}>{a.nombre}</span>
                              <span className={styles.pickerOptionEmail}>{a.email}</span>
                            </button>
                          ))}
                        </div>
                      </div>,
                      document.body
                    )}
                  </div>
                  {!composeAlumnoId && (
                    <span id="compose-alumno-hint" className={styles.fieldHint}>
                      {t('emailCompose.selectAlumnoFirst')}
                    </span>
                  )}
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>{t('emailCompose.recipient')}</label>
                  <span className={styles.recipientName}>{alumnoNombre}</span>
                </div>
              )}
              {composeMode === 'template' && (
                <div className={styles.fieldGroup}>
                  <label htmlFor="compose-template" className={styles.label}>{t('emailCompose.templateLabel')}</label>
                  <select
                    id="compose-template"
                    className={`${styles.select} ${isPickerMode && !composeAlumnoId ? styles.selectDisabled : ''}`}
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value as TemplateKey | '')}
                    disabled={modalState === 'sending' || (isPickerMode && !composeAlumnoId)}
                    aria-disabled={isPickerMode && !composeAlumnoId ? 'true' : undefined}
                    required
                  >
                    <option value="">{t('emailCompose.templatePlaceholder')}</option>
                    {UI_TEMPLATE_OPTIONS.map(({ key, labelKey }) => (
                      <option key={key} value={key}>{t(labelKey)}</option>
                    ))}
                  </select>
                </div>
              )}
              {composeMode === 'template' && (
                <div className={styles.fieldGroup}>
                  <label htmlFor="compose-subject" className={styles.label}>{t('emailCompose.subjectLabel')}</label>
                  <input
                    id="compose-subject"
                    type="text"
                    className={styles.input}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('emailCompose.subjectPlaceholder')}
                    disabled={modalState === 'sending'}
                    required
                  />
                </div>
              )}
              <div className={styles.fieldGroup}>
                <label htmlFor="compose-body" className={styles.label}>{t('emailCompose.bodyLabel')}</label>
                <textarea
                  id="compose-body"
                  className={styles.textarea}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={composeMode === 'quick' ? t('emailCompose.quickBodyPlaceholder') : t('emailCompose.bodyPlaceholder')}
                  disabled={modalState === 'sending'}
                  rows={8}
                  required
                />
              </div>
              {modalState === 'error' && (
                <p className={styles.errorMessage} role="alert">{t('emailCompose.errorMessage')}</p>
              )}
              {skipAction && (
                <p className={styles.skipHint}>
                  <button
                    type="button"
                    className={styles.skipLink}
                    onClick={skipAction.onSkip}
                    disabled={modalState === 'sending'}
                  >
                    {skipAction.label}
                  </button>
                </p>
              )}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={onClose}
                  disabled={modalState === 'sending'}
                >
                  {t('emailCompose.cancelButton')}
                </button>
                <button
                  type="submit"
                  className={styles.sendButton}
                  disabled={modalState === 'sending' || !effectiveAlumnoId || (composeMode === 'template' && !selectedTemplate)}
                >
                  {modalState === 'sending' ? t('emailCompose.sendingButton') : t('emailCompose.sendButton')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
