import { test as base, expect } from '@playwright/test';
import { ExcelReader } from '../helpers/ExcelReader';

/** Fixtures disponibles en los tests */
export type CustomFixtures = {
  /** Instancia del lector de Excel lista para usar en cada test */
  excelReader: ExcelReader;
};

/**
 * Extensión del test de Playwright con fixtures personalizados.
 *
 * Uso en tests:
 *   import { test, expect } from '../../src/fixtures/test.fixture';
 */
export const test = base.extend<CustomFixtures>({
  excelReader: async ({}, use) => {
    const reader = new ExcelReader('maestro.xlsx');
    await use(reader);
  },
});

export { expect };
