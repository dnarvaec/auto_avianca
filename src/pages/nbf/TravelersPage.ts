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
    this.phoneInput = page.getByTestId('phone-input');
    this.emailInput = page.getByTestId('email-input-element');
    this.confirmEmailInput = page.getByTestId('confirm-email-input-element');
    this.privacyCheckbox = page.locator('mat-checkbox[formcontrolname="isPrivacyPolicyAccepted"]');
    this.continueBtn = page.locator('button[data-testid="cart-continue-btn"], #continue-btn-footer').first();
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

    // Adult 1 — Datos reales
    await this.fillPassengerPanel('Adult 1', {
      gender: String(tc.Genero).toUpperCase() === 'M' ? 'male' : 'female',
      firstName: String(tc.Nombre).trim().split(' ')[0],
      lastName: String(tc.Nombre).trim().split(' ').slice(1).join(' ') ||
        String(tc.Nombre).trim().split(' ')[0],
      day: dob1[2],
      monthIndex: dob1[1],
      year: dob1[0],
      nationality: NATIONALITY_MAP[String(tc.Nacionalidad).toUpperCase()] ?? String(tc.Nacionalidad),
      lifeMiles: String(tc.LifeMiles).toLowerCase() === 'si',
    });

    // Adults adicionales
    for (let i = 2; i <= numAdults; i++) {
      await this.fillPassengerPanel('Adult ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.adult),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Youths (12-14)
    for (let i = 1; i <= numYoungs; i++) {
      await this.fillPassengerPanel('Youth ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.young),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Children (2-11)
    for (let i = 1; i <= numChildren; i++) {
      await this.fillPassengerPanel('Child ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.child),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Infants (< 2)
    for (let i = 1; i <= numInfants; i++) {
      await this.fillPassengerPanel('Infant ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.infant),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }
  }

  // ─── Booking Holder ────────────────────────────────────────────────────────

  async fillBookingHolder(telefono: string, correo: string): Promise<void> {
    // 1. Asegurar que el panel de Booking Holder esté expandido
    const holderPanelHeader = this.page.locator('mat-expansion-panel.accordion__panel--booking-holder mat-expansion-panel-header');
    if (await holderPanelHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isExpanded = await holderPanelHeader.getAttribute('aria-expanded').then(v => v === 'true').catch(() => false);
      if (!isExpanded) {
        await holderPanelHeader.click();
        await expect(holderPanelHeader).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
      }
    }

    // 2. Seleccionar el pasajero titular si el dropdown está presente
    const holderSelect = this.page.locator('mat-select[formcontrolname="bookingHolder"]').first();
    if (await holderSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await holderSelect.click();
      await this.page.getByRole('option').first().click();
      await this.page.waitForTimeout(200);
    }

    // 3. Prefix (+57)
    if (await this.prefixInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.prefixInput.fill('+57');
      await this.page.waitForTimeout(300);
      const prefixOption = this.page.getByRole('option').first();
      if (await prefixOption.isVisible({ timeout: 1500 }).catch(() => false)) {
        await prefixOption.click();
      }
    }

    // 4. Teléfono y Correo
    await this.phoneInput.fill(String(telefono));
    await this.emailInput.fill(String(correo));
    await this.confirmEmailInput.fill(String(correo));

    // 5. Checkbox de Políticas de Privacidad
    const privacyNative = this.privacyCheckbox.locator('input[type="checkbox"]').first();
    if (await privacyNative.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await privacyNative.isChecked())) {
        await privacyNative.click({ force: true });
      }
    }
  }

  // ─── Continuar al siguiente paso (Step 3: Seats / Ancillaries) ──────────────

  async continue(): Promise<void> {
    await expect(this.continueBtn).toBeVisible({ timeout: 10000 });
    await this.continueBtn.scrollIntoViewIfNeeded();
    await this.continueBtn.click();

    await this.page.waitForURL(/.*(\/seats|\/services|\/ancillaries|\/checkout|orderId)/, { timeout: 30000 });
  }

  // ─── Métodos Privados ──────────────────────────────────────────────────────

  private passengerPanel(label: string): Locator {
    return this.page.locator('mat-expansion-panel').filter({
      has: this.page.locator('.accordion__pax-count', { hasText: label }),
    });
  }

  private async expandPanel(label: string): Promise<void> {
    const header = this.page.locator('mat-expansion-panel-header').filter({
      has: this.page.locator('.accordion__pax-count', { hasText: label }),
    });
    await header.waitFor({ state: 'visible', timeout: 10000 });
    await header.scrollIntoViewIfNeeded();
    const isExpanded = await header.getAttribute('aria-expanded').then(v => v === 'true').catch(() => false);
    if (!isExpanded) {
      await header.click();
      await expect(header).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    }
  }

  private async fillPassengerPanel(label: string, data: PanelData): Promise<void> {
    await this.expandPanel(label);

    const panel = this.passengerPanel(label);
    const genderSelect = panel.getByTestId('gender-select').first();
    await expect(genderSelect).toBeVisible({ timeout: 8000 });

    // ── Género (getByRole busca en el overlay flotante visible, ignorando templates ocultos)
    await genderSelect.click();
    const genderRegex = data.gender === 'male' ? /^male|^masculino/i : /^female|^femenino/i;
    await this.page.getByRole('option', { name: genderRegex }).first().click();

    // ── Nombre y Apellido
    await panel.getByTestId('first-name-input').fill(data.firstName);
    await panel.getByTestId('last-name-input').fill(data.lastName);

    // ── Fecha de Nacimiento
    await this.fillDOB(panel.getByTestId('date-of-birth'), data.day, data.monthIndex, data.year);

    // ── Nacionalidad
    await this.fillNationality(panel.locator('[data-test="TA-tp-Nationality"]'), data.nationality);

    // ── LifeMiles
    if (data.lifeMiles) {
      await this.fillLifeMiles(panel);
    }

    // ── Botón Next del panel
    const nextBtn = panel.locator('button[data-testid="traveler-panel__actions-next"]').first();
    if (await nextBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await nextBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  private async fillDOB(container: Locator, day: string, monthIndexOrName: string, year: string): Promise<void> {
    const monthName = isNaN(parseInt(monthIndexOrName, 10))
      ? monthIndexOrName
      : MONTHS_EN[parseInt(monthIndexOrName, 10) - 1] ?? 'January';

    // Día
    const dayInput = container.locator('input[placeholder="Day"], input[formcontrolname="day"]').first();
    await dayInput.fill(String(parseInt(day, 10)));
    await this.page.keyboard.press('Tab');

    // Mes
    const monthSelect = container.locator('mat-select[formcontrolname="month"], mat-select').first();
    await monthSelect.click();
    await this.page.getByRole('option', { name: new RegExp(monthName, 'i') }).first().click();

    // Año
    const yearInput = container.locator('input[placeholder="Year"], input[formcontrolname="year"]').first();
    await yearInput.fill(year);
    await this.page.keyboard.press('Tab');
  }

  private async fillNationality(input: Locator, countryName: string): Promise<void> {
    await input.fill(countryName);
    await this.page.waitForTimeout(500);

    // Opción visible del autocompletar
    const option = this.page.getByRole('option', { name: new RegExp('^' + countryName, 'i') }).first();
    if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
      await option.click();
    } else {
      await this.page.keyboard.press('ArrowDown');
      await this.page.keyboard.press('Enter');
    }
  }

  private async fillLifeMiles(panel: Locator): Promise<void> {
    const lmCheckbox = panel.locator('mat-checkbox[data-testid="ff-checkbox"] input[type="checkbox"]').first();
    if (await lmCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      await lmCheckbox.click({ force: true });
      await this.page.waitForTimeout(300);

      const programSelect = panel.locator('mat-select[formcontrolname="programCode"]').first();
      if (await programSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await programSelect.click();
        await this.page.getByRole('option', { name: /Lifemiles/i }).first().click();

        const ffNumber = panel.getByTestId('ff-number');
        if (await ffNumber.isVisible({ timeout: 2000 }).catch(() => false)) {
          await ffNumber.fill(process.env['LIFEMILES_NUMBER'] ?? '1234567890');
        }
      }
    }
  }
}