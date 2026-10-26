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

// Según la ruta, la tarifa básica de Economy se publica como BASIC o LIGHT
const ECO_FARE_ALIASES: Record<string, string[]> = {
  BASIC: ['BASIC', 'LIGHT'],
};

function ecoPriceTestIds(bundleName: string): string[] {
  const upper = bundleName.toUpperCase();
  return (ECO_FARE_ALIASES[upper] ?? [upper]).map(name => `ff-price-container-${name}`);
}

export class AvailabilityPage extends BasePage {
  // ─── Locators ──────────────────────────────────────────────────────────────
  private readonly cookieAcceptBtn: Locator;
  private readonly cookieDarkFilter: Locator;
  private readonly flightCards: Locator;
  private selectedFlightPanel?: Locator;

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
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Selecciona el primer vuelo que ofrece la cabina requerida por el bundle:
   * "Eco ..." → basta con la tarifa Economy; "Bus ..." → exige Business habilitada.
   * Sin bundle se exige Economy y Business (comportamiento anterior).
   */
  async selectFirstFlight(bundle?: string): Promise<void> {
    // 1. Descartar cookies y esperar a que la cortina negra desaparezca totalmente
    await this.dismissCookies();
    // 2. Esperar que los vuelos terminen de renderizarse en el DOM
    await this.waitForFlights();
    await this.dismissCookies();

    await this.selectFlightForBundle(this.flightCards, 'ida', bundle);
  }

  /**
   * Selecciona la cabina y el bundle según el valor del Excel (ej. "Eco Basic", "Bus Flex").
   * Si isRoundTrip es true, ejecuta la selección tanto para la Ida como para el Regreso.
   */
  async selectBundle(bundle: string, isRoundTrip = false): Promise<void> {
    // ── 1. Seleccionar bundle del vuelo de Ida ─────────────────────────────
    await this.chooseBundlePrice(bundle);
    await this.handleCroModal(bundle);

    // ── 2. Si es Round Trip, seleccionar vuelo y bundle de regreso ─────────
    if (isRoundTrip) {
      console.log('ℹ️ [Availability] Round Trip detectado: Procediendo a seleccionar vuelo y bundle de regreso...');
      await this.selectReturnFlight(bundle);
      await this.chooseBundlePrice(bundle);
      await this.handleCroModal(bundle);
    }

    // ── 3. Esperar navegación al Trip Summary (Soporta /booking/trip y /demo-booking/trip)
    await this.page.waitForURL(/.*\/trip/, { timeout: 25000 });
  }

  // ─── Helpers Privados para Round Trip y Bundles ────────────────────────────

  private async selectFlightForBundle(cards: Locator, segment: string, bundle?: string): Promise<void> {
    this.selectedFlightPanel = undefined;
    const [cabinKey, bundleName] = (bundle ?? '').trim().split(/\s+/);
    const requirement: 'eco' | 'bus' | 'both' =
      cabinKey === 'Bus' ? 'bus' : cabinKey === 'Eco' && bundleName ? 'eco' : 'both';
    const ecoPriceSelector = ecoPriceTestIds(bundleName ?? '')
      .map(id => `[data-testid="${id}"]`).join(', ');
    const requirementLabel = {
      eco: `la tarifa Economy ${bundleName ?? ''}`.trim(),
      bus: 'Business habilitada',
      both: 'Economy y Business habilitadas',
    }[requirement];

    const visibleCards = cards.and(this.page.locator(':visible'));
    await expect(visibleCards.first()).toBeVisible({ timeout: 35000 });
    await expect(this.page.locator('nbf-skeleton-block:visible')).toHaveCount(0, { timeout: 35000 });
    const count = await visibleCards.count();

    for (let index = 0; index < count; index++) {
      const card = visibleCards.nth(index);
      if (!(await card.isEnabled())) continue;

      await this.smoothScroll(card, 300);
      const panel = card.locator('xpath=ancestor::expander-elem[1]');
      const priceTrigger = card.locator('button.avail-price__container')
        .and(this.page.locator(':visible')).first();
      const prices = panel.locator('button.ff-price-container, [data-testid*="ff-price-container"]')
        .and(this.page.locator(':visible'));
      await expect(async () => {
        if (!(await prices.first().isVisible())) {
          await this.dismissCookies();
          await priceTrigger.click();
        }
        await expect(prices.first()).toBeVisible({ timeout: 3000 });
      }).toPass({ intervals: [500, 1000, 2000], timeout: 25000 });

      const economy = panel.getByText(CABIN_TAB.Eco, { exact: true })
        .and(this.page.locator(':visible')).first();
      const business = panel.locator(CABIN_TAB.Bus)
        .and(this.page.locator(':visible')).first();

      const businessOk = await business.isVisible() && await business.isEnabled();
      let matches: boolean;
      if (requirement === 'bus') {
        matches = businessOk;
      } else if (requirement === 'eco') {
        // Vuelos solo-Economy no muestran pestañas: basta con que exista el precio del bundle
        const ecoPrice = panel.locator(ecoPriceSelector).and(this.page.locator(':visible')).first();
        matches = await ecoPrice.isVisible() && await ecoPrice.isEnabled();
      } else {
        matches = await economy.isVisible() && await economy.isEnabled() && businessOk;
      }

      if (matches) {
        this.selectedFlightPanel = panel;
        console.log(`[Availability] Vuelo de ${segment} ${index + 1}/${count}: ofrece ${requirementLabel}.`);
        return;
      }
    }

    throw new Error(
      `[Availability] Ninguno de los ${count} vuelos de ${segment} ofrece ${requirementLabel}.`
    );
  }

  /**
   * Clic en la cabina y el botón de precio del Bundle
   */
  private async chooseBundlePrice(bundle: string): Promise<void> {
    const panel = this.selectedFlightPanel;
    if (!panel) {
      throw new Error('[Availability] Debe seleccionar un vuelo antes de elegir el bundle.');
    }
    const [cabinKey, bundleName] = bundle.split(' ') as [string, string];
    const bundleUpper = bundleName.toUpperCase() as 'BASIC' | 'CLASSIC' | 'FLEX';

    // ── Selección de cabina ────────────────────────────────────────────────
    if (cabinKey === 'Bus') {
      const busTab = panel.locator(CABIN_TAB.Bus).first();
      if (await busTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.smoothScroll(busTab, 300);
        await busTab.click({ force: true });
        await this.page.waitForTimeout(400);
      }
    } else {
      const ecoTab = panel.getByText(CABIN_TAB.Eco, { exact: true }).first();
      if (await ecoTab.isVisible({ timeout: 1500 }).catch(() => false)) {
        await this.smoothScroll(ecoTab, 200);
        await ecoTab.click({ force: true });
        await this.page.waitForTimeout(200);
      }
    }

    // ── Clic en el botón de precio del Bundle ──────────────────────────────
    const priceSelector = cabinKey === 'Bus'
      ? `[data-testid="ff-price-container-BC ${bundleUpper}"]`
      : ecoPriceTestIds(bundleUpper).map(id => `[data-testid="${id}"]`).join(', ');

    // Buscamos el botón de precio visible
    const priceBtn = panel.locator(priceSelector).and(this.page.locator(':visible')).first();

    await expect(priceBtn).toBeVisible({ timeout: 15000 });
    await this.smoothScroll(priceBtn, 400);
    await priceBtn.click({ force: true });
  }

  /**
   * Manejo del Modal CRO #FB1375 (Upsell para Basic y Classic)
   */
  private async handleCroModal(bundle: string): Promise<void> {
    const [cabinKey, bundleName] = bundle.split(' ') as [string, string];
    const bundleUpper = bundleName.toUpperCase();

    if (cabinKey !== 'Bus' && (bundleUpper === 'BASIC' || bundleUpper === 'CLASSIC')) {
      await this.page.waitForTimeout(1000);

      const mainBtn = this.page.locator('#FB1375 .cro-no-accept-upsell-button, .cro-no-accept-upsell-button').first();
      if (await mainBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
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
  }

  /**
   * Selecciona un vuelo de regreso que ofrezca la cabina requerida por el bundle.
   */
  private async selectReturnFlight(bundle: string): Promise<void> {
    // 1. Esperar que la lista de vuelos de regreso esté disponible y sin loaders
    await this.page.locator('.flight-skeleton, .spinner, ngx-spinner, #loader').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    await this.page.waitForTimeout(800);

    // 2. Identificar el contenedor de vuelos de regreso o los vuelos que no estén seleccionados/colapsados
    const inboundContainer = this.page.locator(
      '.bound-container:nth-of-type(2), [data-testid="bound-1"], .bound--inbound, .inbound-section'
    ).first();

    const returnCards = (await inboundContainer.isVisible({ timeout: 3000 }).catch(() => false))
      ? inboundContainer.locator('button.flight-container')
      : this.page.locator('button.flight-container:visible:not(.selected)');

    await this.selectFlightForBundle(returnCards, 'regreso', bundle);
  }
}