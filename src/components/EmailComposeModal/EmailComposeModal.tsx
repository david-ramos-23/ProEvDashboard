import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getSession } from '@/auth/AuthService';
import { useTranslation } from '@/i18n';
import { EMAIL_TEMPLATES, UI_TEMPLATE_OPTIONS, type TemplateKey } from '@/lib/emailTemplates';
import styles from './EmailComposeModal.module.css';

type ModalState = 'idle' | 'sending' | 'success' | 'error';

interface EmailComposeModalProps {
  open: boolean;
  alumnoRecordId: string;
  alumnoNombre: string;
  onClose: () => void;
  initialTemplateKey?: TemplateKey;
}

export function EmailComposeModal({
  open,
  alumnoRecordId,
  alumnoNombre,
  onClose,
  initialTemplateKey,
}: EmailComposeModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);

  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey | ''>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [modalState, setModalState] = useState<ModalState>('idle');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      const key = initialTemplateKey ?? '';
      setSelectedTemplate(key);
      if (key && EMAIL_TEMPLATES[key]) {
        setSubject(EMAIL_TEMPLATES[key].subject);
        setBody(EMAIL_TEMPLATES[key].body.replace('{nombre}', alumnoNombre));
      } else {
        setSubject('');
        setBody('');
      }
      setModalState('idle');
    }
  }, [open, initialTemplateKey, alumnoNombre]);

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
      setBody(EMAIL_TEMPLATES[key].body.replace('{nombre}', alumnoNombre));
    } else {
      setSubject('');
      setBody('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
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
          alumnoRecordId,
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
              <div className={styles.fieldGroup}>
                <label className={styles.label}>{t('emailCompose.recipient')}</label>
                <span className={styles.recipientName}>{alumnoNombre}</span>
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="compose-template" className={styles.label}>{t('emailCompose.templateLabel')}</label>
                <select
                  id="compose-template"
                  className={styles.select}
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value as TemplateKey | '')}
                  disabled={modalState === 'sending'}
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
                  disabled={modalState === 'sending' || !selectedTemplate}
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
