import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import type { PaymentConfig } from '../../config/environment';

/**
 * Page Object — Paso 4: "Pay and confirm"
 * URL: https://sdkqa.avtest.ink/pay?sessionID=XXX&channel=NBF
 */
export class PaymentPage extends BasePage {
  static readonly URL_PATTERN: RegExp = /\/pay(\?|$)|RedirectAVCheckout|payment/;

  // ─── Locators — Acordeón y Datos de Tarjeta ────────────────────────────────
  private readonly creditCardAccordion: Locator;
  private readonly cardNumberInput: Locator;
  private readonly expiryMonthSelect: Locator;
  private readonly expiryYearSelect: Locator;
  private readonly cvvInput: Locator;

  // ─── Locators — Datos del Titular (Scoped a app-credit-card-form) ─────────
  private readonly holderNameInput: Locator;
  private readonly holderLastnameInput: Locator;
  private readonly emailInput: Locator;
  private readonly areaCodeSelect: Locator;
  private readonly phoneInput: Locator;
  private readonly addressInput: Locator;
  private readonly cityInput: Locator;
  private readonly countrySelect: Locator;

  // ─── Locators — T&C y Botón Pagar ─────────────────────────────────────────
  private readonly termsCheckbox: Locator;
  private readonly payBtn: Locator;

  constructor(page: Page) {
    super(page);

    // Acordeón de Tarjeta de Crédito
    this.creditCardAccordion = page.locator('button#buttonTC, button[data-bs-target="#collapseOne"]');

    // Inputs de Tarjeta
    this.cardNumberInput = page.locator('app-credit-card-form input#cardNumber');
    this.expiryMonthSelect = page.locator('app-credit-card-form mat-select#expiryMonth');
    this.expiryYearSelect = page.locator('app-credit-card-form mat-select#expiryYear');
    this.cvvInput = page.locator('app-credit-card-form input#securityDigits');

    // Datos del titular (estrictamente dentro de app-credit-card-form)
    this.holderNameInput = page.locator('app-credit-card-form input#firstnameTitular');
    this.holderLastnameInput = page.locator('app-credit-card-form input#lastnameTitular');
    this.emailInput = page.locator('app-credit-card-form input#emailTitular');
    this.areaCodeSelect = page.locator('app-credit-card-form mat-select#areaCode');
    this.phoneInput = page.locator('app-credit-card-form input#cellTitular');
    this.addressInput = page.locator('app-credit-card-form input#address');
    this.cityInput = page.locator('app-credit-card-form input#city');
    this.countrySelect = page.locator('app-credit-card-form mat-select#country');

    // T&C y Botón Pay
    this.termsCheckbox = page.locator('input#policyCheck');
    this.payBtn = page.locator('button#btnPay');
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await this.page.waitForURL(PaymentPage.URL_PATTERN, {
      timeout: 35000,
      waitUntil: 'commit',
    });

    await expect(this.creditCardAccordion.first()).toBeVisible({ timeout: 25000 });
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  async expandCreditCard(): Promise<void> {
    const ccBtn = this.creditCardAccordion.first();
    await expect(ccBtn).toBeVisible({ timeout: 15000 });
    await ccBtn.scrollIntoViewIfNeeded();

    await expect(async () => {
      if (!(await this.cardNumberInput.isVisible())) {
        await ccBtn.click();
      }
      await expect(this.cardNumberInput).toBeVisible({ timeout: 3000 });
    }).toPass({
      intervals: [500, 1000],
      timeout: 15000,
    });
  }

  async fillPaymentForm(payment: PaymentConfig): Promise<void> {
    await this.expandCreditCard();

    // ── 1. Datos de la tarjeta ──────────────────────────────────────────────
    await this.cardNumberInput.fill(payment.cardNumber);

    const { month, year } = this.parseExpiry(payment.expiryDate);

    // Mes
    await this.expiryMonthSelect.click();
    await this.page.waitForTimeout(300);
    const monthOption = this.page.getByRole('option', { name: new RegExp(`^0?${month}$`, 'i') })
      .or(this.page.locator('.cdk-overlay-container mat-option').filter({ hasText: month }))
      .first();
    await monthOption.click({ force: true });

    // Año
    await this.expiryYearSelect.click();
    await this.page.waitForTimeout(300);
    const yearOption = this.page.getByRole('option', { name: new RegExp(`^${year}$|^20${year}$`, 'i') })
      .or(this.page.locator('.cdk-overlay-container mat-option').filter({ hasText: year }))
      .first();
    await yearOption.click({ force: true });

    // CVV y desenfoque para disparar validación de Angular
    await this.cvvInput.fill(payment.cvv);
    await this.cvvInput.blur();
    await this.page.keyboard.press('Tab');

    // ── 2. Esperar formalmente a que aparezcan los campos del titular ───────
    await expect(this.holderNameInput).toBeVisible({ timeout: 12000 });

    // ── 3. Llenar información del titular y dirección ───────────────────────
    await this.holderNameInput.fill(payment.holderName);
    await this.holderLastnameInput.fill(payment.holderLastname);
    await this.emailInput.fill(payment.email);

    // Código de área (Area Code)
    await this.areaCodeSelect.click();
    await this.page.waitForTimeout(300);
    const areaCodeOpt = this.page.getByRole('option', { name: new RegExp(payment.areaCode.replace(/[+()]/g, '\\$&'), 'i') })
      .or(this.page.locator('.cdk-overlay-container mat-option').filter({ hasText: payment.areaCode }))
      .first();
    await areaCodeOpt.click({ force: true });

    await this.phoneInput.fill(payment.phone);
    await this.addressInput.fill(payment.address);
    await this.cityInput.fill(payment.city);

    // País
    await this.countrySelect.click();
    await this.page.waitForTimeout(300);
    const countryOpt = this.page.getByRole('option', { name: new RegExp(`^${payment.country}$`, 'i') })
      .or(this.page.locator('.cdk-overlay-container mat-option').filter({ hasText: payment.country }))
      .first();
    await countryOpt.click({ force: true });

    // ── 4. Aceptar Términos y Condiciones ───────────────────────────────────
    await this.termsCheckbox.scrollIntoViewIfNeeded();
    await this.termsCheckbox.evaluate((el: HTMLInputElement) => {
      if (!el.checked) {
        el.click();
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await expect(this.termsCheckbox).toBeChecked({ timeout: 5000 });
  }

  async submitPayment(): Promise<void> {
    await expect(this.payBtn).toBeVisible({ timeout: 10000 });
    await this.payBtn.scrollIntoViewIfNeeded();
    await this.payBtn.click();
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  }

  // ─── Verificaciones ────────────────────────────────────────────────────────

  async assertPaymentSuccess(): Promise<void> {
    // Esperar navegación a la página de confirmación
    await this.page.waitForURL(/.*(\/confirmation|success)/, { timeout: 120000, waitUntil: 'commit' });

    // Validar encabezado de confirmación
    await expect(
      this.page.locator('h1, h2, [class*="title"]').filter({ hasText: /Thank you for your purchase|Gracias por tu compra|Confirmation/i }).first()
    ).toBeVisible({ timeout: 25000 });

    // Validar código de reserva
    await expect(
      this.page.getByText(/Your booking code|Tu código de reserva|Booking code/i).first()
    ).toBeVisible({ timeout: 15000 });
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private parseExpiry(expiry: string): { month: string; year: string } {
    const [mm, yy] = expiry.split('/');
    return {
      month: String(parseInt(mm, 10)),
      year: yy.trim(),
    };
  }
}