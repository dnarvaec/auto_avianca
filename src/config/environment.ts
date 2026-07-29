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
 * Datos de la tarjeta de crédito de prueba y datos del tarjetahabiente.
 * Compartidos entre NBF, SSCI y ATC — fuente única de verdad en .env
 *
 * Los campos de billing tienen valores por defecto de QA para evitar
 * errores si el .env no los tiene definidos.
 */
export const PAYMENT = {
  /** Número completo de 16 dígitos — requerido */
  cardNumber: requireEnv('CC_NUMBER'),
  /** Fecha de vencimiento (MM/YY) — requerido */
  expiryDate: requireEnv('CC_EXPIRY'),
  /** Código de seguridad (CVV/CVC) — requerido */
  cvv: requireEnv('CC_CVV'),
  /** Datos de billing del tarjetahabiente (opcionales, con defaults de QA) */
  holderName:     process.env['CC_HOLDER_NAME']     ?? 'Juan',
  holderLastname: process.env['CC_HOLDER_LASTNAME']  ?? 'Perez',
  email:          process.env['CC_EMAIL']             ?? 'accept@accept.com',
  areaCode:       process.env['CC_AREA_CODE']         ?? 'Colombia (+57)',
  phone:          process.env['CC_PHONE']             ?? '3001111111',
  address:        process.env['CC_ADDRESS']           ?? 'Calle 100',
  city:           process.env['CC_CITY']              ?? 'Bogota',
  country:        process.env['CC_COUNTRY']           ?? 'Colombia',
} as const;

/** Tipo inferido de PAYMENT — útil para tipar parámetros de Page Objects */
export type PaymentConfig = typeof PAYMENT;
