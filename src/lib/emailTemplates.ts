export type TemplateKey = 'disculpa' | 'seguimiento' | 'recordatorio' | 'libre';

export interface EmailTemplate {
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATES: Record<TemplateKey, EmailTemplate> = {
  disculpa: {
    subject: 'Información sobre tu módulo en ProEv',
    body: `Hola {nombre},

Nos hemos dado cuenta de que hay una situación con el módulo que elegiste que nos gustaría aclarar contigo.

[Describe aquí el detalle del módulo y los pasos para corregirlo.]

Estamos aquí para ayudarte en lo que necesites. No dudes en respondernos si tienes alguna pregunta.

Un saludo,
El equipo de ProEv`,
  },
  seguimiento: {
    subject: 'Asignación de pareja para tu Módulo 3',
    body: `Hola {nombre},

Estamos trabajando en la asignación de parejas para el Módulo 3 y nos ponemos en contacto contigo porque aún no tienes pareja asignada.

[Describe aquí los próximos pasos o solicita la información que necesitas del alumno.]

Queríamos mantenerte informado/a y asegurarnos de que todo esté listo antes del inicio.

Un saludo,
El equipo de ProEv`,
  },
  recordatorio: {
    subject: 'Recordatorio de pago pendiente — ProEv',
    body: `Hola {nombre},

Te escribimos para recordarte que tienes un pago pendiente en tu cuenta de ProEv.

[Añade aquí los detalles del pago o un enlace si corresponde.]

Si ya realizaste el pago recientemente, por favor ignora este mensaje. Si tienes alguna duda, estamos disponibles para ayudarte.

Un saludo,
El equipo de ProEv`,
  },
  libre: {
    subject: '',
    body: '',
  },
};

export const UI_TEMPLATE_OPTIONS: { key: TemplateKey; labelKey: string }[] = [
  { key: 'disculpa', labelKey: 'emailCompose.templates.disculpa' },
  { key: 'seguimiento', labelKey: 'emailCompose.templates.seguimiento' },
  { key: 'recordatorio', labelKey: 'emailCompose.templates.recordatorio' },
  { key: 'libre', labelKey: 'emailCompose.templates.libre' },
];
