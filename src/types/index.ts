/**
 * Tipos centrales del sistema ProEv Dashboard.
 * Mapean 1:1 con las tablas de Airtable pero son agnósticos a la fuente de datos.
 */

// ============================================================
// Estados del sistema
// ============================================================

/** Los 11 estados posibles de un alumno en el flujo ProEv */
export type EstadoGeneral =
  | 'Privado'
  | 'Preinscrito'
  | 'En revision de video'
  | 'Aprobado'
  | 'Rechazado'
  | 'Pendiente de pago'
  | 'Reserva'
  | 'Pagado'
  | 'Finalizado'
  | 'Plazo Vencido'
  | 'Pago Fallido';

/** Estados de revisión de video */
export type EstadoRevision = 'Pendiente' | 'Aprobado' | 'Rechazado' | 'Revision Necesaria';

/** Estados de pago */
export type EstadoPago = 'Pendiente' | 'Pagado' | 'Fallido' | 'Reembolsado' | 'Enviado';

/** Estados del email en Cola de Emails */
export type EstadoEmail = 'Pendiente Aprobacion' | 'Pendiente' | 'Enviando' | 'Enviado' | 'Error';

/** Tipos de email soportados */
export type TipoEmail =
  | 'disculpa'
  | 'informacion'
  | 'recordatorio'
  | 'seguimiento'
  | 'bienvenida'
  | 'felicitacion'
  | 'urgente';

/** Estados de edición */
export type EstadoEdicion = 'Planificada' | 'En Inscripcion' | 'Activa' | 'Finalizada';

/** Idioma del alumno */
export type Idioma = 'Espanol' | 'Ingles';

/** Roles del dashboard */
export type UserRole = 'admin' | 'revisor';

// ============================================================
// Entidades principales
// ============================================================

/** Registro base — todos los registros de cualquier fuente tienen un ID */
export interface BaseRecord {
  id: string;
  createdTime?: string;
}

/** Alumno — tabla central del sistema */
export interface Alumno extends BaseRecord {
  nombre: string;
  email: string;
  telefono?: string;
  estadoGeneral: EstadoGeneral;
  idioma: Idioma;
  moduloSolicitado?: string;
  modulosCompletados?: string[];
  edicion?: string;
  edicionId?: string;
  fotoPerfil?: string;
  // Plazos
  plazoRevision?: string;
  fechaPlazo?: string;
  fechaPreinscripcion?: string;
  moduloReserva?: string;
  fechaEntradaReserva?: string;
  // Métricas (read-only, rollups)
  totalRevisiones?: number;
  ultimaFechaRevision?: string;
  estadoRevisionReciente?: EstadoRevision;
  totalPagos?: number;
  importeTotalPagado?: number;
  fechaUltimoPago?: string;
  puntuacionVideo?: number;
  engagementScore?: number;
  // Campos IA (read-only)
  resumenFeedbackIA?: string;
  siguienteAccionIA?: string;
  // Internos
  notasInternas?: string;
  adminResponsable?: string;
  ultimaModificacion?: string;
}

/** Revisión de Video */
export interface RevisionVideo extends BaseRecord {
  alumnoId: string;
  alumnoNombre?: string;
  revisorResponsable?: string;
  fechaRevision?: string;
  videoEnviado?: string;
  redesSociales?: string;
  usuariosRRSS?: string;
  estadoRevision: EstadoRevision;
  puntuacion?: number;
  feedback?: string;
  notasInternas?: string;
  ultimaActualizacion?: string;
  diasDesdeEnvio?: number;
  estadoGeneralAlumno?: EstadoGeneral;
  // Campos IA
  resumenInteligente?: string;
  clasificacionAutomatica?: string;
}

/** Pago */
export interface Pago extends BaseRecord {
  alumnoId: string;
  alumnoNombre?: string;
  linkPagoStripe?: string;
  importe: number;
  moneda: 'EUR' | 'USD' | 'MXN';
  estadoPago: EstadoPago;
  fechaPago?: string;
  idSesionStripe?: string;
  linkRecibo?: string;
  notasInternas?: string;
  diasDesdePago?: number;
  mesPago?: string;
  // Campos IA
  resumenInteligente?: string;
  analisisRiesgo?: string;
}

/** Historial — log de actividad */
export interface Historial extends BaseRecord {
  descripcion: string;
  tipoAccion: string;
  alumnoId?: string;
  alumnoNombre?: string;
  adminResponsable?: string;
  origenEvento: 'Manual' | 'Automatico' | 'Webhook' | 'API' | 'Workflow Automatico';
  errorLog?: string;
  // Campos IA
  resumenAutomatico?: string;
  clasificacionImportancia?: 'Alta' | 'Media' | 'Baja';
}

export interface Edicion extends BaseRecord {
  nombre: string;
  estado: EstadoEdicion;
  esEdicionActiva: boolean;
  fechaInicioInscripcion?: string;
  fechaFinInscripcion?: string;
  fechaInicioCurso?: string;
  fechaFinCurso?: string;
  modulosDisponibles?: string[];
}

/** Módulo */
export interface Modulo extends BaseRecord {
  moduloId: string; // mod1, mod2, mod3, pack1y2, etc.
  nombre: string;
  precioOnline?: number;
  activo: boolean;
  reservaPrelanzamiento?: number;
}

/** Cola de Emails */
export interface ColaEmail extends BaseRecord {
  alumnoId: string;
  alumnoNombre?: string;
  tipo: TipoEmail;
  asunto?: string;
  mensaje: string;
  estado: EstadoEmail;
  descripcion?: string;
}

/** Envío masivo de emails */
export interface EnvioEmail extends BaseRecord {
  alumnosIds: string[];
  tipo: TipoEmail;
  mensaje: string;
  descripcion?: string;
  estado: string;
}

/** Email del Inbox */
export interface InboxEmail extends BaseRecord {
  de: string;
  para: string;
  asunto: string;
  contenido: string;
  direccion: 'Recibido' | 'Enviado';
  estado: 'Nuevo' | 'Leido' | 'Respondido' | 'Archivado' | 'Eliminado';
  alumnoId?: string;
  alumnoNombre?: string;
  messageId?: string;
  threadId?: string;
  // Campos IA
  resumenIA?: string;
  tipoConsulta?: string;
  requiereAtencion?: boolean;
  respuestaSugerida?: string;
  respuestaFinal?: string;
}

// ============================================================
// Stats & KPIs
// ============================================================

export interface DashboardStats {
  totalAlumnos: number;
  alumnosPorEstado: Record<EstadoGeneral, number>;
  totalPagados: number;
  pendientesRevision: number;
  ingresosTotales: number;
  engagementPromedio: number;
}

export interface PagoStats {
  totalRecaudado: number;
  pagosCompletados: number;
  pagosFallidos: number;
  pagosReembolsados: number;
}

// ============================================================
// Auth
// ============================================================

export interface User {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
  activo: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
