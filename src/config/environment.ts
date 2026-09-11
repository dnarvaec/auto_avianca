import fs from 'fs';
import path from 'path';

/**
 * Configuración de entorno del framework.
 *
 * Las URLs y los datos sensibles (tarjeta) se definen en el archivo .env
 * y NUNCA se mezclan con los casos del Excel maestro.
 *
 * Prioridad de lectura:
 * 1. Archivo .env físico en el disco (raíz del proyecto).
 * 2. process.env (inyección en pipelines CI/CD).
 * 3. Fallbacks predeterminados de QA (si aplica).
 */

/** Función nativa para leer y parsear el archivo .env sin librerías externas */
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match && match[1] && match[2] !== undefined) {
      const key = match[1].trim();
      let val = match[2].trim();
      // Remover comillas envolventes si las tiene
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[key] = val;
    }
  }
  return result;
}

// Localizar y parsear directamente el archivo .env físico
const ENV_PATH = path.resolve(process.cwd(), '.env');
const fileEnv = parseEnvFile(ENV_PATH);

/** Obtiene una variable de entorno dando prioridad absoluta al archivo .env físico */
function getEnv(name: string, fallback?: string): string {
  const value = fileEnv[name] ?? process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `[Config] Variable de entorno requerida no encontrada: "${name}"\n` +
      `Revisa tu archivo .env en: ${ENV_PATH}`
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
  NBF_OW: getEnv('NBF_OW_URL'),
  /** NBF — New Booking Flow, Round Trip */
  NBF_RT: getEnv('NBF_RT_URL'),
  /** SSCI — Self Service Check-In */
  SSCI: getEnv('SSCI_URL'),
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
  cardNumber: getEnv('CC_NUMBER'),
  /** Fecha de vencimiento (MM/YY) — requerido */
  expiryDate: getEnv('CC_EXPIRY'),
  /** Código de seguridad (CVV/CVC) — requerido */
  cvv: getEnv('CC_CVV'),
  /** Datos de billing del tarjetahabiente (opcionales, con defaults de QA) */
  holderName: getEnv('CC_HOLDER_NAME', 'Juan'),
  holderLastname: getEnv('CC_HOLDER_LASTNAME', 'Perez'),
  email: getEnv('CC_EMAIL', 'accept@accept.com'),
  areaCode: getEnv('CC_AREA_CODE', 'Colombia (+57)'),
  phone: getEnv('CC_PHONE', '3001111111'),
  address: getEnv('CC_ADDRESS', 'Calle 100'),
  city: getEnv('CC_CITY', 'Bogota'),
  country: getEnv('CC_COUNTRY', 'Colombia'),
} as const;

/** Tipo inferido de PAYMENT — útil para tipar parámetros de Page Objects */
export type PaymentConfig = typeof PAYMENT;