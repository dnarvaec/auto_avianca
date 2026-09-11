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
      'button.btn-primary-black, button:has-text("Continue"), button:has-text("Continuar"), [data-testid="trip-summary-continue-button"]'
    ).first();

    // Botón de "Continue without signing in" (Soporta inglés, español y selector testid)
    this.lateLoginContinueBtn = page
      .getByRole('button', { name: /Continue without signing in|Continuar sin iniciar sesión|Continue as guest|Continuar como invitado/i })
      .or(page.locator('button[data-testid="late-login-continue"], [data-testid="late-login-continue"] button'))
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
    await this.smoothScroll(this.continueBtn, 400);
    await this.continueBtn.click();

    // 2. El modal de Late Login es condicional:
    // Esperamos hasta 3.5s; si aparece, hacemos clic. Si no, continuamos hacia /travelers
    const modalAppeared = await this.lateLoginContinueBtn
      .waitFor({ state: 'visible', timeout: 3500 })
      .then(() => true)
      .catch(() => false);

    if (modalAppeared) {
      await this.smoothScroll(this.lateLoginContinueBtn, 300);
      await this.lateLoginContinueBtn.click();
    }

    // 3. Esperar que navegue exitosamente a la página de pasajeros (/travelers)
    await this.page.waitForURL(/.*\/travelers/, { timeout: 25000 });
  }
}