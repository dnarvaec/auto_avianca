import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import type { PaymentConfig } from '../../config/environment';

/**
 * Page Object — Paso 4: "Pay and confirm"
 * URL: https://sdkqa.avtest.ink/pay?sessionID=XXX&channel=NBF
 *
 * Selectores validados en exploración en vivo el 2026-07-22.
 *
 * IMPORTANTE: Los campos del tarjetahabiente (firstnameTitular, city, country, etc.)
 * aparecen DINÁMICAMENTE después de completar el CVV — no están visibles al cargar la página.
 *
 * Formulario completo (orden de aparición):
 *   1. Acordeón Credit card (button#buttonTC)
 *   2. input#cardNumber          → Número de tarjeta
 *   3. mat-select#expiryMonth    → Mes (opciones numéricas: "1"…"12")
 *   4. mat-select#expiryYear     → Año (opciones 2 dígitos: "26","27"…)
 *   5. input#securityDigits      → CVV
 *   --- Los siguientes aparecen tras completar el CVV ---
 *   6. input#firstnameTitular    → Nombre del tarjetahabiente
 *   7. input#lastnameTitular     → Apellido del tarjetahabiente
 *   8. input#emailTitular        → Email
 *   9. .credit-card-form mat-select#areaCode  → Código de área (ej: "Colombia (+57)")
 *  10. input#cellTitular         → Teléfono
 *  11. input#address             → Dirección
 *  12. input#city                → Ciudad
 *  13. .credit-card-form mat-select#country   → País (ej: "Colombia")
 *  14. input#policyCheck         → Acepto T&C (requerido)
 *  15. button#btnPay             → Pagar
 */
export class PaymentPage extends BasePage {
  /**
   * Patron RegExp que coincide con la URL del servicio de pago.
   * Probado en QA: sdkqa.avtest.ink/pay?sessionID=...&channel=NBF
   * IMPORTANTE: usar RegExp, NO glob — los parentesis y pipe en glob son literales.
   */
  static readonly URL_PATTERN: RegExp = /\/pay(\?|$)|RedirectAVCheckout/;

  // ─── Locators — Card data ──────────────────────────────────────────────────
  private readonly creditCardAccordion: Locator;
  private readonly cardNumberInput: Locator;
  private readonly expiryMonthSelect: Locator;
  private readonly expiryYearSelect: Locator;
  private readonly cvvInput: Locator;

  // ─── Locators — Cardholder details (aparecen tras llenar CVV) ─────────────
  private readonly holderNameInput: Locator;
  private readonly holderLastnameInput: Locator;
  private readonly emailInput: Locator;
  private readonly areaCodeSelect: Locator;
  private readonly phoneInput: Locator;
  private readonly addressInput: Locator;
  private readonly cityInput: Locator;
  private readonly countrySelect: Locator;

  // ─── Locators — T&C y Pay ─────────────────────────────────────────────────
  private readonly termsCheckbox: Locator;
  private readonly payBtn: Locator;

  constructor(page: Page) {
    super(page);

    // Card data
    this.creditCardAccordion = page.locator('button#buttonTC');
    this.cardNumberInput     = page.locator('input#cardNumber');
    this.expiryMonthSelect   = page.locator('mat-select#expiryMonth');
    this.expiryYearSelect    = page.locator('mat-select#expiryYear');
    this.cvvInput            = page.locator('input#securityDigits');

    // Cardholder details — TODOS scoped a .credit-card-form
    // Algunos IDs están duplicados en la sección Debit card (colapsada)
    this.holderNameInput     = page.locator('.credit-card-form input#firstnameTitular');
    this.holderLastnameInput = page.locator('.credit-card-form input#lastnameTitular');
    this.emailInput          = page.locator('.credit-card-form input#emailTitular');
    this.areaCodeSelect      = page.locator('.credit-card-form mat-select#areaCode');
    this.phoneInput          = page.locator('.credit-card-form input#cellTitular');
    this.addressInput        = page.locator('.credit-card-form input#address');
    this.cityInput           = page.locator('.credit-card-form input#city');
    this.countrySelect       = page.locator('.credit-card-form mat-select#country');

    // T&C y Pay
    this.termsCheckbox = page.locator('input#policyCheck');
    this.payBtn        = page.locator('button#btnPay');
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    // 'commit' = solo espera que la URL cambie y los headers lleguen,
    // sin esperar carga completa (las paginas de pago son lentas por iframes/3DSecure)
    await this.page.waitForURL(PaymentPage.URL_PATTERN, {
      timeout: 25000,
      waitUntil: 'commit',
    });
    await expect(
      this.page.locator('h1, h2').filter({ hasText: 'Pay and confirm' })
    ).toBeVisible({ timeout: 15000 });
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  /** Expande el acordeón de tarjeta de crédito si está colapsado. */
  async expandCreditCard(): Promise<void> {
    const isClosed = await this.creditCardAccordion.getAttribute('class')
      .then(cls => cls?.includes('collapsed') ?? false);
    if (isClosed) await this.creditCardAccordion.click();
    await expect(this.cardNumberInput).toBeVisible({ timeout: 5000 });
  }

  /**
   * Completa el formulario de pago con los datos del .env.
   * El formato de CC_EXPIRY esperado es "MM/YY" (ej: "05/27").
   *
   * Flujo de llenado:
   *   1. Expandir Credit card
   *   2. Llenar número + mes + año + CVV
   *   3. Esperar que aparezcan los campos del tarjetahabiente
   *   4. Llenar nombre, apellido, email, area code, teléfono, dirección, ciudad, país
   *   5. Aceptar T&C
   */
  async fillPaymentForm(payment: PaymentConfig): Promise<void> {
    await this.expandCreditCard();

    // ── Datos de la tarjeta ─────────────────────────────────────────────────
    await this.fillInput(this.cardNumberInput, payment.cardNumber);

    const { month, year } = this.parseExpiry(payment.expiryDate);
    await this.expiryMonthSelect.click();
    await this.page.locator('mat-option', { hasText: month }).first().click({ force: true });

    await this.expiryYearSelect.click();
    await this.page.locator('mat-option', { hasText: year }).first().click({ force: true });

    await this.fillInput(this.cvvInput, payment.cvv);
    // Tab fuera del CVV para que aparezcan los campos del tarjetahabiente
    await this.page.keyboard.press('Tab');

    // ── Esperar que aparezcan los campos del tarjetahabiente ─────────────────
    await expect(this.holderNameInput).toBeVisible({ timeout: 5000 });

    // ── Datos del tarjetahabiente ────────────────────────────────────────────
    await this.fillInput(this.holderNameInput, payment.holderName);
    await this.fillInput(this.holderLastnameInput, payment.holderLastname);
    await this.fillInput(this.emailInput, payment.email);

    // Area Code (dropdown): buscar por texto parcial, ej: "Colombia (+57)"
    // force:true bypasea el cdk-overlay-backdrop que intercepta eventos en Angular CDK
    await this.areaCodeSelect.click();
    await this.page.locator('mat-option').filter({ hasText: payment.areaCode }).first().click({ force: true });

    await this.fillInput(this.phoneInput, payment.phone);
    await this.fillInput(this.addressInput, payment.address);
    await this.fillInput(this.cityInput, payment.city);

    // País (dropdown): buscar por texto exacto, ej: "Colombia"
    await this.countrySelect.click();
    await this.page.locator('mat-option').filter({ hasText: payment.country }).first().click({ force: true });

    // ── Aceptar Términos y Condiciones ────────────────────────────────────
    // El label contiene hipervínculos — hacer clic en él abre los links en vez de
    // marcar el checkbox. Se usa evaluate() para invocar .click() directamente sobre
    // el input via JS, disparando los eventos de Angular sin tocar los links del label.
    await this.page.locator('input#policyCheck').evaluate(el => (el as HTMLInputElement).click());
    await expect(this.termsCheckbox).toBeChecked({ timeout: 3000 });
  }

  async submitPayment(): Promise<void> {
    await this.clickElement(this.payBtn);
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  }

  // ─── Verificaciones ────────────────────────────────────────────────────────

  async assertPaymentSuccess(): Promise<void> {
    // Esperar navegación a la página de confirmación
    // URL: sdkqa.avtest.ink/confirmation?channel=NBF
    await this.page.waitForURL('**/confirmation**', { timeout: 120000, waitUntil: 'commit' });

    // Verificar heading principal de confirmación
    await expect(
      this.page.getByRole('heading', { name: 'Thank you for your purchase' })
    ).toBeVisible({ timeout: 15000 });

    // Verificar que existe el código de reserva
    await expect(
      this.page.getByText('Your booking code')
    ).toBeVisible({ timeout: 5000 });
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /**
   * Parsea "MM/YY" → { month: "5", year: "27" }
   * Los options del selector usan numeros sin cero inicial (1-12) y 2 digitos (26, 27…)
   */
  private parseExpiry(expiry: string): { month: string; year: string } {
    const [mm, yy] = expiry.split('/');
    return {
      month: String(parseInt(mm, 10)),  // "05" → "5"
      year: yy.trim(),                   // "27" → "27"
    };
  }
}
