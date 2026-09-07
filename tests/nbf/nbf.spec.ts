import { test } from '../../src/fixtures/test.fixture';
import { ExcelReader } from '../../src/helpers/ExcelReader';
import { step } from '../../src/helpers/step.helper';
import { URLS, PAYMENT } from '../../src/config/environment';
import { AvailabilityPage } from '../../src/pages/nbf/AvailabilityPage';
import { TripSummaryPage } from '../../src/pages/nbf/TripSummaryPage';
import { TravelersPage } from '../../src/pages/nbf/TravelersPage';
import { AncillariesPage } from '../../src/pages/nbf/AncillariesPage';
import { PaymentPage } from '../../src/pages/nbf/PaymentPage';
import type { NbfCaseData } from '../../src/types';
import type { Page } from '@playwright/test';

// Flujo completo NBF validado en vivo (2026-07-22):
// Step 1: /av/booking/avail                  -> Vuelo + Bundle
// Step 2: /av/booking/travelers              -> Pasajero + Booking holder
// Step 3: /av/booking/travelers?orderId=XXX  -> Ancillaries (genera PNR)
// Step 4: sdkqa.avtest.ink/pay?sessionID=... -> Pago con tarjeta de credito
// Step 5: sdkqa.avtest.ink/confirmation      -> Confirmacion de pago
//
// Para ejecutar solo un caso especifico usar la variable TC_FILTER:
//   $env:TC_FILTER="NBFOW-03"; npx playwright test tests/nbf/nbf.spec.ts
// Para limpiarla:
//   $env:TC_FILTER=""; npx playwright test tests/nbf/nbf.spec.ts

const reader = new ExcelReader('maestro.xlsx');

/** Si TC_FILTER esta definido, solo corre el caso con ese ID (ej: "NBFOW-03") */
const TC_FILTER = process.env['TC_FILTER']?.trim() ?? '';

// ─── Helpers para buildNbfUrl ────────────────────────────────────────────────

/** Abreviaciones de mes en ingles para el formato de fecha NBF (DDMMM) */
const NBF_MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * Convierte una fecha ISO del Excel ("2026-10-01T00:00:00.000Z")
 * al formato DDMMM requerido por la URL NBF ("01OCT").
 */
function toNbfDate(isoDate: string): string | null {
  const raw = String(isoDate).split('T')[0]; // "2026-10-01"
  const parts = raw.split('-');
  if (parts.length < 3) return null;
  const [, month, day] = parts;
  const abbr = NBF_MONTH_ABBR[parseInt(month, 10) - 1];
  if (!abbr) return null;
  return `${parseInt(day, 10).toString().padStart(2, '0')}${abbr}`; // "01OCT"
}

/** Mapeo del POS del Excel al codigo de pais para el parametro Pais de la URL */
const POS_TO_COUNTRY: Record<string, string> = {
  COP: 'CO', CO: 'CO',
  US: 'US',
  BR: 'BR',
  ES: 'ES',
  UK: 'UK', GB: 'UK',
  AR: 'AR',
  MX: 'MX',
};

/**
 * Construye la URL de navegacion NBF reemplazando TODOS los parametros
 * dinamicos desde el caso de prueba del Excel.
 *
 * La URL base del .env contiene valores fijos (fecha, pasajeros, pais, cabina).
 * Esta funcion los sobrescribe con los datos reales por caso para que cada
 * ejecucion refleje exactamente lo que el Excel define.
 *
 * Parametros reemplazados:
 *   fi  → fecha de salida (DDMMM)
 *   fr  → fecha de regreso (DDMMM) — solo RT; se elimina para OW
 *   na  → adultos
 *   nj  → youngs
 *   nn  → children
 *   ni  → infants
 *   Pais         → pais del POS
 *   selectedCabin → cabina segun bundle
 */
function buildNbfUrl(baseUrl: string, tc: NbfCaseData): string {
  try {
    const url = new URL(baseUrl);

    // ── Fecha de salida ────────────────────────────────────────────────────
    const salidaNbf = toNbfDate(String(tc.salida));
    if (salidaNbf) url.searchParams.set('fi', salidaNbf);

    // ── Fecha de regreso (solo Round Trip) ─────────────────────────────────
    const regresoRaw = String(tc.regreso ?? '');
    const regresoNbf = toNbfDate(regresoRaw);
    if (regresoNbf) {
      url.searchParams.set('fr', regresoNbf);
    } else {
      url.searchParams.delete('fr'); // One Way: eliminar si existia en el template
    }

    // ── Pasajeros ──────────────────────────────────────────────────────────
    url.searchParams.set('na', String(Math.max(1, Number(tc.Adultos) || 1)));
    url.searchParams.set('nj', String(Number(tc.Youngs) || 0));
    url.searchParams.set('nn', String(Number(tc.Children) || 0));
    url.searchParams.set('ni', String(Number(tc.Infants) || 0));

    // ── Pais (del POS) ─────────────────────────────────────────────────────
    const country = POS_TO_COUNTRY[String(tc.POS).toUpperCase()] ?? String(tc.POS);
    url.searchParams.set('Pais', country);

    // Nota: selectedCabin NO se modifica aqui.
    // La cabina (Economy / Business) se selecciona en la UI despues de
    // hacer clic en el vuelo, mediante AvailabilityPage.selectBundle().

    return url.toString();
  } catch {
    return baseUrl; // fallback si la URL base no es parseable
  }
}

/**
 * Ejecuta un caso NBF completo end-to-end.
 * Cada fase usa step() que adjunta un screenshot automatico al reporte HTML.
 * El reporte mostrara 5 screenshots por caso de prueba.
 */
async function runNbfCase(page: Page, tc: NbfCaseData, url: string): Promise<void> {
  const availPage = new AvailabilityPage(page);
  const tripSummary = new TripSummaryPage(page);
  const travelersPage = new TravelersPage(page);
  const ancillariesPage = new AncillariesPage(page);
  const paymentPage = new PaymentPage(page);

  // 1/N: Seleccion de vuelo y bundle -----------------------------------------
  // La URL se construye dinamicamente con los pasajeros del caso (na/nj/nn/ni)
  const nbfUrl = buildNbfUrl(url, tc);
  await step(page, '1 -- Vuelo + Bundle', async () => {
    await page.goto(nbfUrl);
    await availPage.selectFirstFlight();
    await availPage.selectBundle(String(tc.Bundle));
    await tripSummary.waitForPage();
    await tripSummary.continue();
  });

  // 2/N: Datos de todos los pasajeros + Booking holder -----------------------
  // fillAllPassengers gestiona dinamicamente Adult 1 (Excel) + Adult 2+,
  // Youngs, Children e Infants (datos genericos con edad correcta).
  await step(page, '2 -- Pasajero(s) + Booking holder', async () => {
    await travelersPage.fillAllPassengers(tc);
    await travelersPage.fillBookingHolder(
      String(tc.Telefono),
      String(tc.Correo),
    );
  });

  // 3/N: Generacion de PNR y ancillaries ------------------------------------
  await step(page, '3 -- Ancillaries (genera PNR)', async () => {
    await travelersPage.continue();
    await ancillariesPage.waitForPage();
    await ancillariesPage.handleAncillaries({
      Asiento: String(tc.Asiento),
      'Equipaje Adic': String(tc['Equipaje Adic']),
      'Sala VIP': String(tc['Sala VIP']),
      'Equipaje Deportivo': String(tc['Equipaje Deportivo']),
      'Asistencia Viaje': String(tc['Asistencia Viaje']),
      'Abordaje Prioritario': String(tc['Abordaje Prioritario']),
    });
  });

  // 4/N: Formulario de pago con tarjeta ------------------------------------
  await step(page, '4 -- Formulario de pago', async () => {
    await ancillariesPage.goToPayment();
    await paymentPage.waitForPage();
    await paymentPage.fillPaymentForm(PAYMENT);
  });

  // 5/N: Confirmar pago y verificar éxito ------------------------------------
  await step(page, '5 -- Confirmacion de pago', async () => {
    await paymentPage.submitPayment();
    const pnr = await paymentPage.assertPaymentSuccess();

    // Registrar PNR en las anotaciones del reporte
    test.info().annotations.push({ type: 'Booking Code (PNR)', description: pnr });
  });
}

// ────────────────────────────────────────────────────────────────
// NBF -- One Way
// ────────────────────────────────────────────────────────────────
test.describe('NBF -- One Way (DDT)', () => {
  let testData: NbfCaseData[] = [];

  test.beforeAll(async () => {
    testData = await reader.getSheetData<NbfCaseData>('NBF_OW');
    console.log(`NBF_OW: ${testData.length} casos cargados`);
  });

  test('Ejecutar casos One Way desde Excel', async ({ page }) => {
    const failures: string[] = [];

    for (const tc of testData) {
      // Si TC_FILTER esta activo, saltar las filas que no coincidan
      if (TC_FILTER && String(tc.TC) !== TC_FILTER) continue;

      await test.step(`[${tc.TC}] ${tc.Cobertura} | POS:${tc.POS} | Bundle:${tc.Bundle}`, async () => {
        try {
          await runNbfCase(page, tc, URLS.NBF_OW);
        } catch (err) {
          // Registrar el fallo sin detener el resto de las filas
          const msg = `[${tc.TC}] FALLO: ${(err as Error).message}`;
          failures.push(msg);
          console.error(msg);
          // Navegar a URL base para limpiar el estado del browser antes del siguiente caso
          await page.goto('about:blank').catch(() => { });
        }
      });
    }

    // Fallar el test al final si alguna fila tuvo error
    if (failures.length > 0) {
      throw new Error(`${failures.length} caso(s) fallaron:\n${failures.join('\n')}`);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// NBF -- Round Trip
// ────────────────────────────────────────────────────────────────
test.describe('NBF -- Round Trip (DDT)', () => {
  let testData: NbfCaseData[] = [];

  test.beforeAll(async () => {
    testData = await reader.getSheetData<NbfCaseData>('NBF_RT');
    console.log(`NBF_RT: ${testData.length} casos cargados`);
  });

  test('Ejecutar casos Round Trip desde Excel', async ({ page }) => {
    const failures: string[] = [];

    for (const tc of testData) {
      // Si TC_FILTER esta activo, saltar las filas que no coincidan
      if (TC_FILTER && String(tc.TC) !== TC_FILTER) continue;

      await test.step(`[${tc.TC}] ${tc.Cobertura} | POS:${tc.POS} | Bundle:${tc.Bundle}`, async () => {
        try {
          await runNbfCase(page, tc, URLS.NBF_RT);
        } catch (err) {
          const msg = `[${tc.TC}] FALLO: ${(err as Error).message}`;
          failures.push(msg);
          console.error(msg);
          await page.goto('about:blank').catch(() => { });
        }
      });
    }

    if (failures.length > 0) {
      throw new Error(`${failures.length} caso(s) fallaron:\n${failures.join('\n')}`);
    }
  });
});
