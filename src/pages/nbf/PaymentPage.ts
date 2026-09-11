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

  // ─── Locators — T&C y Botón Pagar ─────────────────────────────────────────
  private readonly termsCheckbox: Locator;
  private readonly payBtn: Locator;

  constructor(page: Page) {
    super(page);

    // Cookies
    this.cookieAcceptBtn = page.locator(
      '#onetrust-accept-btn-handler, #onetrust-banner-sdk button:has-text("Aceptar"), button:has-text("Aceptar"), button:has-text("Accept"), button:has-text("Allow all")'
    );

    // Método de pago: Credit or debit card
    this.cardItemContainer = page.locator('#card-item, .payment-method:has(input[value="card"])');
    this.cardMethodRadio = page.locator('input[name="paymentMethod"][value="card"], #card-item input.radio-button');

    // Datos principales (exactos según HTML)
    this.holderNameInput = page.locator('input#firstnameTitular');
    this.holderLastnameInput = page.locator('input#lastnameTitular');
    this.cardNumberInput = page.locator('input#cardNumber');

    // Contenedores interactivos del select
    this.expiryMonthTrigger = page.locator('div.form-field-select[data-control="expiryMonth"]');
    this.expiryYearTrigger = page.locator('div.form-field-select[data-control="expiryYear"]');
    this.cvvInput = page.locator('input#securityDigits');

    // Datos de contacto
    this.emailInput = page.locator('input#emailTc, input#emailTitular');
    this.areaCodeTrigger = page.locator('[data-control="areaCodeTc"], input#areaCodeTc, mat-select#areaCode');
    this.phoneInput = page.locator('input#phoneTc, input#cellTitular');
    this.countryTrigger = page.locator('[data-control="country"], input#country, mat-select#country');
    this.cityInput = page.locator('input#city');
    this.addressInput = page.locator('input#addressTc, input#address');

    // T&C y Botón Pay
    this.termsCheckbox = page.locator('input#global-acceptTerms, input#policyCheck');
    this.payBtn = page.locator('button#global-submit, button#btnPay');
  }

  // ─── Cookies ──────────────────────────────────────────────────────────────

  async dismissCookies(): Promise<void> {
    const acceptBtn = this.cookieAcceptBtn.first();
    if (await acceptBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await acceptBtn.click({ force: true }).catch(() => { });
      await this.page.waitForTimeout(300);
    }

    const darkFilter = this.page.locator('.onetrust-pc-dark-filter, #onetrust-banner-sdk');
    if (await darkFilter.isVisible({ timeout: 1500 }).catch(() => false)) {
      await darkFilter.evaluate(el => el.remove()).catch(() => { });
    }
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
    await this.smoothScroll(cardLabel, 350);

    await cardLabel.click({ force: true });
    await this.cardMethodRadio.check({ force: true }).catch(() => { });

    await expect(this.cardNumberInput).toBeVisible({ timeout: 10000 });
  }

  async fillPaymentForm(payment: PaymentConfig): Promise<void> {
    await this.expandCreditCard();
    
    // ── 1. Nombre y Apellido del Titular ────────────────────────────────────
    await this.smoothScroll(this.holderNameInput, 250);
    await this.holderNameInput.fill(payment.holderName);
    await this.holderLastnameInput.fill(payment.holderLastname);

    // ── 2. Número de Tarjeta (Uso de pressSequentially para activar formateador JS)
    await this.smoothScroll(this.cardNumberInput, 250);
    await this.cardNumberInput.click();
    await this.cardNumberInput.clear().catch(() => { });
    await this.cardNumberInput.pressSequentially(payment.cardNumber.replace(/\s+/g, ''), { delay: 35 });
    await this.cardNumberInput.blur();

    // ── 3. Fecha de Expiración (Mes y Año) ──────────────────────────────────
    const { month, year } = this.parseExpiry(payment.expiryDate);
    const mmPadded = month.padStart(2, '0'); // Ej: "01"
    const yyPadded = year.length === 4 ? year.slice(-2) : year.padStart(2, '0'); // Ej: "28"

    // ── Seleccionar Mes
    const monthTrigger = this.expiryMonthTrigger.first();
    await this.smoothScroll(monthTrigger, 250);
    await monthTrigger.click();

    const monthOption = this.page.locator(`#expiryMonth-list-panel button[data-value="${mmPadded}"]`).first();
    await expect(monthOption).toBeVisible({ timeout: 5000 });
    await monthOption.click();
    await this.page.waitForTimeout(200);

    // ── Seleccionar Año
    const yearTrigger = this.expiryYearTrigger.first();
    await this.smoothScroll(yearTrigger, 250);
    await yearTrigger.click();

    const yearOption = this.page.locator(`#expiryYear-list-panel button[data-value="${yyPadded}"]`).first();
    await expect(yearOption).toBeVisible({ timeout: 5000 });
    await yearOption.click();
    await this.page.waitForTimeout(200);

    // ── 4. CVV (Limpieza y escritura controlada) ───────────────────────────
    await this.smoothScroll(this.cvvInput, 200);
    await this.cvvInput.click();
    await this.cvvInput.clear().catch(() => { });
    await this.cvvInput.pressSequentially(payment.cvv, { delay: 35 });
    await this.cvvInput.blur();

    // ── 5. Datos de Contacto y Facturación ──────────────────────────────────
    await expect(this.emailInput).toBeVisible({ timeout: 10000 });
    await this.smoothScroll(this.emailInput, 250);
    await this.emailInput.fill(payment.email);

    // Código de área
    if (await this.areaCodeTrigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.smoothScroll(this.areaCodeTrigger.first(), 200);
      await this.areaCodeTrigger.first().click({ force: true });
      await this.page.waitForTimeout(300);
      const areaBtn = this.page.locator('#areaCodeTc-list-panel button').filter({ hasText: 'Colombia' }).first();
      if (await areaBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await areaBtn.click({ force: true });
      }
    }

    await this.smoothScroll(this.phoneInput, 200);
    await this.phoneInput.fill(payment.phone);

    // País
    if (await this.countryTrigger.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.smoothScroll(this.countryTrigger.first(), 200);
      await this.countryTrigger.first().click({ force: true });
      await this.page.waitForTimeout(300);
      const countryBtn = this.page.locator('#country-list-panel button').filter({ hasText: payment.country }).first();
      if (await countryBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await countryBtn.click({ force: true });
      }
    }

    if (await this.cityInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await this.smoothScroll(this.cityInput, 200);
      await this.cityInput.fill(payment.city);
    }

    await this.smoothScroll(this.addressInput, 200);
    await this.addressInput.fill(payment.address);

    // ── 6. Aceptar Términos y Condiciones ───────────────────────────────────
    const termsInput = this.termsCheckbox.first();
    if (await termsInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await this.smoothScroll(termsInput, 300);
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
    await this.smoothScroll(submitBtn, 400);
    await submitBtn.click({ force: true });
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  }

  // ─── Verificaciones ────────────────────────────────────────────────────────

  async assertPaymentSuccess(): Promise<string> {
    // 1. Esperar navegación a la página de confirmación
    await this.page.waitForURL(/.*(\/confirmation|success)/i, {
      timeout: 120000,
      waitUntil: 'domcontentloaded',
    });

    // 2. Esperar a que los loaders desaparezcan
    const loader = this.page.locator('#loader:not(.spinner-desactive), .loader, ngx-spinner');
    await loader.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => { });

    // 3. 🍪 CERRAR COOKIES EN LA PANTALLA DE CONFIRMACIÓN
    await this.dismissCookies();

    // 4. Validar el título y código de reserva (PNR: .reservationCode strong)
    const bookingCodeLocator = this.page.locator('.reservationCode strong, [class*="reservationCode"] strong').first();
    await expect(bookingCodeLocator).toBeVisible({ timeout: 25000 });

    const pnr = (await bookingCodeLocator.innerText()).trim();
    console.log(`\n========================================`);
    console.log(`🎉 ¡COMPRA EXITOSA! PNR / Booking Code: ${pnr}`);
    console.log(`========================================\n`);

    // 5. Scroll centrado en el PNR y banner
    const banner = this.page.locator('.confirmationBanner, .reservationContainer').first();
    if (await banner.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.smoothScroll(banner, 500);
    }

    // 6. Espera para capturar el reporte en video
    await this.page.waitForTimeout(6000);

    return pnr;
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private parseExpiry(expiry: string): { month: string; year: string } {
    const [mm, yy] = expiry.split('/');
    const month = (mm ?? '01').trim();
    let year = (yy ?? '28').trim();
    if (year.length === 4) {
      year = year.slice(-2);
    }
    return { month, year };
  }
}