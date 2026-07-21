/**
 * Configuración de entorno del framework.
 *
 * Las URLs y los datos sensibles (tarjeta) se definen en el archivo .env
 * y NUNCA se mezclan con los casos del Excel maestro.
 *
 * Playwright carga el .env automáticamente al arrancar los tests.
 * Para CI/CD, inyectar estas variables como secrets en el pipeline.
 */

/** Valida que una variable de entorno requerida esté definida */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[Config] Variable de entorno requerida no encontrada: "${name}"\n` +
      `Revisa tu archivo .env (copia .env.example como punto de partida).`
    );
  }
  return value;
}

/**
 * URLs de acceso a cada flujo.
 * Cada hoja del Excel maestro corresponde a una URL de este objeto.
 *
 * | Hoja Excel  | Variable .env  | Descripción               |
 * |-------------|----------------|---------------------------|
 * | NBF_OW      | NBF_OW_URL     | NBF One Way               |
 * | NBF_RT      | NBF_RT_URL     | NBF Round Trip            |
 * | SSCI_Casos  | SSCI_URL       | Self Service Check-In     |
 */
export const URLS = {
  /** NBF — New Booking Flow, One Way */
  NBF_OW: requireEnv('NBF_OW_URL'),
  /** NBF — New Booking Flow, Round Trip */
  NBF_RT: requireEnv('NBF_RT_URL'),
  /** SSCI — Self Service Check-In */
  SSCI: requireEnv('SSCI_URL'),
} as const;

/**
 * Datos de la tarjeta de crédito de prueba.
 * Compartida entre NBF, SSCI y ATC — fuente única de verdad en .env
 */
export const PAYMENT = {
  /** Número completo de 16 dígitos */
  cardNumber: requireEnv('CC_NUMBER'),
  /** Fecha de vencimiento (MM/YY) */
  expiryDate: requireEnv('CC_EXPIRY'),
  /** Código de seguridad (CVV/CVC) */
  cvv: requireEnv('CC_CVV'),
} as const;

/** Tipo inferido de PAYMENT — útil para tipar parámetros de Page Objects */
export type PaymentConfig = typeof PAYMENT;
