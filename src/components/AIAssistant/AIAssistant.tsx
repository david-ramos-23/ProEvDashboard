/**
 * AI Assistant — Fixed right-column panel backed by /api/ai-chat.
 *
 * Renders as a persistent right-side panel (360px) that slides in/out.
 * isOpen / onToggle are controlled by Layout so the main content area
 * can shift its margin accordingly.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './AIAssistant.module.css';

/** Lightweight markdown-to-HTML for assistant responses */
function renderMarkdown(text: string): string {
  return text
    // code blocks
    .replace(/```[\s\S]*?```/g, (m) => {
      const code = m.slice(3, -3).replace(/^\w*\n/, '');
      return `<pre><code>${code.replace(/</g, '&lt;')}</code></pre>`;
    })
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // unordered lists
    .replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // line breaks (double newline = paragraph break)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
}

const AI_CHAT_URL = import.meta.env.DEV
  ? (import.meta.env.VITE_AI_CHAT_URL || 'https://proev-dashboard.dravaautomations.com/api/ai-chat')
  : '/api/ai-chat';

const SUGGESTIONS = [
  '¿Cuántos alumnos están en revisión de vídeo?',
  '¿Hay emails pendientes de atención en el inbox?',
  'Muéstrame los últimos pagos recibidos',
  '¿Cuántos emails están pendientes de aprobación?',
];

export default function AIAssistant({ isOpen, onToggle }: AIAssistantProps) {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

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
      const res = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          pageContext: location.pathname,
        }),
      });

      const data = await res.json();
      setMessages(prev => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: data.text || data.error || 'Error al procesar la respuesta.' },
      ]);
    } catch {
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Error de conexión. Inténtalo de nuevo.' },
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
    <div
      className={`${styles.backdrop} ${isOpen ? styles.backdropOpen : ''}`}
      onClick={onToggle}
    />
    <div
      className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
      role="complementary"
      aria-label="Asistente IA ProEv"
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (dx > 80) onToggle(); // swipe right to close
      }}
    >
      {/* Header */}
      <div className={styles.panelHeader}>
        <div className={styles.panelTitle}>
          <span className={styles.panelTitleDot} />
          Asistente ProEv
        </div>
        <div className={styles.panelHeaderActions}>
          {messages.length > 0 && (
            <button
              className={styles.iconBtn}
              onClick={() => setMessages([])}
              title="Limpiar conversación"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          )}
          <button className={styles.iconBtn} onClick={onToggle} title="Cerrar panel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <span className={styles.welcomeIcon}>✦</span>
            <p className={styles.welcomeText}>
              Consulta datos de alumnos, inbox, revisiones, pagos y emails. ¿En qué te ayudo?
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
              {msg.role === 'assistant' ? (
                <div className={styles.bubble} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
              ) : (
                <div className={styles.bubble}>{msg.content}</div>
              )}
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

      {/* Input */}
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5" />
            <polyline points="5 12 12 5 19 12" />
          </svg>
        </button>
      </div>
    </div>
    </>
  );
}
