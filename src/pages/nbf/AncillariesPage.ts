import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 3: Personaliza tu viaje (Ancillaries & Baggage Decision)
 * URL: /av/demo-booking/travelers... (Vista content--ancillaries)
 */
export class AncillariesPage extends BasePage {
  private readonly ancillariesSection: Locator;
  private readonly baggageDecisionSection: Locator;
  private readonly baggageNoRadio: Locator;
  private readonly baggageNoLabel: Locator;
  private readonly goToPaymentBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.ancillariesSection = page.locator('.content--ancillaries, baggage-decision-section, optional-services-container');

    // Contenedor de la decisión de equipaje
    this.baggageDecisionSection = page.locator('baggage-decision-section, .baggage-decision, [class*="baggage-decision"]');

    // Selectores exactos según el HTML
    this.baggageNoRadio = page.locator('input#no-additional-baggage-radio, input[name="baggage-decision"][value="no"]');
    this.baggageNoLabel = page.locator(
      'label[for="no-additional-baggage-radio"], label.baggage-decision__option--no, label:has(#no-additional-baggage-radio)'
    );

    // Botón "Go to payment"
    this.goToPaymentBtn = page.locator(
      '#continue-btn-footer, #continue-btn-footer-static, [data-testid*="order-continue-btn-footer"], button:has-text("Go to payment"), button:has-text("Ir a pagar")'
    ).and(page.locator(':visible')).first();
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    // 1. Esperar que desaparezcan loaders de Angular
    await this.page.locator('ngx-spinner, .loader, #loader, .skeleton-loading').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });
    // 2. Esperar que el contenedor principal esté en el DOM
    await expect(this.ancillariesSection.first()).toBeVisible({ timeout: 25000 });
  }

  // ─── Decisión Condicional de Equipaje ──────────────────────────────────────

  /**
   * Maneja obligatoriamente la opción "Do you need more baggage?".
   * Espera a que termine la carga de Angular, marca "NO" y valida que quede activo.
   */
  async handleBaggageDecision(): Promise<void> {
    // Esperar a que la página se estabilice
    await this.page.locator('ngx-spinner, .loader, #loader').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });

    const noLabel = this.baggageNoLabel.first();
    const noRadio = this.baggageNoRadio.first();

    // Comprobar si la opción NO está visible (hasta 8 segundos de margen para Angular)
    const isPresent = await noLabel.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);

    if (isPresent) {
      console.log('ℹ️ [Ancillaries] Sección "Do you need more baggage?" detectada. Marcando "NO"...');
      await this.smoothScroll(noLabel, 350);

      // 1. Clic en el label contenedor
      await noLabel.click();
      await this.page.waitForTimeout(250);

      // 2. Forzar eventos nativos para que Angular actualice su FormControl
      await noRadio.evaluate((el: HTMLInputElement) => {
        el.checked = true;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }).catch(() => { });

      // 3. Validar con aserción que el radio efectivamente quedó marcado
      await expect(noRadio).toBeChecked({ timeout: 5000 }).catch(async () => {
        // Fallback: clic directo sobre el texto
        await this.page.getByText(/No, I have what I need|No necesito/i).first().click({ force: true });
        await this.page.waitForTimeout(300);
      });

      await this.page.waitForTimeout(400);
    } else {
      console.log('ℹ️ [Ancillaries] Sección de decisión de equipaje no requerida en este flujo.');
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

    // 1. Resolver decisión de equipaje al inicio
    await this.handleBaggageDecision();

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
    // Si la opción de equipaje sigue desmarcada o apareció después, la marcamos
    const noRadio = this.baggageNoRadio.first();
    if (await noRadio.isVisible({ timeout: 1500 }).catch(() => false)) {
      const isChecked = await noRadio.isChecked().catch(() => false);
      if (!isChecked) {
        await this.handleBaggageDecision();
      }
    }

    const activePaymentBtn = this.goToPaymentBtn;
    await expect(activePaymentBtn).toBeVisible({ timeout: 15000 });
    await this.smoothScroll(activePaymentBtn, 500);

    // Bucle resiliente para disparar la pasarela de pagos
    await expect(async () => {
      const currentUrl = this.page.url();
      if (/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i.test(currentUrl)) {
        return;
      }

      // Re-verificar si apareció el error de validación rojo
      if (await this.baggageNoLabel.first().isVisible().catch(() => false)) {
        const isChecked = await this.baggageNoRadio.first().isChecked().catch(() => false);
        if (!isChecked) {
          await this.handleBaggageDecision();
        }
      }

      if (await activePaymentBtn.isVisible()) {
        await activePaymentBtn.click();
      }
      await this.page.waitForURL(/.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i, { timeout: 4000 });
    }).toPass({
      intervals: [1000, 2000, 3000],
      timeout: 45000,
    });
  }

  // ─── Ancillaries Específicas ───────────────────────────────────────────────

  private async selectSeat(): Promise<void> {
    const opened = await this.openAncillaryCard('SEAT', ['Choose your seat', 'Seat', 'Asiento']);
    if (!opened) return;

    const seatMapModal = this.page.locator(
      'optional-service-modal-layout, seatmap-grid, .seatmap-container, mat-dialog-container'
    ).first();
    await seatMapModal.waitFor({ state: 'visible', timeout: 10000 }).catch(() => { });
    await this.page.waitForTimeout(800);

    const availableSeat = this.page.locator(
      '.cell--seat[aria-label*="available" i]:not([aria-disabled="true"]):not([aria-selected="true"]), [role="gridcell"][aria-label*="available" i]:not([aria-disabled="true"]):not([aria-selected="true"]), .cell--seat[aria-label*="disponible" i]:not([aria-disabled="true"])'
    ).first();

    if (await availableSeat.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(availableSeat, 300);
      await availableSeat.click({ force: true });
      await this.page.waitForTimeout(500);
    }

    const confirmSeatBtn = this.page.locator(
      'button.nbf-btn--primary:has-text("Confirm selection"), button:has-text("Confirm selection"), button:has-text("Confirmar selección"), button:has-text("Save and exit"), button:has-text("Guardar y salir"), button:has-text("Confirm"), button:has-text("Confirmar")'
    ).and(this.page.locator(':visible')).first();

    if (await confirmSeatBtn.waitFor({ state: 'visible', timeout: 6000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(confirmSeatBtn, 300);
      await confirmSeatBtn.click({ force: true });
      await this.page.locator('optional-service-modal-layout, mat-dialog-container, .cdk-overlay-backdrop').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });
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

    const selectAll = this.page.locator('mat-checkbox:has-text("Select all"), mat-checkbox:has-text("Seleccionar todos"), mat-checkbox.select-all')
      .or(this.page.getByRole('checkbox', { name: /Select all passengers|Seleccionar todos/i }))
      .first();

    if (await selectAll.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(selectAll, 250);
      const nativeInput = selectAll.locator('input[type="checkbox"]').first();
      if (!(await nativeInput.isChecked().catch(() => false))) {
        await selectAll.click({ force: true });
        await this.page.waitForTimeout(300);
      }
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

    const firstPaxCheckbox = this.page.locator(
      'li.passenger-selector__item[data-index="0"] mat-checkbox, .passenger-selector__list li mat-checkbox, .passenger-selector__list mat-checkbox'
    ).first();

    if (await firstPaxCheckbox.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false)) {
      await this.smoothScroll(firstPaxCheckbox, 250);
      const nativeInput = firstPaxCheckbox.locator('input[type="checkbox"]').first();
      if (!(await nativeInput.isChecked().catch(() => false))) {
        await firstPaxCheckbox.click({ force: true });
        await this.page.waitForTimeout(300);
      }
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
      await this.page.locator('.cdk-overlay-backdrop, mat-dialog-container').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });
    }
  }
}