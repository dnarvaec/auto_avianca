import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 1: Selección de vuelo y bundle
 * URL: /av/booking/avail o /av/demo-booking/avail
 */

const CABIN_TAB: Record<string, string> = {
  Eco: 'Economy',
  Bus: '[data-testid="business-tab"]',
};

export class AvailabilityPage extends BasePage {
  // ─── Locators ──────────────────────────────────────────────────────────────
  private readonly cookieAcceptBtn: Locator;
  private readonly cookieDarkFilter: Locator;
  private readonly flightCards: Locator;

  constructor(page: Page) {
    super(page);
    this.cookieAcceptBtn = page.locator(
      '#onetrust-accept-btn-handler, button:has-text("Allow all"), button:has-text("Accept"), button:has-text("Aceptar")'
    );
    this.cookieDarkFilter = page.locator('.onetrust-pc-dark-filter, #onetrust-banner-sdk, #onetrust-consent-sdk');
    this.flightCards = page.locator('button.flight-container');
  }

  // ─── Navegación y Cookies ──────────────────────────────────────────────────

  async dismissCookies(): Promise<void> {
    const acceptBtn = this.cookieAcceptBtn.first();
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click({ force: true }).catch(() => { });
      await this.page.waitForTimeout(200);
    }

    // Remover forzosamente el filtro oscuro y el banner para que no intercepten clics
    await this.page.evaluate(() => {
      document.querySelectorAll('.onetrust-pc-dark-filter, #onetrust-banner-sdk, #onetrust-consent-sdk').forEach(el => el.remove());
    }).catch(() => { });

    // Espera dinámica: confirmar que la cortina negra ya no sea visible ni bloquee la pantalla
    await this.cookieDarkFilter.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
    await this.cookieDarkFilter.first().waitFor({ state: 'detached', timeout: 2000 }).catch(() => { });
  }

  async waitForFlights(): Promise<void> {
    // 1. Esperar que desaparezcan posibles skeletons o loaders de vuelos
    await this.page.locator('.flight-skeleton, .spinner, ngx-spinner, #loader').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });

    // 2. Esperar directamente a que el primer vuelo esté visible en el DOM (sin trabarse en skeletons)
    await expect(this.flightCards.first()).toBeVisible({ timeout: 35000 });

    // 3. Esperar dinámicamente a que el listado cargue los vuelos completos (dar margen al 5to vuelo)
    await this.flightCards.nth(4).waitFor({ state: 'visible', timeout: 8000 }).catch(() => { });
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Selecciona el quinto vuelo disponible (índice 4) y asegura la apertura de los bundles.
   */
  async selectFirstFlight(): Promise<void> {
    // 1. Descartar cookies y esperar a que la cortina negra desaparezca totalmente
    await this.dismissCookies();
    // 2. Esperar que los vuelos terminen de renderizarse en el DOM
    await this.waitForFlights();
    await this.dismissCookies();

    // Seleccionar el 5to vuelo disponible (índice 4 en base 0) o el último si hay menos de 5
    const count = await this.flightCards.count();
    const targetFlight = count >= 5 ? this.flightCards.nth(4) : this.flightCards.last();

    await this.smoothScroll(targetFlight, 500);

    // Indicador exacto de que el panel de bundles se abrió
    const bundlePriceIndicator = this.page
      .locator('button.ff-price-container, [data-testid*="ff-price-container"]')
      .first();

    // Bucle resiliente: hace clic en el 5to vuelo hasta que el bundle sea visible
    await expect(async () => {
      await this.dismissCookies();
      if (!(await bundlePriceIndicator.isVisible())) {
        await targetFlight.scrollIntoViewIfNeeded();
        await targetFlight.click({ force: true });
      }
      await expect(bundlePriceIndicator).toBeVisible({ timeout: 3000 });
    }).toPass({
      intervals: [500, 1000, 2000],
      timeout: 25000,
    });
  }

  /**
   * Selecciona la cabina y el bundle según el valor del Excel (ej. "Eco Basic", "Bus Flex").
   */
  async selectBundle(bundle: string): Promise<void> {
    const [cabinKey, bundleName] = bundle.split(' ') as [string, string];
    const bundleUpper = bundleName.toUpperCase() as 'BASIC' | 'CLASSIC' | 'FLEX';

    // ── Selección de cabina ────────────────────────────────────────────────
    if (cabinKey === 'Bus') {
      const busTab = this.page.locator(CABIN_TAB.Bus);
      await expect(busTab).toBeVisible({ timeout: 5000 });
      await this.smoothScroll(busTab, 300);
      await busTab.click({ force: true });
      await this.page.waitForTimeout(400);
    } else {
      const ecoTab = this.page.getByText(CABIN_TAB.Eco, { exact: true });
      if (await ecoTab.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.smoothScroll(ecoTab, 200);
        await ecoTab.click({ force: true });
        await this.page.waitForTimeout(200);
      }
    }

    // ── Clic en el botón de precio del Bundle ──────────────────────────────
    const priceTestId = cabinKey === 'Bus'
      ? `ff-price-container-BC ${bundleUpper}`
      : `ff-price-container-${bundleUpper}`;

    const priceBtn = this.page.getByTestId(priceTestId).first();

    await expect(priceBtn).toBeVisible({ timeout: 15000 });
    await this.smoothScroll(priceBtn, 400);
    await priceBtn.click({ force: true });

    // ── Modal CRO #FB1375 (Upsell para Basic y Classic) ────────────────────
    if (cabinKey !== 'Bus' && (bundleUpper === 'BASIC' || bundleUpper === 'CLASSIC')) {
      await this.page.waitForTimeout(1000);

      const mainBtn = this.page.locator('#FB1375 .cro-no-accept-upsell-button, .cro-no-accept-upsell-button').first();
      if (await mainBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.smoothScroll(mainBtn, 300);
        await mainBtn.click({ force: true });
      } else {
        for (const frame of this.page.frames()) {
          const frameBtn = frame.locator('.cro-no-accept-upsell-button').first();
          if (await frameBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await this.smoothScroll(frameBtn, 200);
            await frameBtn.click({ force: true });
            break;
          }
        }
      }
    }

    // Esperar navegación al Trip Summary (Soporta /booking/trip y /demo-booking/trip)
    await this.page.waitForURL(/.*\/trip/, { timeout: 25000 });
  }
}