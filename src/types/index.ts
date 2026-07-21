/**
 * Tipos base del framework.
 * Agrega aquí nuevas interfaces cuando incorpores módulos de prueba.
 */

/** Valor primitivo que puede contener una celda de Excel */
export type CellScalar = string | number | boolean | null;

/** Tipo base para cualquier fila de datos leída del Excel */
export type TestDataRow = Record<string, CellScalar>;

// ─────────────────────────────────────────────────────────────
// Interfaces por hoja del Excel maestro
// Las URLs y datos de pago se configuran en src/config/environment.ts
// ─────────────────────────────────────────────────────────────

/**
 * Pestaña: NBF_OW / NBF_RT
 * Flujo: Selección POS › vuelo OW/RT › bundle › pasajeros › datos personales › ancillaries › pago › PNR
 */
export interface NbfCaseData extends TestDataRow {
  TC: string;
  POS: string;
  salida: string;
  regreso: string;
  /** 'RT' | 'OW' — determina qué URL usar */
  Viaje: string;
  Bundle: string;
  Adultos: number;
  Youngs: number;
  Children: number;
  Infants: number;
  Nombre: string;
  Genero: string;
  'F.Nac': string;
  Nacionalidad: string;
  LifeMiles: string;
  Telefono: string;
  Correo: string;
  Asiento: string;
  'Equipaje Adic': string;
  'Sala VIP': string;
  'Equipaje Deportivo': string;
  'Asistencia Viaje': string;
  'Abordaje Prioritario': string;
  Cobertura: string;
}

/**
 * Pestaña: SSCI_Casos (SSCI_Casos)
 * Flujo: Ingresar PNR + apellido › TyC › formularios › asientos › ancillaries › confirmar › pasabordo › wallet/correo
 */
export interface SsciCaseData extends TestDataRow {
  TC: string;
  PNR: string;
  Apellido: string;
  Pax: number;
  'OW/RT': string;
  Asientos: string;
  'Equip Bodega': string;
  'Cambio Asiento': string;
  Priority: string;
  Lounge: string;
  Wallet: string;
  Correo: string;
}

/**
 * Pestaña: ATC
 * (Por definir — agregar columnas cuando la hoja tenga datos)
 */
export interface AtcCaseData extends TestDataRow {
  TC: string;
}
