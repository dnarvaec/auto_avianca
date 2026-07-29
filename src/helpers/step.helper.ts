import { test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Wrapper sobre test.step() que adjunta automáticamente un screenshot al reporte
 * HTML de Playwright al finalizar cada paso (exitoso o fallido).
 *
 * Reutilizable en todos los specs: NBF, SSCI, ATC.
 *
 * @example
 * await step(page, '1/5 — Vuelo + Bundle', async () => {
 *   await availPage.selectFirstFlight();
 *   await availPage.selectBundle(tc.Bundle);
 * });
 */
export async function step(
  page: Page,
  label: string,
  fn: () => Promise<void>,
): Promise<void> {
  await test.step(label, async () => {
    try {
      await fn();
    } finally {
      // Screenshot siempre: tanto si el paso pasa como si falla
      const img = await page.screenshot({ fullPage: false }).catch(() => null);
      if (img) {
        await test.info().attach(`📸 ${label}`, {
          body: img,
          contentType: 'image/png',
        });
      }
    }
  });
}
