import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Resumen de viaje (página intermedia entre Step 1 y Step 2)
 * URL: /av/booking/trip o /av/demo-booking/trip
 */
export class TripSummaryPage extends BasePage {
  private readonly continueBtn: Locator;
  private readonly lateLoginContinueBtn: Locator;

  constructor(page: Page) {
    super(page);
    // Botón principal de la página Trip Summary
    this.continueBtn = page.locator(
      'button.btn-primary-black, button:has-text("Continue"), [data-testid="trip-summary-continue-button"]'
    ).first();

    // Apuntar estrictamente a la etiqueta <button> nativa interna para que Angular procese el evento
    this.lateLoginContinueBtn = page
      .getByRole('button', { name: /Continue without signing in/i })
      .or(page.locator('button[data-testid="late-login-continue"]'))
      .first();
  }

  async waitForPage(): Promise<void> {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: /Trip summary|Resumen/i }).first()
    ).toBeVisible({ timeout: 15000 });
  }

  async continue(): Promise<void> {
    // 1. Clic en el botón principal de Continuar del Trip Summary
    await expect(this.continueBtn).toBeVisible({ timeout: 15000 });
    await this.continueBtn.scrollIntoViewIfNeeded();
    await this.continueBtn.click();

    // 2. Esperar que el modal de Late Login aparezca y termine su animación
    await expect(this.lateLoginContinueBtn).toBeVisible({ timeout: 10000 });
    await this.lateLoginContinueBtn.scrollIntoViewIfNeeded();

    // Clic natural (sin force: true para respetar la estabilidad de la animación)
    await this.lateLoginContinueBtn.click();

    // 3. Esperar que navegue exitosamente al paso de pasajeros (Travelers)
    await this.page.waitForURL(/.*\/travelers/, { timeout: 25000 });
  }
}