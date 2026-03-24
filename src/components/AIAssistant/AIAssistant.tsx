/**
 * AI Assistant — Floating chat panel backed by /api/ai-chat.
 *
 * Provides a conversational interface to query ProEv dashboard data
 * (alumnos, inbox, revisiones, pagos, cola emails) and take actions.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './AIAssistant.module.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  '¿Cuántos alumnos están en revisión de vídeo?',
  '¿Hay emails pendientes de atención en el inbox?',
  'Muéstrame los últimos pagos recibidos',
  '¿Cuántos emails están pendientes de aprobación?',
];

export default function AIAssistant() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          pageContext: location.pathname,
        }),
      });

      const data = await res.json();
      const assistantMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.text || data.error || 'Error al procesar la respuesta.',
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Error de conexión. Comprueba tu conexión e inténtalo de nuevo.' },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages, location.pathname]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          className={styles.trigger}
          onClick={() => setOpen(true)}
          title="Asistente IA ProEv"
          aria-label="Abrir asistente IA"
        >
          ✦
        </button>
      )}

      {/* Mobile overlay */}
      {open && <div className={styles.overlay} onClick={() => setOpen(false)} />}

      {/* Chat panel */}
      {open && (
        <div className={styles.panel} role="dialog" aria-label="Asistente IA ProEv">
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span className={styles.panelTitleDot} />
              Asistente ProEv
            </div>
            <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </div>

          <div className={styles.messages}>
            {messages.length === 0 ? (
              <div className={styles.welcome}>
                <span className={styles.welcomeIcon}>✦</span>
                <p className={styles.welcomeText}>
                  Soy tu asistente de ProEv. Puedo consultar datos de alumnos, inbox, revisiones de vídeo, pagos y emails. ¿En qué te ayudo?
                </p>
                <div className={styles.suggestions}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} className={styles.suggestionBtn} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`${styles.message} ${msg.role === 'user' ? styles.messageUser : styles.messageAssistant}`}
                >
                  <div className={styles.bubble}>{msg.content}</div>
                </div>
              ))
            )}

            {loading && (
              <div className={`${styles.message} ${styles.typing}`}>
                <div className={styles.typingDots}>
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputArea}>
            <textarea
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre alumnos, pagos, emails…"
              rows={1}
              disabled={loading}
            />
            <button
              className={styles.sendBtn}
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
