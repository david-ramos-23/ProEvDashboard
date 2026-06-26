import { ConfirmDialog } from 'dashboard';

const noop = () => {};

/** Danger variant — destructive confirmation (primary card story). */
export const Peligro = () => (
  <ConfirmDialog
    open
    variant="danger"
    icon="🗑️"
    title="¿Eliminar alumno?"
    message="Esta acción no se puede deshacer. El alumno y todo su historial se borrarán permanentemente."
    confirmLabel="Eliminar"
    cancelLabel="Cancelar"
    onConfirm={noop}
    onCancel={noop}
  />
);

/** Success variant — positive confirmation. */
export const Confirmacion = () => (
  <ConfirmDialog
    open
    variant="success"
    icon="✅"
    title="¿Aprobar vídeo?"
    message="El alumno pasará al estado “Aprobado” y recibirá un email de confirmación."
    confirmLabel="Aprobar"
    cancelLabel="Volver"
    onConfirm={noop}
    onCancel={noop}
  />
);

/** Warning variant. */
export const Aviso = () => (
  <ConfirmDialog
    open
    variant="warning"
    icon="⚠️"
    title="Cambiar de módulo"
    message="El alumno será movido al Módulo 2. ¿Quieres continuar?"
    confirmLabel="Mover"
    cancelLabel="Cancelar"
    onConfirm={noop}
    onCancel={noop}
  />
);
