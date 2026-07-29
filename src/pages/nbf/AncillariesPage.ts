import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 3: Personaliza tu viaje (Ancillaries)
 * URL: /av/booking/travelers?orderId=XXXX
 *
 * Selectores validados en exploracion en vivo el 2026-07-23.
 *
 * Patron comun de ancillaries:
 *   1. Clic en la celda vacia de la tarjeta -> abre sub-pagina
 *   2. Hacer seleccion segun tipo
 *   3. Clic en [data-testid="nbf-button"] para confirmar y volver
 */
export class AncillariesPage extends BasePage {
  private readonly goToPaymentBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.goToPaymentBtn = page.getByTestId('order-continue-btn-footer-static');
  }

  // ─── Navegacion ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await this.page.waitForURL('**/travelers?orderId=**', { timeout: 25000 });
    await expect(
      this.page.locator('h1, h2').filter({ hasText: 'Personalize your trip' })
    ).toBeVisible({ timeout: 8000 });
  }

  // ─── Metodo principal ──────────────────────────────────────────────────────

  /**
   * Selecciona las ancillaries marcadas como "Si" en el Excel.
   * Cada ancillary navega a una sub-pagina y regresa a la lista.
   */
  async handleAncillaries(flags: {
    Asiento:                string;
    'Equipaje Adic':        string;
    'Sala VIP':             string;
    'Equipaje Deportivo':   string;
    'Asistencia Viaje':     string;
    'Abordaje Prioritario': string;
  }): Promise<void> {
    const yes = (v: string) => String(v).toLowerCase() === 'si';

    if (yes(flags.Asiento))                  await this.selectSeat();
    if (yes(flags['Equipaje Adic']))          await this.selectBaggage();
    if (yes(flags['Sala VIP']))               await this.selectVipLounge();
    if (yes(flags['Equipaje Deportivo']))     await this.selectSportsEquipment();
    if (yes(flags['Asistencia Viaje']))       await this.selectTravelAssistance();
    if (yes(flags['Abordaje Prioritario']))   await this.selectPriorityBoarding();
  }

  // ─── Metodo de navegacion al pago ──────────────────────────────────────────

  async goToPayment(): Promise<void> {
    const floatBtn = this.page.getByTestId('order-continue-btn-footer');
    const isStatic = await this.goToPaymentBtn.isVisible({ timeout: 2000 }).catch(() => false);
    const btn = isStatic ? this.goToPaymentBtn : floatBtn;
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  }

  // ─── Ancillaries individuales ──────────────────────────────────────────────

  /**
   * Asiento: abre el mapa de asientos y selecciona el primero disponible.
   */
  private async selectSeat(): Promise<void> {
    await this.openAncillaryCard('ancilliaries-card-SEAT');
    // Seleccionar el primer asiento disponible
    await this.page.getByRole('button', { name: /Seat number/ }).first().click();
    await this.page.waitForTimeout(300);
    await this.page.getByRole('button', { name: 'Save and exit' }).click();
    await this.waitForPage();
  }

  /**
   * Equipaje adicional: incrementa en 1 maleta para cada pasajero.
   * Intenta con BBAG primero; si no existe, usa CABG.
   */
  private async selectBaggage(): Promise<void> {
    const cardTestId = await this.resolveAncillaryCard(['ancilliaries-card-BBAG', 'ancilliaries-card-CABG']);
    if (!cardTestId) return;

    await this.openAncillaryCard(cardTestId);
    // Incrementar 1 maleta para cada pasajero visible
    const increaseBtns = this.page.getByRole('button', { name: /Increase number of bags/ });
    const count = await increaseBtns.count();
    for (let i = 0; i < count; i++) {
      await increaseBtns.nth(i).click();
      await this.page.waitForTimeout(200);
    }
    await this.page.getByTestId('nbf-button').click();
    await this.waitForPage();
  }

  /**
   * Sala VIP: selecciona todos los pasajeros y confirma.
   */
  private async selectVipLounge(): Promise<void> {
    await this.openAncillaryCard('ancilliaries-card-VIPD');
    await this.page.getByRole('checkbox', { name: /Select all passengers/ }).check();
    await this.page.waitForTimeout(300);
    await this.page.getByTestId('nbf-button').click();
    await this.waitForPage();
  }

  /**
   * Equipaje deportivo: incrementa 1 pieza por cada bag-element disponible.
   */
  private async selectSportsEquipment(): Promise<void> {
    await this.openAncillaryCard('ancilliaries-card-SPEQ');
    // bag-element-0-N donde N es el indice del pasajero
    let idx = 0;
    while (true) {
      const bagEl = this.page.getByTestId(`bag-element-0-${idx}`);
      if (!(await bagEl.isVisible({ timeout: 500 }).catch(() => false))) break;
      await bagEl.getByRole('button', { name: /Increase number of pieces of/ }).click();
      await this.page.waitForTimeout(200);
      idx++;
    }
    await this.page.getByTestId('nbf-button').click();
    await this.waitForPage();
  }

  /**
   * Asistencia de viaje: confirma directamente.
   */
  private async selectTravelAssistance(): Promise<void> {
    await this.openAncillaryCard('ancilliaries-card-ASST');
    await this.page.getByTestId('nbf-button').click();
    await this.waitForPage();
  }

  /**
   * Abordaje prioritario: selecciona todos los pasajeros y confirma.
   */
  private async selectPriorityBoarding(): Promise<void> {
    await this.openAncillaryCard('ancilliaries-card-PBRD');
    await this.page.getByRole('checkbox', { name: /Select all passengers/ }).check();
    await this.page.waitForTimeout(300);
    await this.page.getByTestId('nbf-button').click();
    await this.waitForPage();
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Abre la sub-pagina de una ancillary haciendo clic en la celda vacia de su tarjeta.
   */
  private async openAncillaryCard(testId: string): Promise<void> {
    const card = this.page.getByTestId(testId);
    await card.scrollIntoViewIfNeeded();
    await card.getByRole('cell').filter({ hasText: /^$/ }).click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 8000 });
  }

  /**
   * Resuelve cual de los testIds de ancillary existe en la pagina actual.
   * Util cuando el mismo servicio puede tener codigos distintos (BBAG / CABG).
   */
  private async resolveAncillaryCard(testIds: string[]): Promise<string | null> {
    for (const id of testIds) {
      if (await this.page.getByTestId(id).isVisible({ timeout: 500 }).catch(() => false)) {
        return id;
      }
    }
    console.warn('[AncillariesPage] Ninguna tarjeta encontrada:', testIds.join(', '));
    return null;
  }
}
