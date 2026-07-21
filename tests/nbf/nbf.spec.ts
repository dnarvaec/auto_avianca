import { test } from '../../src/fixtures/test.fixture';
import { ExcelReader } from '../../src/helpers/ExcelReader';
import { URLS, PAYMENT } from '../../src/config/environment';
import type { NbfCaseData } from '../../src/types';

const reader = new ExcelReader('maestro.xlsx');

// ─── NBF — One Way ────────────────────────────────────────────────────────────
test.describe('NBF — One Way (DDT)', () => {
  let testData: NbfCaseData[] = [];

  test.beforeAll(async () => {
    // Casos de prueba ← Excel maestro, hoja NBF_OW
    testData = await reader.getSheetData<NbfCaseData>('NBF_OW');
    // URL ← .env (NBF_OW_URL)
    console.log(`NBF_OW: ${testData.length} casos | URL: ${URLS.NBF_OW.substring(0, 60)}...`);
  });

  test('Ejecutar casos One Way desde Excel', async ({ page }) => {
    for (const tc of testData) {
      await test.step(`[${tc.TC}] ${tc.Cobertura} | POS:${tc.POS} | Bundle:${tc.Bundle}`, async () => {

        // ── 1. Navegar a la URL del flujo NBF OW (definida en .env) ──────────
        await page.goto(URLS.NBF_OW);
        await page.waitForLoadState('domcontentloaded');

        // ── 2. TODO: Bundle y vuelo ───────────────────────────────────────────
        // tc.Bundle, tc.POS, salida: tc.salida

        // ── 3. TODO: Pasajeros ────────────────────────────────────────────────
        // tc.Adultos, tc.Youngs, tc.Children, tc.Infants
        // tc.Nombre, tc.Genero, tc['F.Nac'], tc.Nacionalidad
        // tc.LifeMiles, tc.Telefono, tc.Correo

        // ── 4. TODO: Ancillaries opcionales ──────────────────────────────────
        // tc.Asiento, tc['Equipaje Adic'], tc['Sala VIP']
        // tc['Equipaje Deportivo'], tc['Asistencia Viaje'], tc['Abordaje Prioritario']

        // ── 5. TODO: Pago con tarjeta (datos desde .env, no del Excel) ────────
        // await page.locator('#card-number').fill(PAYMENT.cardNumber);
        // await page.locator('#expiry').fill(PAYMENT.expiryDate);
        // await page.locator('#cvv').fill(PAYMENT.cvv);

      });
    }
  });
});

// ─── NBF — Round Trip ─────────────────────────────────────────────────────────
test.describe('NBF — Round Trip (DDT)', () => {
  let testData: NbfCaseData[] = [];

  test.beforeAll(async () => {
    // Casos de prueba ← Excel maestro, hoja NBF_RT
    testData = await reader.getSheetData<NbfCaseData>('NBF_RT');
    // URL ← .env (NBF_RT_URL)
    console.log(`NBF_RT: ${testData.length} casos | URL: ${URLS.NBF_RT.substring(0, 60)}...`);
  });

  test('Ejecutar casos Round Trip desde Excel', async ({ page }) => {
    for (const tc of testData) {
      await test.step(`[${tc.TC}] ${tc.Cobertura} | POS:${tc.POS} | Bundle:${tc.Bundle}`, async () => {

        // ── 1. Navegar a la URL del flujo NBF RT (definida en .env) ──────────
        await page.goto(URLS.NBF_RT);
        await page.waitForLoadState('domcontentloaded');

        // ── 2. TODO: Bundle y vuelo (incluye regreso) ─────────────────────────
        // tc.Bundle, tc.POS, salida: tc.salida, regreso: tc.regreso

        // ── 3. TODO: Pasajeros ────────────────────────────────────────────────
        // tc.Adultos, tc.Youngs, tc.Children, tc.Infants
        // tc.Nombre, tc.Genero, tc['F.Nac'], tc.Nacionalidad
        // tc.LifeMiles, tc.Telefono, tc.Correo

        // ── 4. TODO: Ancillaries opcionales ──────────────────────────────────
        // tc.Asiento, tc['Equipaje Adic'], tc['Sala VIP']
        // tc['Equipaje Deportivo'], tc['Asistencia Viaje'], tc['Abordaje Prioritario']

        // ── 5. TODO: Pago con tarjeta (datos desde .env, no del Excel) ────────
        // await page.locator('#card-number').fill(PAYMENT.cardNumber);
        // await page.locator('#expiry').fill(PAYMENT.expiryDate);
        // await page.locator('#cvv').fill(PAYMENT.cvv);

      });
    }
  });
});
