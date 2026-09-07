import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import type { PaymentConfig } from '../../config/environment';

/**
 * Page Object — Paso 4: "Pay and confirm" (Abra Checkout)
 * URL: https://abracheckoutqa.avtest.ink/EN/nbf/pay?sessionID=...
 */
export class PaymentPage extends BasePage {
  static readonly URL_PATTERN: RegExp = /.*(abracheckout|sdkqa|\/pay|\/checkout|\/payment)/i;

  // ─── Locators — Cookies ───────────────────────────────────────────────────
  private readonly cookieAcceptBtn: Locator;

  // ─── Locators — Método de Pago ────────────────────────────────────────────
  private readonly cardItemContainer: Locator;
  private readonly cardMethodRadio: Locator;

  // ─── Locators — Datos de la Tarjeta ───────────────────────────────────────
  private readonly holderNameInput: Locator;
  private readonly holderLastnameInput: Locator;
  private readonly cardNumberInput: Locator;
  private readonly expiryMonthTrigger: Locator;
  private readonly expiryYearTrigger: Locator;
  private readonly cvvInput: Locator;

  // ─── Locators — Datos de Contacto y Facturación ───────────────────────────
  private readonly emailInput: Locator;
  private readonly areaCodeTrigger: Locator;
  private readonly phoneInput: Locator;
  private readonly countryTrigger: Locator;
  private readonly cityInput: Locator;
  private readonly addressInput: Locator;

  // ─── Locators — T&C y Botón Pagar (Actualizados) ──────────────────────────
  private readonly termsCheckbox: Locator;
  private readonly payBtn: Locator;

  constructor(page: Page) {
    super(page);

    // Cookies
    this.cookieAcceptBtn = page.locator(
      '#onetrust-accept-btn-handler, #onetrust-banner-sdk button:has-text("Aceptar"), button:has-text("Aceptar"), button:has-text("Accept")'
    );

    // Método de pago: Credit or debit card
    this.cardItemContainer = page.locator('#card-item, .payment-method:has(input[value="card"])');
    this.cardMethodRadio = page.locator('input[name="paymentMethod"][value="card"], #card-item input.radio-button');

    // Datos principales
    this.holderNameInput = page.locator('input#firstnameTitular');
    this.holderLastnameInput = page.locator('input#lastnameTitular');
    this.cardNumberInput = page.locator('input#cardNumber');
    this.expiryMonthTrigger = page.locator('[data-control="expiryMonth"], input#expiryMonth');
    this.expiryYearTrigger = page.locator('[data-control="expiryYear"], input#expiryYear');
    this.cvvInput = page.locator('input#securityDigits');

    // Datos de contacto
    this.emailInput = page.locator('input#emailTc, input#emailTitular');
    this.areaCodeTrigger = page.locator('[data-control="areaCodeTc"], input#areaCodeTc, mat-select#areaCode');
    this.phoneInput = page.locator('input#phoneTc, input#cellTitular');
    this.countryTrigger = page.locator('[data-control="country"], input#country, mat-select#country');
    this.cityInput = page.locator('input#city');
    this.addressInput = page.locator('input#addressTc, input#address');

    // T&C y Botón Pay (Actualizados al nuevo DOM de Abra Checkout)
    this.termsCheckbox = page.locator('input#global-acceptTerms, input#policyCheck');
    this.payBtn = page.locator('button#global-submit, button#btnPay, button.global-submit, .summary-page_content__pasarela__global-actions button.btn-primary');
  }

  // ─── Cookies ──────────────────────────────────────────────────────────────

  async dismissCookies(): Promise<void> {
    const acceptBtn = this.cookieAcceptBtn.first();
    if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acceptBtn.click({ force: true }).catch(() => { });
      await this.page.waitForTimeout(300);
    }

    await this.page
      .locator('.onetrust-pc-dark-filter, #onetrust-banner-sdk')
      .waitFor({ state: 'hidden', timeout: 3000 })
      .catch(() => { });
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await this.page.waitForURL(PaymentPage.URL_PATTERN, {
      timeout: 45000,
      waitUntil: 'domcontentloaded',
    });

    await this.dismissCookies();
    await expect(this.cardItemContainer.first()).toBeVisible({ timeout: 30000 });
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  async expandCreditCard(): Promise<void> {
    await this.dismissCookies();

    const cardLabel = this.cardItemContainer.locator('.payment-method__header, label').first();
    await cardLabel.scrollIntoViewIfNeeded();

    await cardLabel.click({ force: true });
    await this.cardMethodRadio.check({ force: true }).catch(() => { });

    await expect(this.cardNumberInput).toBeVisible({ timeout: 10000 });
  }

  async fillPaymentForm(payment: PaymentConfig): Promise<void> {
    await this.expandCreditCard();

    // ── 1. Nombre y Apellido del Titular ────────────────────────────────────
    await this.holderNameInput.fill(payment.holderName);
    await this.holderLastnameInput.fill(payment.holderLastname);

    // ── 2. Número de Tarjeta ────────────────────────────────────────────────
    await this.cardNumberInput.fill(payment.cardNumber);

    // ── 3. Fecha de Expiración ──────────────────────────────────────────────
    const { month, year } = this.parseExpiry(payment.expiryDate);
    const mmPadded = month.padStart(2, '0'); // "05"

    // Mes
    await this.expiryMonthTrigger.first().click({ force: true });
    await this.page.waitForTimeout(300);
    const monthBtn = this.page.locator(`#expiryMonth-list-panel button[data-value="${mmPadded}"], #expiryMonth-list-panel button:has-text("${mmPadded}")`).first();
    if (await monthBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await monthBtn.click({ force: true });
    } else {
      await this.page.getByRole('option', { name: new RegExp(`^${mmPadded}$`) }).first().click({ force: true });
    }

    // Año
    await this.expiryYearTrigger.first().click({ force: true });
    await this.page.waitForTimeout(300);
    const yearBtn = this.page.locator(`#expiryYear-list-panel button[data-value="${year}"], #expiryYear-list-panel button:has-text("${year}")`).first();
    if (await yearBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await yearBtn.click({ force: true });
    } else {
      await this.page.getByRole('option', { name: new RegExp(`^${year}$`) }).first().click({ force: true });
    }

    // ── 4. CVV ──────────────────────────────────────────────────────────────
    await this.cvvInput.fill(payment.cvv);
    await this.cvvInput.blur();
    await this.page.keyboard.press('Tab');

    // ── 5. Datos de Contacto y Facturación ──────────────────────────────────
    await expect(this.emailInput).toBeVisible({ timeout: 10000 });
    await this.emailInput.fill(payment.email);

    // Código de área / Prefijo
    if (await this.areaCodeTrigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.areaCodeTrigger.first().click({ force: true });
      await this.page.waitForTimeout(300);
      const areaBtn = this.page.locator('#areaCodeTc-list-panel button').filter({ hasText: 'Colombia' }).first();
      if (await areaBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await areaBtn.click({ force: true });
      }
    }

    await this.phoneInput.fill(payment.phone);

    // País
    if (await this.countryTrigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.countryTrigger.first().click({ force: true });
      await this.page.waitForTimeout(300);
      const countryBtn = this.page.locator('#country-list-panel button').filter({ hasText: payment.country }).first();
      if (await countryBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await countryBtn.click({ force: true });
      }
    }

    if (await this.cityInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.cityInput.fill(payment.city);
    }

    await this.addressInput.fill(payment.address);

    // ── 6. Aceptar Términos y Condiciones (#global-acceptTerms) ─────────────
    const termsInput = this.termsCheckbox.first();
    if (await termsInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await termsInput.scrollIntoViewIfNeeded();
      await termsInput.evaluate((el: HTMLInputElement) => {
        if (!el.checked) {
          el.click();
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
      await expect(termsInput).toBeChecked({ timeout: 5000 });
    }
  }

  async submitPayment(): Promise<void> {
    const submitBtn = this.payBtn.first();
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click({ force: true });
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  }

  // ─── Verificaciones ────────────────────────────────────────────────────────

  async assertPaymentSuccess(): Promise<void> {
    await this.page.waitForURL(/.*(\/confirmation|success)/, { timeout: 120000, waitUntil: 'commit' });

    await expect(
      this.page.locator('h1, h2, [class*="title"]').filter({ hasText: /Thank you for your purchase|Gracias por tu compra|Confirmation|Purchase summary/i }).first()
    ).toBeVisible({ timeout: 25000 });

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