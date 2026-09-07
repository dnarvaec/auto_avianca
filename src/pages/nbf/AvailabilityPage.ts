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
  private readonly flightCards: Locator;

  constructor(page: Page) {
    super(page);
    this.cookieAcceptBtn = page.locator(
      '#onetrust-accept-btn-handler, button:has-text("Allow all"), button:has-text("Accept"), button:has-text("Aceptar")'
    );
    this.flightCards = page.locator('button.flight-container');
  }

  // ─── Navegación y Cookies ──────────────────────────────────────────────────

  async dismissCookies(): Promise<void> {
    const acceptBtn = this.cookieAcceptBtn.first();
    if (await acceptBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await acceptBtn.click({ force: true }).catch(() => { });
      await this.page.waitForTimeout(200);
    }

    const darkFilter = this.page.locator('.onetrust-pc-dark-filter, #onetrust-banner-sdk');
    if (await darkFilter.isVisible({ timeout: 1500 }).catch(() => false)) {
      await darkFilter.evaluate(el => el.remove()).catch(() => { });
    }
  }

  async waitForFlights(): Promise<void> {
    // Esperar directamente a que el primer vuelo esté visible en el DOM (sin trabarse en skeletons)
    await expect(this.flightCards.first()).toBeVisible({ timeout: 35000 });
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Selecciona el primer vuelo disponible y asegura la apertura de los bundles.
   */
  async selectFirstFlight(): Promise<void> {
    await this.dismissCookies();
    await this.waitForFlights();

    const firstFlight = this.flightCards.first();
    await firstFlight.scrollIntoViewIfNeeded();

    // Indicador exacto de que el panel de bundles se abrió
    const bundlePriceIndicator = this.page
      .locator('button.ff-price-container, [data-testid*="ff-price-container"]')
      .first();

    // Bucle resiliente: hace clic en la tarjeta del vuelo hasta que el bundle sea visible
    await expect(async () => {
      if (!(await bundlePriceIndicator.isVisible())) {
        await firstFlight.click();
      }
      await expect(bundlePriceIndicator).toBeVisible({ timeout: 3000 });
    }).toPass({
      intervals: [500, 1000, 2000],
      timeout: 20000,
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
      await busTab.click({ force: true });
      await this.page.waitForTimeout(400);
    } else {
      const ecoTab = this.page.getByText(CABIN_TAB.Eco, { exact: true });
      if (await ecoTab.isVisible({ timeout: 1500 }).catch(() => false)) {
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
    await priceBtn.scrollIntoViewIfNeeded();
    await priceBtn.click({ force: true });

    // ── Modal CRO #FB1375 (Upsell para Basic y Classic) ────────────────────
    if (cabinKey !== 'Bus' && (bundleUpper === 'BASIC' || bundleUpper === 'CLASSIC')) {
      await this.page.waitForTimeout(1000);

      const mainBtn = this.page.locator('#FB1375 .cro-no-accept-upsell-button, .cro-no-accept-upsell-button').first();
      if (await mainBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mainBtn.click({ force: true });
      } else {
        for (const frame of this.page.frames()) {
          const frameBtn = frame.locator('.cro-no-accept-upsell-button').first();
          if (await frameBtn.isVisible({ timeout: 500 }).catch(() => false)) {
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