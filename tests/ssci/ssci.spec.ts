import { test } from '../../src/fixtures/test.fixture';
import { ExcelReader } from '../../src/helpers/ExcelReader';
import { URLS, PAYMENT } from '../../src/config/environment';
import type { SsciCaseData } from '../../src/types';

const reader = new ExcelReader('maestro.xlsx');

test.describe('SSCI — Check-In (DDT)', () => {
  let testData: SsciCaseData[] = [];

  test.beforeAll(async () => {
    // Casos de prueba ← Excel maestro, hoja SSCI_Casos
    testData = await reader.getSheetData<SsciCaseData>('SSCI_Casos');
    // URL ← .env (SSCI_URL)
    console.log(`SSCI: ${testData.length} casos | URL: ${URLS.SSCI}`);
  });

  test('Ejecutar casos Check-In desde Excel', async ({ page }) => {
    for (const tc of testData) {
      await test.step(
        `[${tc.TC}] PNR:${tc.PNR} | ${tc['OW/RT']} | Pax:${tc.Pax}`,
        async () => {

          // ── 1. Navegar a la URL de check-in (definida en .env) ───────────────
          await page.goto(URLS.SSCI);
          await page.waitForLoadState('domcontentloaded');

          // ── 2. TODO: Ingresar PNR + apellido ─────────────────────────────────
          // await page.locator('[name="pnr"]').fill(String(tc.PNR));
          // await page.locator('[name="lastName"]').fill(String(tc.Apellido));

          // ── 3. TODO: Formularios y Términos y Condiciones ─────────────────────

          // ── 4. TODO: Ancillaries opcionales ──────────────────────────────────
          // tc.Asientos, tc['Equip Bodega'], tc['Cambio Asiento']
          // tc.Priority, tc.Lounge

          // ── 5. TODO: Pago con tarjeta si aplica (datos desde .env) ───────────
          // if (tc.Wallet === 'Si' || tc.Wallet === 'si') {
          //   await page.locator('#card-number').fill(PAYMENT.cardNumber);
          //   await page.locator('#expiry').fill(PAYMENT.expiryDate);
          //   await page.locator('#cvv').fill(PAYMENT.cvv);
          // }

          // ── 6. TODO: Confirmar y verificar pasabordo / correo ─────────────────
          // if (tc.Correo === 'Si') { /* verificar envío de correo */ }

        }
      );
    }
  });
});
