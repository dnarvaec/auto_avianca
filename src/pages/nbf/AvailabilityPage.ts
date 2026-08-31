import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 1: Selección de vuelo y bundle
 * URL: /av/booking/avail
 */

/** Selector del tab de cabina */
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
      '#onetrust-accept-btn-handler, button:has-text("Allow all"), button:has-text("Accept")'
    );
    this.flightCards = page.locator('button.flight-container');
  }

  // ─── Navegación y Helpers ──────────────────────────────────────────────────

  async dismissCookies(): Promise<void> {
    // 1. Aceptar banner de cookies si aparece
    const acceptBtn = this.cookieAcceptBtn.first();
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click().catch(() => { });
      await this.page.waitForTimeout(300);
    }

    // 2. Cerrar panel de preferencias si quedó abierto
    const darkFilter = this.page.locator('.onetrust-pc-dark-filter');
    if (await darkFilter.isVisible({ timeout: 2000 }).catch(() => false)) {
      const closeBtn = this.page
        .locator('#close-pc-btn-handler, .onetrust-close-btn-handler')
        .first();

      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => { });
      } else {
        await this.page
          .locator('.save-preference-btn-handler')
          .first()
          .click({ force: true })
          .catch(() => { });
      }
    }

    // 3. Esperar que todo overlay desaparezca antes de continuar
    await this.page
      .locator('.onetrust-pc-dark-filter, #onetrust-banner-sdk')
      .waitFor({ state: 'hidden', timeout: 5000 })
      .catch(() => { });
  }

  async waitForFlights(): Promise<void> {
    // 1. Esperar que desaparezcan los skeletons o spinners de carga de vuelos
    const loader = this.page.locator('mat-spinner, .avail-loading, [class*="skeleton"], [class*="loading-spinner"]');
    await loader.waitFor({ state: 'hidden', timeout: 35000 }).catch(() => { });

    // 2. Dar hasta 30 segundos al primer vuelo para renderizarse (QA puede ser lento)
    await expect(this.flightCards.first()).toBeVisible({ timeout: 30000 });
  }

  async selectFirstFlight(): Promise<void> {
    await this.dismissCookies();

    // Esperamos formalmente a que la búsqueda de vuelos termine
    await this.waitForFlights();

    const firstFlight = this.flightCards.first();
    await firstFlight.scrollIntoViewIfNeeded();

    const bundlePriceIndicator = this.page
      .locator('button.ff-price-container, [data-testid*="ff-price-container"]')
      .first();

    await expect(async () => {
      if (!(await bundlePriceIndicator.isVisible())) {
        await firstFlight.click({ force: false });
      }
      await expect(bundlePriceIndicator).toBeVisible({ timeout: 3000 });
    }).toPass({
      intervals: [500, 1000, 2000],
      timeout: 15000,
    });
  }

  /**
   * Selecciona la cabina y el bundle según el valor (ej. "Eco Basic", "Bus Flex").
   */
  async selectBundle(bundle: string): Promise<void> {
    const [cabinKey, bundleName] = bundle.split(' ') as [string, string];
    const bundleUpper = bundleName.toUpperCase() as 'BASIC' | 'CLASSIC' | 'FLEX';

    // ── Selección de cabina ────────────────────────────────────────────────
    if (cabinKey === 'Bus') {
      const busTab = this.page.locator(CABIN_TAB.Bus);
      await expect(busTab).toBeVisible({ timeout: 5000 });
      await busTab.click();
      await this.page.waitForTimeout(500);
    } else {
      const ecoTab = this.page.getByText(CABIN_TAB.Eco, { exact: true });
      if (await ecoTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ecoTab.click();
        await this.page.waitForTimeout(300);
      }
    }

    // ── Clic en el botón de precio del Bundle ──────────────────────────────
    const priceTestId = cabinKey === 'Bus'
      ? `ff-price-container-BC ${bundleUpper}`
      : `ff-price-container-${bundleUpper}`;

    // Buscamos directamente por data-testid en la página para evitar restricciones de contenedor
    const priceBtn = this.page.getByTestId(priceTestId).first();
    await expect(priceBtn).toBeVisible({ timeout: 10000 });
    await priceBtn.scrollIntoViewIfNeeded();
    await priceBtn.click({ force: true });

    // ── Modal CRO #FB1375 (Upsell para Basic y Classic) ────────────────────
    if (cabinKey !== 'Bus' && (bundleUpper === 'BASIC' || bundleUpper === 'CLASSIC')) {
      await this.page.waitForTimeout(1500);

      const mainBtn = this.page.locator('#FB1375 .cro-no-accept-upsell-button');
      if (await mainBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await mainBtn.click({ force: true });
      } else {
        // Fallback: Si el modal está dentro de un iframe
        for (const frame of this.page.frames()) {
          const frameBtn = frame.locator('.cro-no-accept-upsell-button');
          if (await frameBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await frameBtn.click({ force: true });
            break;
          }
        }
      }
    }

    // Esperar navegación al Trip Summary
    await this.page.waitForURL(/.*\/trip/, { timeout: 25000 });
  }
}