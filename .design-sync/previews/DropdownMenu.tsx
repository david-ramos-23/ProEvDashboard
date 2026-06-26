import { useRef } from 'react';
import { DropdownMenu } from 'dashboard';

const noop = () => {};

const menuItem = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-primary)',
  font: 'inherit',
  cursor: 'pointer',
};

function MenuDemo() {
  const trigger = useRef(null);
  return (
    <div style={{ padding: 'var(--space-lg)', background: 'var(--color-bg-primary)', minHeight: 260 }}>
      <button
        ref={trigger}
        style={{
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)',
          font: 'inherit',
          cursor: 'pointer',
        }}
      >
        Acciones ▾
      </button>
      <DropdownMenu open onClose={noop} triggerRef={trigger} width={220}>
        <button role="menuitem" style={menuItem}>✏️ Editar alumno</button>
        <button role="menuitem" style={menuItem}>✉️ Enviar email</button>
        <button role="menuitem" style={menuItem}>🎥 Ver vídeo</button>
        <button role="menuitem" style={{ ...menuItem, color: 'var(--color-accent-danger)' }}>🗑️ Eliminar</button>
      </DropdownMenu>
    </div>
  );
}

/** Portal-positioned menu anchored under a trigger button, shown open. */
export const Menu = () => <MenuDemo />;
