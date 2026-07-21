import ExcelJS from 'exceljs';
import path from 'path';
import type { CellScalar, TestDataRow } from '../types';

/** Carpeta donde deben alojarse los archivos Excel */
const DATA_FOLDER = path.resolve(__dirname, '../../data');

/**
 * Lee el archivo Excel maestro y extrae los datos de una pestaña.
 *
 * El Excel maestro contiene ÚNICAMENTE casos de prueba.
 * Las URLs y datos de pago se configuran en el archivo .env
 * a través de src/config/environment.ts.
 *
 * Convención del Excel:
 * - Fila 1: cabeceras (nombres de columna)
 * - Fila 2+: datos de prueba
 * - Las filas completamente vacías se omiten
 */
export class ExcelReader {
  private readonly filePath: string;

  constructor(fileName: string) {
    this.filePath = path.join(DATA_FOLDER, fileName);
  }

  /**
   * Devuelve todas las filas de datos de una pestaña como objetos tipados.
   * @param sheetName Nombre exacto de la pestaña (case-sensitive)
   */
  async getSheetData<T extends TestDataRow>(sheetName: string): Promise<T[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);

    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      const available = workbook.worksheets.map(ws => ws.name).join(', ');
      throw new Error(
        `Pestaña "${sheetName}" no encontrada en: ${this.filePath}\n` +
        `Pestañas disponibles: ${available}`
      );
    }

    const rows: T[] = [];
    let headers: string[] = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
      const rawValues = (row.values as ExcelJS.CellValue[]).slice(1);

      if (rowIndex === 1) {
        headers = rawValues.map(v => this.cellToString(v) ?? '').filter(Boolean);
        return;
      }

      const dataRow = headers.reduce<Record<string, CellScalar>>((acc, header, i) => {
        acc[header] = this.parseCellValue(rawValues[i] ?? null);
        return acc;
      }, {});

      // Solo agregar filas con datos reales (ignora filas de metadatos sin cabecera)
      if (
        Object.values(dataRow).some(v => v !== null && v !== '') &&
        // La primera columna debe tener valor (TC01, SSCI-01, etc.)
        dataRow[headers[0]] !== null
      ) {
        rows.push(dataRow as T);
      }
    });

    return rows;
  }

  /** Devuelve los nombres de todas las pestañas del archivo */
  async getAvailableSheets(): Promise<string[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.filePath);
    return workbook.worksheets.map(ws => ws.name);
  }

  // ─── Métodos privados de parseo ──────────────────────────────

  private parseCellValue(cell: ExcelJS.CellValue): CellScalar {
    if (cell === null || cell === undefined) return null;
    if (typeof cell === 'string') return cell.trim() || null;
    if (typeof cell === 'number') return cell;
    if (typeof cell === 'boolean') return cell;
    if (cell instanceof Date) return cell.toISOString().split('T')[0];

    // Tipos complejos de exceljs — normalizar a primitivo
    const obj = cell as unknown as Record<string, unknown>;

    if ('richText' in obj && Array.isArray(obj.richText)) {
      const parts = (obj.richText as Array<{ text: string }>).map(rt => rt.text);
      return parts.join('').trim() || null;
    }

    if ('result' in obj) {
      return this.parseCellValue(obj.result as ExcelJS.CellValue);
    }

    if ('text' in obj && typeof obj.text === 'string') {
      return obj.text.trim() || null;
    }

    if ('error' in obj) return null;

    return null;
  }

  private cellToString(cell: ExcelJS.CellValue): string | null {
    const parsed = this.parseCellValue(cell);
    return parsed !== null ? String(parsed) : null;
  }
}
