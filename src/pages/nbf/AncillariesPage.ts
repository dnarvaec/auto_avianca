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
    this.ancillariesSection = page.locator('.content--ancillaries, baggage-decision-section, optional-services-container');

    // Radios de decisión condicional de equipaje
    this.baggageDecisionNo = page.locator(
      'label[for="no-additional-baggage-radio"], label:has(#no-additional-baggage-radio), label:has-text("No, I have what I need"), label:has-text("No necesito")'
    ).first();

    this.baggageDecisionYes = page.locator(
      'label[for="additional-baggage-radio"], label:has(#additional-baggage-radio), label:has-text("Yes, I want"), label:has-text("Sí, quiero")'
    ).first();

    // Botón "Go to payment" (soporta estático y sticky footer)
    this.goToPaymentBtn = page.locator(
      '#continue-btn-footer, #continue-btn-footer-static, [data-testid*="order-continue-btn-footer"], button:has-text("Go to payment"), button:has-text("Ir a pagar")'
    ).and(page.locator(':visible')).first();
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await expect(this.ancillariesSection.first()).toBeVisible({ timeout: 25000 });
  }

  // ─── Decisión Condicional de Equipaje ──────────────────────────────────────

  async handleBaggageDecision(needBaggage = false): Promise<void> {
    const targetLabel = needBaggage ? this.baggageDecisionYes : this.baggageDecisionNo;

    const isPresent = await targetLabel
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (isPresent) {
      await this.smoothScroll(targetLabel, 350);
      await targetLabel.click();
      await this.page.waitForTimeout(400);
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

    const yes = (v?: string) => String(v ?? '').trim().toLowerCase() === 'si';

    // 1. Resolver decisión inicial de equipaje (si está presente)
    await this.handleBaggageDecision(yes(flags['Equipaje Adic']));

    // 2. Selección de ancillaries según flags del Excel
    if (yes(flags.Asiento)) await this.selectSeat();
    if (yes(flags['Equipaje Adic'])) await this.selectBaggage();
    if (yes(flags['Sala VIP'])) await this.selectVipLounge();
    if (yes(flags['Equipaje Deportivo'])) await this.selectSportsEquipment();
    if (yes(flags['Asistencia Viaje'])) await this.selectTravelAssistance();
    if (yes(flags['Abordaje Prioritario'])) await this.selectPriorityBoarding();
  }

  // ─── Navegación al Pago ────────────────────────────────────────────────────

  async goToPayment(): Promise<void> {
    const activePaymentBtn = this.goToPaymentBtn;
    await expect(activePaymentBtn).toBeVisible({ timeout: 15000 });
    await this.smoothScroll(activePaymentBtn, 500);

    // Bucle resiliente para disparar la pasarela de pagos
    await expect(async () => {
      const currentUrl = this.page.url();
      if (/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i.test(currentUrl)) {
        return;
      }
      if (await activePaymentBtn.isVisible()) {
        await activePaymentBtn.click({ force: true });
      }
      await this.page.waitForURL(/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i, { timeout: 4000 });
    }).toPass({
      intervals: [1000, 2000, 3000],
      timeout: 45000,
    });
  }

  // ─── Ancillaries Específicas ───────────────────────────────────────────────

  /**
   * Selección y guardado de asiento con confirmación de popover y footer
   */
  private async selectSeat(): Promise<void> {
    const opened = await this.openAncillaryCard('SEAT', ['Choose your seat', 'Seat', 'Asiento']);
    if (!opened) return;

    // 1. Esperar mapa de asientos
    const seatMap = this.page.locator(
      'seat-map, app-seatmap, .seat-map-container, mat-dialog-container, [data-testid*="seatmap"], .seat-map'
    ).first();
    await seatMap.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });
    await this.page.waitForTimeout(800);

    // 2. Localizar y hacer clic en el primer asiento disponible
    const availableSeat = this.page.locator(
      'button.seat--available, button.seat-available, button[data-testid*="seat-item"]:not([disabled]), button[aria-label*="Seat" i]:not([disabled]), button[aria-label*="Asiento" i]:not([disabled]), button.seat:not(.seat--occupied):not(.seat--disabled):not([disabled])'
    ).first();

    if (await availableSeat.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(availableSeat, 300);
      await availableSeat.click({ force: true });
      await this.page.waitForTimeout(500);

      // Si aparece popover individual ("Select seat" / "Seleccionar asiento")
      const popoverSelectBtn = this.page.locator(
        '.seat-popover button, .seat-tooltip button, button:has-text("Select seat"), button:has-text("Seleccionar asiento"), button:has-text("Add seat")'
      ).first();
      if (await popoverSelectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await popoverSelectBtn.click({ force: true });
        await this.page.waitForTimeout(400);
      }
    }

    // 3. Confirmar y guardar el asiento en el botón principal
    const saveSeatBtn = this.page.locator(
      'button[data-testid*="seatmap-save"], button[data-testid*="seat-map-confirm"], button[data-testid*="confirm"], button.seatmap-footer__confirm, button.btn-primary-black, button:has-text("Save and exit"), button:has-text("Guardar y salir"), button:has-text("Save and continue"), button:has-text("Save"), button:has-text("Guardar"), button:has-text("Confirm"), button:has-text("Confirmar")'
    ).and(this.page.locator(':visible')).first();

    if (await saveSeatBtn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(saveSeatBtn, 300);
      await saveSeatBtn.click({ force: true });
      // Esperar que el modal cierre
      await this.page.locator('.cdk-overlay-backdrop, mat-dialog-container, seat-map').first().waitFor({ state: 'hidden', timeout: 6000 }).catch(() => { });
    }

    await this.waitForPage();
  }

  private async selectBaggage(): Promise<void> {
    const opened = await this.openAncillaryCard('BAG', ['Additional baggage', 'Equipaje adicional']);
    if (!opened) return;

    const modal = this.page.locator('mat-dialog-container, .modal-content, [role="dialog"]').first();
    await modal.waitFor({ state: 'visible', timeout: 4000 }).catch(() => { });

    const increaseBtn = this.page.getByRole('button', { name: /Increase number of bags|Aumentar/i })
      .or(this.page.locator('button.btn-quantity--plus, button[aria-label*="increase" i], button[data-testid*="increase"]'))
      .first();

    if (await increaseBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(increaseBtn, 200);
      await increaseBtn.click({ timeout: 2000 }).catch(() => { });
      await this.page.waitForTimeout(300);
    }

    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectVipLounge(): Promise<void> {
    const opened = await this.openAncillaryCard('VIPD', ['avianca VIP lounges', 'VIP Lounge', 'Sala VIP']);
    if (!opened) return;

    const selectAll = this.page.getByRole('checkbox', { name: /Select all passengers|Seleccionar todos/i })
      .or(this.page.locator('mat-checkbox.select-all, mat-checkbox:has-text("Select all")'))
      .first();

    if (await selectAll.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(selectAll, 250);
      await selectAll.check().catch(() => selectAll.click({ force: true }));
      await this.page.waitForTimeout(300);
    }

    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectSportsEquipment(): Promise<void> {
    const opened = await this.openAncillaryCard('SPEQ', ['Sports equipment', 'Equipaje deportivo']);
    if (!opened) return;

    let idx = 0;
    while (true) {
      const bagEl = this.page.getByTestId(`bag-element-0-${idx}`);
      if (!(await bagEl.isVisible({ timeout: 1000 }).catch(() => false))) break;
      await this.smoothScroll(bagEl, 200);
      await bagEl.getByRole('button', { name: /Increase number of pieces/i }).click();
      await this.page.waitForTimeout(200);
      idx++;
    }

    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectTravelAssistance(): Promise<void> {
    const opened = await this.openAncillaryCard('ASST', ['Travel assistance', 'Asistencia de viaje']);
    if (!opened) return;

    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectPriorityBoarding(): Promise<void> {
    const opened = await this.openAncillaryCard('PBRD', ['Priority boarding', 'Abordaje prioritario']);
    if (!opened) return;

    const selectAll = this.page.getByRole('checkbox', { name: /Select all passengers|Seleccionar todos/i })
      .or(this.page.locator('mat-checkbox.select-all, mat-checkbox:has-text("Select all")'))
      .first();

    if (await selectAll.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(selectAll, 250);
      await selectAll.check().catch(() => selectAll.click({ force: true }));
      await this.page.waitForTimeout(300);
    }

    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  // ─── Helpers Privados ──────────────────────────────────────────────────────

  private async openAncillaryCard(cardCode: string, fallbackTitles: string[] = []): Promise<boolean> {
    const titleSelectors = fallbackTitles.map(t => `mat-card:has(.title:has-text("${t}"))`).join(', ');
    const cardLocatorStr = `mat-card:has(.img-container.${cardCode}), mat-card:has([class*="${cardCode}"])${titleSelectors ? `, ${titleSelectors}` : ''}`;

    const card = this.page.locator(cardLocatorStr).first();

    const isVisible = await card
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      console.log(`ℹ️ [Ancillaries] Tarjeta '${cardCode}' no disponible para este caso. Se omite.`);
      return false;
    }

    await this.smoothScroll(card, 350);
    await card.click();
    await this.page.waitForTimeout(500);
    return true;
  }

  private async confirmAncillaryModal(): Promise<void> {
    const confirmBtn = this.page.getByRole('button', { name: /Confirm|Save|Guardar|Continuar/i })
      .or(this.page.getByTestId('nbf-button'))
      .and(this.page.locator(':visible'))
      .first();

    const isReady = await confirmBtn.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
    if (isReady) {
      await this.smoothScroll(confirmBtn, 300);
      await confirmBtn.click({ force: true });
      await this.page.locator('.cdk-overlay-backdrop, mat-dialog-container').first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => { });
    }
  }
}