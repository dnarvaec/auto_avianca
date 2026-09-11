import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import type { NbfCaseData } from '../../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const NATIONALITY_MAP: Record<string, string> = {
  CO: 'Colombia', US: 'United States', BR: 'Brazil', ES: 'Spain',
  UK: 'United Kingdom', AR: 'Argentina', MX: 'Mexico',
  PE: 'Peru', EC: 'Ecuador', VE: 'Venezuela',
};

const GENERIC_BIRTH_YEARS = {
  adult: 1990,
  young: 2013,  // 13 años (rango 12-14)
  child: 2020,  //  6 años (rango 2-11)
  infant: 2025,  //  1 año  (< 2)
} as const;

// Nombres y apellidos genéricos 100% alfabéticos (sin números)
const GENERIC = { firstName: 'Test', lastName: 'Passenger', day: '1', monthIndex: '1', nationality: 'CO' };

interface PanelData {
  gender: 'male' | 'female';
  firstName: string;
  lastName: string;
  day: string;
  monthIndex: string;
  year: string;
  nationality: string;
  lifeMiles?: boolean;
}

export class TravelersPage extends BasePage {
  // ─── Locators Principales ──────────────────────────────────────────────────
  private readonly pageWrapper: Locator;
  private readonly prefixInput: Locator;
  private readonly phoneInput: Locator;
  private readonly emailInput: Locator;
  private readonly confirmEmailInput: Locator;
  private readonly privacyCheckbox: Locator;
  private readonly continueBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.pageWrapper = page.getByTestId('passenger-details-wrapper')
      .or(page.locator('travelers-page, mat-accordion.accordion'));

    this.prefixInput = page.locator('input[formcontrolname="countryPhoneExtension"], mat-form-field.country-code input');
    this.phoneInput = page.getByTestId('phone-input').or(page.locator('input[formcontrolname="number"]'));
    this.emailInput = page.getByTestId('email-input-element').or(page.locator('input[formcontrolname="email"]'));
    this.confirmEmailInput = page.getByTestId('confirm-email-input-element').or(page.locator('input[formcontrolname="confirmEmail"]'));
    this.privacyCheckbox = page.locator('mat-checkbox[formcontrolname="isPrivacyPolicyAccepted"]');

    // Selectores priorizando la versión de escritorio visible
    this.continueBtn = page.locator(
      '#continue-btn-footer, #continue-btn-footer-static, [data-testid="cart-continue-btn"], [data-testid*="order-continue-btn-footer"], button.cart-continue-btn, button.btn-primary-black, button[data-testid="continue-ancillaries-btn-mobile"]'
    ).filter({ hasText: /Continue|Continuar/i });
  }

  // ─── Navegación ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await expect(this.page).toHaveURL(/.*\/travelers/, { timeout: 25000 });
    await expect(this.pageWrapper.first()).toBeVisible({ timeout: 15000 });
  }

  // ─── Llenado de Pasajeros ──────────────────────────────────────────────────

  async fillAllPassengers(tc: NbfCaseData): Promise<void> {
    await this.waitForPage();

    const numAdults = Math.max(1, Number(tc.Adultos) || 1);
    const numYoungs = Number(tc.Youngs) || 0;
    const numChildren = Number(tc.Children) || 0;
    const numInfants = Number(tc.Infants) || 0;

    const dob1 = String(tc['F.Nac']).split('T')[0].split('-');

    // Adult 1 — Datos reales del Excel (limpieza de números/espacios)
    const rawFirstName = String(tc.Nombre).trim().split(' ')[0] ?? 'Juan';
    const rawLastName = String(tc.Nombre).trim().split(' ').slice(1).join(' ') || rawFirstName;

    await this.fillPassengerPanel('Adult 1', {
      gender: String(tc.Genero).toUpperCase() === 'M' ? 'male' : 'female',
      firstName: rawFirstName.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ''),
      lastName: rawLastName.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '') || 'Perez',
      day: dob1[2],
      monthIndex: dob1[1],
      year: dob1[0],
      nationality: NATIONALITY_MAP[String(tc.Nacionalidad).toUpperCase()] ?? String(tc.Nacionalidad),
      lifeMiles: String(tc.LifeMiles).toLowerCase() === 'si',
    });

    // Adults adicionales (Adult 2+) — Solo letras
    for (let i = 2; i <= numAdults; i++) {
      await this.fillPassengerPanel(`Adult ${i}`, {
        gender: 'male',
        firstName: GENERIC.firstName,
        lastName: GENERIC.lastName,
        day: GENERIC.day,
        monthIndex: GENERIC.monthIndex,
        year: String(GENERIC_BIRTH_YEARS.adult),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Youths (12-14) — Solo letras
    for (let i = 1; i <= numYoungs; i++) {
      await this.fillPassengerPanel(`Youth ${i}`, {
        gender: 'male',
        firstName: GENERIC.firstName,
        lastName: GENERIC.lastName,
        day: GENERIC.day,
        monthIndex: GENERIC.monthIndex,
        year: String(GENERIC_BIRTH_YEARS.young),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Children (2-11) — Solo letras
    for (let i = 1; i <= numChildren; i++) {
      await this.fillPassengerPanel(`Child ${i}`, {
        gender: 'male',
        firstName: GENERIC.firstName,
        lastName: GENERIC.lastName,
        day: GENERIC.day,
        monthIndex: GENERIC.monthIndex,
        year: String(GENERIC_BIRTH_YEARS.child),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Infants (< 2) — Solo letras
    for (let i = 1; i <= numInfants; i++) {
      await this.fillPassengerPanel(`Infant ${i}`, {
        gender: 'male',
        firstName: GENERIC.firstName,
        lastName: GENERIC.lastName,
        day: GENERIC.day,
        monthIndex: GENERIC.monthIndex,
        year: String(GENERIC_BIRTH_YEARS.infant),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }
  }

  // ─── Booking Holder ────────────────────────────────────────────────────────

  async fillBookingHolder(telefono: string, correo: string): Promise<void> {
    const holderPanelHeader = this.page.locator(
      'mat-expansion-panel.accordion__panel--booking-holder mat-expansion-panel-header, mat-expansion-panel-header:has-text("Booking holder")'
    ).first();

    if (await holderPanelHeader.isVisible({ timeout: 8000 }).catch(() => false)) {
      const isExpanded = await holderPanelHeader.getAttribute('aria-expanded').then(v => v === 'true').catch(() => false);
      if (!isExpanded) {
        await holderPanelHeader.scrollIntoViewIfNeeded();
        await holderPanelHeader.click();
        await expect(holderPanelHeader).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
        await this.page.waitForTimeout(300);
      }
    }

    // Dropdown de pasajero titular
    const holderSelect = this.page.locator('mat-select[formcontrolname="bookingHolder"]').first();
    if (await holderSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await holderSelect.click();
      const firstOpt = this.page.getByRole('option').first();
      if (await firstOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstOpt.click();
      }
      await this.page.waitForTimeout(200);
    }

    // Prefijo telefónico
    if (await this.prefixInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.prefixInput.fill('+57');
      await this.page.waitForTimeout(300);
      const prefixOption = this.page.getByRole('option').first();
      if (await prefixOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await prefixOption.click();
      }
    }

    // Teléfono y Correo
    await this.phoneInput.fill(String(telefono));
    await this.emailInput.fill(String(correo));
    await this.confirmEmailInput.fill(String(correo));

    // Checkbox de Privacidad
    const privacyNative = this.privacyCheckbox.locator('input[type="checkbox"]').first();
    if (await privacyNative.isVisible({ timeout: 3000 }).catch(() => false)) {
      if (!(await privacyNative.isChecked())) {
        await privacyNative.click({ force: true });
      }
    }
  }

  // ─── Continuar al siguiente paso (Ancillaries) ─────────────────────────────

  async continue(): Promise<void> {
    // Filtrar solo el botón que sea visible en pantalla (ignorando el móvil oculto)
    const activeContinueBtn = this.continueBtn.and(this.page.locator(':visible')).first();

    await expect(activeContinueBtn).toBeVisible({ timeout: 15000 });
    await activeContinueBtn.scrollIntoViewIfNeeded();
    await activeContinueBtn.click();

    // Esperar a que la sección de ancillaries aparezca o cambie la URL
    const ancillariesSection = this.page.locator(
      '.ancilliaries-section:not(.hidden), .content--ancillaries, optional-services-container, baggage-decision-section'
    ).first();

    await Promise.race([
      expect(ancillariesSection).toBeVisible({ timeout: 25000 }),
      this.page.waitForURL(/.*(\/seats|\/services|\/ancillaries|\/checkout|orderId)/i, { timeout: 25000 }).catch(() => { }),
    ]);
  }

  // ─── Métodos Privados ──────────────────────────────────────────────────────

  private passengerPanel(label: string): Locator {
    return this.page.locator('mat-expansion-panel').filter({
      has: this.page.locator('.accordion__pax-count', { hasText: label }),
    }).first();
  }

  private async expandPanel(label: string): Promise<void> {
    const header = this.page.locator('mat-expansion-panel-header').filter({
      has: this.page.locator('.accordion__pax-count', { hasText: label }),
    }).first();

    await expect(header).toBeVisible({ timeout: 10000 });
    await header.scrollIntoViewIfNeeded();

    const isExpanded = await header.getAttribute('aria-expanded').then(v => v === 'true').catch(() => false);
    if (!isExpanded) {
      await header.click();
      await expect(header).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
      await this.page.waitForTimeout(300);
    }
  }

  private async fillPassengerPanel(label: string, data: PanelData): Promise<void> {
    await this.expandPanel(label);

    const panel = this.passengerPanel(label);
    const genderSelect = panel.getByTestId('gender-select').first();

    await expect(genderSelect).toBeVisible({ timeout: 10000 });
    await genderSelect.scrollIntoViewIfNeeded();
    await genderSelect.click();

    // ── Género
    const genderRegex = data.gender === 'male' ? /^male|^masculino/i : /^female|^femenino/i;
    const genderOption = this.page.getByRole('option', { name: genderRegex }).first();
    await expect(genderOption).toBeVisible({ timeout: 5000 });
    await genderOption.click();
    await this.page.waitForTimeout(200);

    // ── Nombre y Apellido (100% letras)
    const firstNameInput = panel.getByTestId('first-name-input').first();
    await firstNameInput.fill(data.firstName);

    const lastNameInput = panel.getByTestId('last-name-input').first();
    await lastNameInput.fill(data.lastName);

    // ── Fecha de Nacimiento
    await this.fillDOB(panel.getByTestId('date-of-birth'), data.day, data.monthIndex, data.year);

    // ── Nacionalidad
    await this.fillNationality(panel.locator('input[data-test="TA-tp-Nationality"]'), data.nationality);

    // ── LifeMiles
    if (data.lifeMiles) {
      await this.fillLifeMiles(panel);
    }

    // ── Botón Next del panel
    const nextBtn = panel.locator('button[data-testid="traveler-panel__actions-next"]').first();
    if (await nextBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextBtn.click();
      await this.page.waitForTimeout(400);
    }
  }

  private async fillDOB(container: Locator, day: string, monthIndexOrName: string, year: string): Promise<void> {
    const monthName = isNaN(parseInt(monthIndexOrName, 10))
      ? monthIndexOrName
      : MONTHS_EN[parseInt(monthIndexOrName, 10) - 1] ?? 'January';

    // 1. Día
    const dayInput = container.locator('input[placeholder="Day"]').first();
    await dayInput.scrollIntoViewIfNeeded();
    await dayInput.click();
    await dayInput.fill(String(parseInt(day, 10)));
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(150);

    // 2. Mes
    const monthSelect = container.locator('mat-select[formcontrolname="month"], mat-select').first();
    await monthSelect.click();
    const monthOption = this.page.getByRole('option', { name: new RegExp(`^${monthName}`, 'i') }).first();
    await expect(monthOption).toBeVisible({ timeout: 5000 });
    await monthOption.click();
    await this.page.waitForTimeout(150);

    // 3. Año
    const yearInput = container.locator('input[placeholder="Year"]').first();
    await yearInput.click();
    await yearInput.fill(year);
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(150);
  }

  private async fillNationality(input: Locator, countryName: string): Promise<void> {
    await input.scrollIntoViewIfNeeded();
    await input.click();
    await input.fill(countryName);
    await this.page.waitForTimeout(400);

    const option = this.page.getByRole('option', { name: new RegExp(countryName, 'i') }).first();
    if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
      await option.click();
    } else {
      await this.page.keyboard.press('ArrowDown');
      await this.page.keyboard.press('Enter');
    }
    await this.page.waitForTimeout(200);
  }

  private async fillLifeMiles(panel: Locator): Promise<void> {
    // 1. Marcar el checkbox de LifeMiles
    const lmCheckbox = panel.locator('mat-checkbox[data-testid="ff-checkbox"]').first();

    if (await lmCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await lmCheckbox.scrollIntoViewIfNeeded();
      const nativeInput = lmCheckbox.locator('input[type="checkbox"]').first();

      if (!(await nativeInput.isChecked().catch(() => false))) {
        await lmCheckbox.click({ force: true });
        await this.page.waitForTimeout(400);
      }

      // 2. Si existe un dropdown de programa, asegurar Lifemiles (opcional)
      const programSelect = panel.locator('mat-select[formcontrolname="programCode"]').first();
      if (await programSelect.isVisible({ timeout: 1500 }).catch(() => false)) {
        await programSelect.click({ force: true });
        const lmOption = this.page.getByRole('option', { name: /Lifemiles/i }).first();
        if (await lmOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await lmOption.click({ force: true });
        }
        await this.page.waitForTimeout(200);
      }

      // 3. Llenar el número de LifeMiles directamente sin clic que sea interceptado por el label
      const ffNumberInput = panel.getByTestId('ff-number')
        .or(panel.locator('input[formcontrolname="cardNumber"]'))
        .first();

      await expect(ffNumberInput).toBeVisible({ timeout: 5000 });
      await ffNumberInput.scrollIntoViewIfNeeded();
      await ffNumberInput.fill('123456', { force: true });
      await ffNumberInput.blur().catch(() => { });
      await this.page.waitForTimeout(200);
    }
  }
}