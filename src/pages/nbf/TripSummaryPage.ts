import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Resumen de viaje (página intermedia entre Step 1 y Step 2)
 * URL: /av/booking/trip
 *
 * Selectores validados en exploración en vivo el 2026-07-21.
 */
export class TripSummaryPage extends BasePage {
  private readonly continueBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.continueBtn = page.locator('button.btn-primary-black');
  }

  async waitForPage(): Promise<void> {
    await expect(this.page.locator('h1, h2').filter({ hasText: 'Trip summary' })).toBeVisible({ timeout: 10000 });
  }

  async continue(): Promise<void> {
    await this.continueBtn.click();
    await this.page.waitForURL('**/booking/travelers**', { timeout: 20000 });
  }
}
