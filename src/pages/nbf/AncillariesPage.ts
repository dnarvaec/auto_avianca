import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 3: Personaliza tu viaje (Ancillaries & Baggage Decision)
 * URL: /av/demo-booking/travelers... (Vista content--ancillaries)
 */
export class AncillariesPage extends BasePage {
  private readonly ancillariesSection: Locator;
  private readonly baggageDecisionNo: Locator;
  private readonly baggageDecisionYes: Locator;
  private readonly goToPaymentBtn: Locator;

  constructor(page: Page) {
    super(page);
    // Contenedor principal de la sección de ancillaries
    this.ancillariesSection = page.locator('.content--ancillaries, baggage-decision-section, optional-services-container');

    // Radios de decisión de equipaje
    this.baggageDecisionNo = page.locator('label[for="no-additional-baggage-radio"]');
    this.baggageDecisionYes = page.locator('label[for="additional-baggage-radio"]');

    // Botón "Go to payment" (soporta estático y sticky footer)
    this.goToPaymentBtn = page.getByRole('button', { name: /Go to payment|Ir a pagar/i })
      .or(page.locator('#continue-btn-footer-static, #continue-btn-footer, [data-testid*="order-continue-btn-footer"]'))
      .first();
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    // Esperar a que la sección de ancillaries esté activa y visible en el DOM
    await expect(this.ancillariesSection.first()).toBeVisible({ timeout: 20000 });
  }

  // ─── Decisión Obligatoria de Equipaje ──────────────────────────────────────

  /**
   * Resuelve el bloque "Do you need more baggage?"
   * @param needBaggage false para marcar "No, I have what I need" (por defecto)
   */
  async handleBaggageDecision(needBaggage = false): Promise<void> {
    const targetLabel = needBaggage ? this.baggageDecisionYes : this.baggageDecisionNo;

    if (await targetLabel.isVisible({ timeout: 6000 }).catch(() => false)) {
      await targetLabel.scrollIntoViewIfNeeded();
      await targetLabel.click();
      await this.page.waitForTimeout(300);
    }
  }

  // ─── Flujo Principal de Ancillaries ────────────────────────────────────────

  async handleAncillaries(flags: {
    Asiento: string;
    'Equipaje Adic': string;
    'Sala VIP': string;
    'Equipaje Deportivo': string;
    'Asistencia Viaje': string;
    'Abordaje Prioritario': string;
  }): Promise<void> {
    await this.waitForPage();

    const yes = (v?: string) => String(v ?? '').toLowerCase() === 'si';

    // 1. Paso Obligatorio: "Do you need more baggage?"
    await this.handleBaggageDecision(yes(flags['Equipaje Adic']));

    // 2. Selección condicional según el Excel
    if (yes(flags.Asiento)) await this.selectSeat();
    if (yes(flags['Equipaje Adic'])) await this.selectBaggage();
    if (yes(flags['Sala VIP'])) await this.selectVipLounge();
    if (yes(flags['Equipaje Deportivo'])) await this.selectSportsEquipment();
    if (yes(flags['Asistencia Viaje'])) await this.selectTravelAssistance();
    if (yes(flags['Abordaje Prioritario'])) await this.selectPriorityBoarding();
  }

  // ─── Navegación al Pago ────────────────────────────────────────────────────

  async goToPayment(): Promise<void> {
    await expect(this.goToPaymentBtn).toBeVisible({ timeout: 10000 });
    await this.goToPaymentBtn.scrollIntoViewIfNeeded();
    await this.goToPaymentBtn.click();

    // Esperar navegación hacia la pantalla de checkout / payment
    await this.page.waitForURL(/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i, {
      timeout: 45000,
      waitUntil: 'commit'
    });
  }

  // ─── Ancillaries Específicas ───────────────────────────────────────────────

  private async selectSeat(): Promise<void> {
    await this.openAncillaryCard('SEAT');
    const availableSeat = this.page.getByRole('button', { name: /Seat number/i }).first();
    if (await availableSeat.isVisible({ timeout: 8000 }).catch(() => false)) {
      await availableSeat.click();
      await this.page.waitForTimeout(300);
    }
    const saveBtn = this.page.getByRole('button', { name: /Save and exit|Guardar y salir|Confirm/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
    }
    await this.waitForPage();
  }

  private async selectBaggage(): Promise<void> {
    await this.openAncillaryCard('BAG');
    const increaseBtns = this.page.getByRole('button', { name: /Increase number of bags/i });
    const count = await increaseBtns.count();
    for (let i = 0; i < count; i++) {
      await increaseBtns.nth(i).click();
      await this.page.waitForTimeout(200);
    }
    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectVipLounge(): Promise<void> {
    await this.openAncillaryCard('VIPD');
    const selectAll = this.page.getByRole('checkbox', { name: /Select all passengers|Seleccionar todos/i }).first();
    if (await selectAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAll.check();
      await this.page.waitForTimeout(300);
    }
    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectSportsEquipment(): Promise<void> {
    await this.openAncillaryCard('SPEQ');
    let idx = 0;
    while (true) {
      const bagEl = this.page.getByTestId(`bag-element-0-${idx}`);
      if (!(await bagEl.isVisible({ timeout: 1000 }).catch(() => false))) break;
      await bagEl.getByRole('button', { name: /Increase number of pieces/i }).click();
      await this.page.waitForTimeout(200);
      idx++;
    }
    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectTravelAssistance(): Promise<void> {
    await this.openAncillaryCard('ASST');
    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectPriorityBoarding(): Promise<void> {
    await this.openAncillaryCard('PBRD');
    const selectAll = this.page.getByRole('checkbox', { name: /Select all passengers|Seleccionar todos/i }).first();
    if (await selectAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAll.check();
      await this.page.waitForTimeout(300);
    }
    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  // ─── Helpers Privados ──────────────────────────────────────────────────────

  /**
   * Abre la tarjeta de servicio haciendo clic directamente en su <mat-card>
   */
  private async openAncillaryCard(cardCode: string): Promise<void> {
    const card = this.page.locator('mat-card.service-card').filter({
      has: this.page.locator(`.img-container.${cardCode}, [class*="${cardCode}"]`),
    }).first();

    await expect(card).toBeVisible({ timeout: 8000 });
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await this.page.waitForTimeout(500);
  }

  private async confirmAncillaryModal(): Promise<void> {
    const confirmBtn = this.page.getByRole('button', { name: /Confirm|Save|Guardar|Continuar/i })
      .or(this.page.getByTestId('nbf-button'))
      .first();

    if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirmBtn.click();
    }
  }
}