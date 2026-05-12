import { useEffect, useRef, useState, type FormEvent } from 'react';
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
}

export function EmailComposeModal({
  open,
  alumnoRecordId = '',
  alumnoNombre = '',
  onClose,
  initialTemplateKey,
}: EmailComposeModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

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
      setComposeAlumnoId('');
      setComposeAlumnoNombre('');
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
    if (!selectedTemplate || !effectiveAlumnoId) return;
    setModalState('sending');
    try {
      const sessionEmail = getSession()?.email ?? '';
      const response = await fetch('/api/emails/compose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ProEv-Session': sessionEmail,
        },
        body: JSON.stringify({
          alumnoRecordId: effectiveAlumnoId,
          asunto: subject,
          mensaje: body,
          templateKey: selectedTemplate,
        }),
      });
      if (response.ok) {
        setModalState('success');
      } else {
        setModalState('error');
      }
    } catch {
      setModalState('error');
    }
  }

  if (!open) return null;

  return (
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
              {isPickerMode ? (
                <div className={styles.pickerField}>
                  <label htmlFor="compose-alumno-picker" className={styles.label}>
                    {t('emailCompose.alumnoLabel')}
                  </label>
                  <input
                    id="compose-alumno-picker"
                    type="text"
                    list="compose-alumno-list"
                    className={styles.pickerInput}
                    placeholder={t('emailCompose.searchAlumno')}
                    value={composeAlumnoNombre}
                    onChange={(e) => {
                      const name = e.target.value;
                      setComposeAlumnoNombre(name);
                      const match = alumnosForPicker.find((a) => a.nombre === name);
                      setComposeAlumnoId(match?.id ?? '');
                    }}
                    disabled={modalState === 'sending'}
                    aria-required="true"
                    aria-describedby="compose-alumno-hint"
                    required
                  />
                  <datalist id="compose-alumno-list">
                    {alumnosForPicker.map((a) => (
                      <option key={a.id} value={a.nombre ?? ''} />
                    ))}
                  </datalist>
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
              <div className={styles.fieldGroup}>
                <label htmlFor="compose-body" className={styles.label}>{t('emailCompose.bodyLabel')}</label>
                <textarea
                  id="compose-body"
                  className={styles.textarea}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('emailCompose.bodyPlaceholder')}
                  disabled={modalState === 'sending'}
                  rows={8}
                  required
                />
              </div>
              {modalState === 'error' && (
                <p className={styles.errorMessage} role="alert">{t('emailCompose.errorMessage')}</p>
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
                  disabled={modalState === 'sending' || !selectedTemplate || !effectiveAlumnoId}
                >
                  {modalState === 'sending' ? t('emailCompose.sendingButton') : t('emailCompose.sendButton')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
