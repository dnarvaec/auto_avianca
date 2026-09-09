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

    // Radios de decisión condicional / intermitente
    this.baggageDecisionNo = page.locator(
      'label[for="no-additional-baggage-radio"], label:has(#no-additional-baggage-radio), label:has-text("No, I have what I need"), label:has-text("No necesito")'
    ).first();

    this.baggageDecisionYes = page.locator(
      'label[for="additional-baggage-radio"], label:has(#additional-baggage-radio), label:has-text("Yes, I want"), label:has-text("Sí, quiero")'
    ).first();

    // Botón "Go to payment"
    this.goToPaymentBtn = page.getByRole('button', { name: /Go to payment|Ir a pagar/i })
      .or(page.locator('#continue-btn-footer-static, #continue-btn-footer, [data-testid*="order-continue-btn-footer"], button.cart-continue-btn'))
      .first();
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await expect(this.ancillariesSection.first()).toBeVisible({ timeout: 25000 });
  }

  // ─── Decisión Condicional de Equipaje ──────────────────────────────────────

  /**
   * Resuelve el bloque intermitente "Do you need more baggage?".
   * Si no aparece en 3s, continúa hacia las tarjetas de ancillaries.
   */
  async handleBaggageDecision(needBaggage = false): Promise<void> {
    const targetLabel = needBaggage ? this.baggageDecisionYes : this.baggageDecisionNo;

    const isPresent = await targetLabel
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (isPresent) {
      await targetLabel.scrollIntoViewIfNeeded();
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

    // 1. Resolver decisión inicial de equipaje (si está presente en pantalla)
    await this.handleBaggageDecision(yes(flags['Equipaje Adic']));

    // 2. Selección de ancillaries según el Excel
    if (yes(flags.Asiento)) await this.selectSeat();
    if (yes(flags['Equipaje Adic'])) await this.selectBaggage();
    if (yes(flags['Sala VIP'])) await this.selectVipLounge();
    if (yes(flags['Equipaje Deportivo'])) await this.selectSportsEquipment();
    if (yes(flags['Asistencia Viaje'])) await this.selectTravelAssistance();
    if (yes(flags['Abordaje Prioritario'])) await this.selectPriorityBoarding();
  }

  // ─── Navegación al Pago ────────────────────────────────────────────────────

  async goToPayment(): Promise<void> {
    await expect(this.goToPaymentBtn).toBeVisible({ timeout: 15000 });
    await this.goToPaymentBtn.scrollIntoViewIfNeeded();

    // Bucle resiliente: asegura que el clic active la redirección a la pasarela
    await expect(async () => {
      const currentUrl = this.page.url();
      if (/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i.test(currentUrl)) {
        return;
      }
      if (await this.goToPaymentBtn.isVisible()) {
        await this.goToPaymentBtn.click();
      }
      await this.page.waitForURL(/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i, { timeout: 4000 });
    }).toPass({
      intervals: [1000, 2000, 3000],
      timeout: 45000,
    });
  }

  // ─── Ancillaries Específicas ───────────────────────────────────────────────

  private async selectSeat(): Promise<void> {
    const opened = await this.openAncillaryCard('SEAT', ['Seat', 'Asiento']);
    if (!opened) return;

    const availableSeat = this.page.getByRole('button', { name: /Seat number/i }).first();
    if (await availableSeat.isVisible({ timeout: 6000 }).catch(() => false)) {
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
    const opened = await this.openAncillaryCard('BAG', ['Additional baggage', 'Equipaje adicional']);
    if (!opened) return;

    // 1. Esperar que el diálogo/modal abra rápido
    const modal = this.page.locator('mat-dialog-container, .modal-content, [role="dialog"]').first();
    await modal.waitFor({ state: 'visible', timeout: 4000 }).catch(() => { });

    // 2. Buscar únicamente el primer botón de '+' que esté habilitado y visible
    const increaseBtn = this.page.getByRole('button', { name: /Increase number of bags|Aumentar/i })
      .or(this.page.locator('button.btn-quantity--plus, button[aria-label*="increase" i], button[data-testid*="increase"]'))
      .first();

    // Clic con timeout corto (máximo 2s) para no congelar el flujo
    if (await increaseBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await increaseBtn.click({ timeout: 2000 }).catch(() => { });
      await this.page.waitForTimeout(300);
    }

    // 3. Confirmar y cerrar modal
    await this.confirmAncillaryModal();
    await this.waitForPage();
  }

  private async selectVipLounge(): Promise<void> {
    const opened = await this.openAncillaryCard('VIPD', ['VIP Lounge', 'Sala VIP']);
    if (!opened) return;

    const selectAll = this.page.getByRole('checkbox', { name: /Select all passengers|Seleccionar todos/i }).first();
    if (await selectAll.isVisible({ timeout: 3000 }).catch(() => false)) {
      await selectAll.check();
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
   * Abre la tarjeta buscando por clase de icono (.BAG, .SEAT, etc.) o por título de servicio.
   * Espera hasta 10 segundos para dar tiempo a la respuesta del backend.
   */
  private async openAncillaryCard(cardCode: string, fallbackTitles: string[] = []): Promise<boolean> {
    // Construir selector que busque tanto por clase de imagen como por el texto del título
    const titleSelectors = fallbackTitles.map(t => `mat-card:has(.title:has-text("${t}"))`).join(', ');
    const cardLocatorStr = `mat-card:has(.img-container.${cardCode}), mat-card:has([class*="${cardCode}"])${titleSelectors ? `, ${titleSelectors}` : ''}`;

    const card = this.page.locator(cardLocatorStr).first();

    // Esperar hasta 10s a que el backend cargue el servicio en el DOM
    const isVisible = await card
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!isVisible) {
      console.log(`ℹ️ [Ancillaries] Tarjeta '${cardCode}' no disponible para este caso. Se omite.`);
      return false;
    }

    await card.scrollIntoViewIfNeeded();
    await card.click();
    await this.page.waitForTimeout(500);
    return true;
  }

  private async confirmAncillaryModal(): Promise<void> {
    const confirmBtn = this.page.getByRole('button', { name: /Confirm|Save|Guardar|Continuar/i })
      .or(this.page.getByTestId('nbf-button'))
      .first();

    const isReady = await confirmBtn.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
    if (isReady) {
      await confirmBtn.click({ force: true });
      // Esperar a que el backdrop/overlay del modal desaparezca
      await this.page.locator('.cdk-overlay-backdrop, mat-dialog-container').first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => { });
    }
  }
}