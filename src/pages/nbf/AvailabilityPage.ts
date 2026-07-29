import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 1: Selección de vuelo y bundle
 * URL: /av/booking/avail
 *
 * Selectores validados con codegen el 2026-07-27.
 */

/** Selector del tab de cabina — validados con codegen el 2026-07-27 */
const CABIN_TAB: Record<string, string> = {
  Eco: 'Economy',                          // getByText('Economy', { exact: true })
  Bus: '[data-testid="business-tab"]',
};

/** Mapeo de nombre bundle Excel → texto del encabezado en UI */
const BUNDLE_TITLE_MAP: Record<string, string> = {
  Basic: 'Basic',
  Classic: 'Classic',
  Flex: 'Flex',
};

export class AvailabilityPage extends BasePage {
  // ─── Locators ──────────────────────────────────────────────────────────────
  private readonly cookieAcceptBtn: Locator;
  private readonly flightCards: Locator;
  private readonly bundleCards: Locator;

  constructor(page: Page) {
    super(page);
    this.cookieAcceptBtn  = page.locator('button:has-text("Accept")');
    this.flightCards      = page.locator('button.flight-container');
    // Excluir las ff-cards ocultas (clase ocultar-FBX) que existen en el DOM
    // para todos los vuelos aunque no estén expandidos
    this.bundleCards      = page.locator('[class*="ff-card"]:not([class*="ocultar"])');
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async dismissCookies(): Promise<void> {
    // 1. Aceptar el banner principal de cookies
    const acceptBtn = this.page.locator(
      '#onetrust-accept-btn-handler, button:has-text("Allow all"), button:has-text("Accept")'
    ).first();
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click();
      await this.page.waitForTimeout(300);
    }

    // 2. Cerrar el panel de preferencias OneTrust si está abierto
    // (su overlay .onetrust-pc-dark-filter bloquea todos los clics de la página)
    const darkFilter = this.page.locator('.onetrust-pc-dark-filter');
    if (await darkFilter.isVisible({ timeout: 1000 }).catch(() => false)) {
      const closeBtn = this.page
        .locator('#close-pc-btn-handler, .onetrust-close-btn-handler')
        .first();
      if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeBtn.click({ force: true });
      } else {
        await this.page
          .locator('.save-preference-btn-handler')
          .first()
          .click({ force: true })
          .catch(() => {});
      }
      // Esperar que el overlay desaparezca
      await darkFilter.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }

  async waitForFlights(): Promise<void> {
    await expect(this.flightCards.first()).toBeVisible({ timeout: 15000 });
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Selecciona el primer vuelo disponible y muestra el panel de bundles.
   * La URL ya pre-carga fecha y ruta, por lo que siempre tomamos el primero.
   */
  async selectFirstFlight(): Promise<void> {
    // Asegurarse de que no haya ningún overlay de cookies antes de hacer clic
    await this.dismissCookies();
    await this.flightCards.nth(0).scrollIntoViewIfNeeded();
    await this.flightCards.nth(0).click();
    // Esperar un botón de precio visible dentro de una ff-card NO oculta.
    // Sin este scope, el locator resuelve botones hidden de vuelos no expandidos
    // y toBeVisible() falla de forma intermitente aunque el panel ya esté abierto.
    await expect(this.bundleCards.locator('button.ff-price-container').first()).toBeVisible({ timeout: 10000 });
  }

  /**
   * Selecciona la cabina y el bundle según el valor del Excel.
   * @param bundle Valor de la columna "Bundle" — ej. "Eco Basic", "Bus Flex"
   *
   * Comportamiento validado con codegen el 2026-07-27:
   *   - Economy: clic en tab por texto "Economy"
   *   - Basic/Classic/Flex: data-testid ff-price-container-{BUNDLE} (independiente de moneda)
   *   - Business: data-testid con prefijo "BC"
   */
  async selectBundle(bundle: string): Promise<void> {
    const [cabinKey, bundleName] = bundle.split(' ') as [string, string];
    const bundleUpper = bundleName.toUpperCase() as 'BASIC' | 'CLASSIC' | 'FLEX';

    // ── Selección de cabina ────────────────────────────────────────────────
    if (cabinKey === 'Bus') {
      await this.page.locator(CABIN_TAB.Bus).click();
      await this.page.waitForTimeout(500);
    } else {
      // Economy: tab seleccionable por texto (el atributo .eco-tab fue eliminado)
      await this.page.getByText(CABIN_TAB.Eco, { exact: true }).click();
      await this.page.waitForTimeout(300);
    }

    // ── Clic en el botón de precio ─────────────────────────────────────────
    // Todos los bundles usan data-testid — es estable e independiente de la moneda.
    // Economy:  ff-price-container-BASIC / CLASSIC / FLEX
    // Business: ff-price-container-BC CLASSIC / BC FLEX
    const priceTestId = cabinKey === 'Bus'
      ? `ff-price-container-BC ${bundleUpper}`
      : `ff-price-container-${bundleUpper}`;

    const priceBtn = this.bundleCards.getByTestId(priceTestId);
    await priceBtn.scrollIntoViewIfNeeded();
    await priceBtn.click({ force: true });

    // Modal CRO #FB1375 — aparece para Basic y Classic tras elegir el bundle.
    // Algunas herramientas CRO inyectan el modal dentro de un iframe.
    // Se busca primero en el frame principal y luego en todos los iframes.
    if (cabinKey !== 'Bus' && (bundleUpper === 'BASIC' || bundleUpper === 'CLASSIC')) {
      await this.page.waitForTimeout(1500); // dar tiempo al modal CRO para renderizar

      const mainBtn = this.page.locator('#FB1375 .cro-no-accept-upsell-button');
      if (await mainBtn.count() > 0) {
        await mainBtn.click({ force: true });
      } else {
        // Fallback: el modal está dentro de un iframe del CRO tool
        for (const frame of this.page.frames()) {
          const frameBtn = frame.locator('.cro-no-accept-upsell-button');
          if (await frameBtn.count() > 0) {
            await frameBtn.click({ force: true });
            break;
          }
        }
      }
    }

    // Esperar navegación al Trip Summary
    await this.page.waitForURL('**/booking/trip**', { timeout: 25000 });
  }
}
