import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';
import type { NbfCaseData } from '../../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const NATIONALITY_MAP: Record<string, string> = {
  CO: 'Colombia', US: 'United States', BR: 'Brazil', ES: 'Spain',
  UK: 'United Kingdom', AR: 'Argentina', MX: 'Mexico',
  PE: 'Peru', EC: 'Ecuador', VE: 'Venezuela',
};

const GENERIC_BIRTH_YEARS = {
  adult:  1990,
  young:  2013,  // 13 anos (rango 12-14)
  child:  2020,  //  6 anos (rango 2-11)
  infant: 2025,  //  1 ano  (< 2)
} as const;

const GENERIC = { firstName: 'Test', lastName: 'Passenger', day: '1', monthIndex: '1', nationality: 'CO' };

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface PassengerData {
  Nombre:       string;
  Genero:       string;
  'F.Nac':      string;
  Nacionalidad: string;
  LifeMiles:    string;
  Telefono:     string;
  Correo:       string;
}

interface PanelData {
  gender:      'male' | 'female';
  firstName:   string;
  lastName:    string;
  day:         string;
  monthIndex:  string;
  year:        string;
  nationality: string;
  lifeMiles?:  boolean;
}

// ─── Page Object ──────────────────────────────────────────────────────────────

export class TravelersPage extends BasePage {
  private readonly prefixInput:        Locator;
  private readonly phoneInput:         Locator;
  private readonly emailInput:         Locator;
  private readonly confirmEmailInput:  Locator;
  private readonly privacyCheckbox:    Locator;
  private readonly continueBtn:        Locator;

  constructor(page: Page) {
    super(page);
    this.prefixInput       = page.locator('mat-form-field:has(mat-label:text("Prefix")) input');
    this.phoneInput        = page.getByTestId('phone-input');
    this.emailInput        = page.getByTestId('email-input-element');
    this.confirmEmailInput = page.getByTestId('confirm-email-input-element');
    this.privacyCheckbox   = page.locator('mat-checkbox').filter({
      has: page.locator('a[href*="privac"], a[href*="datos"], a[href*="policy"]'),
    });
    this.continueBtn = page.getByTestId('cart-continue-btn').first();
  }

  // ─── Navegacion ────────────────────────────────────────────────────────────

  async waitForPage(): Promise<void> {
    await expect(
      this.page.locator('h1, h2').filter({ hasText: 'Passenger information' })
    ).toBeVisible({ timeout: 10000 });
  }

  // ─── Pasajeros ─────────────────────────────────────────────────────────────

  /**
   * Rellena TODOS los pasajeros del caso segun el Excel.
   * Cada panel se identifica por su label en span.accordion__pax-count
   * ("Adult 1", "Adult 2", "Young 1", "Child 1", "Infant 1", etc.)
   * garantizando que siempre se rellena el pasajero correcto
   * sin depender del orden del DOM.
   */
  async fillAllPassengers(tc: NbfCaseData): Promise<void> {
    await this.waitForPage();

    const numAdults   = Math.max(1, Number(tc.Adultos)  || 1);
    const numYoungs   = Number(tc.Youngs)   || 0;
    const numChildren = Number(tc.Children) || 0;
    const numInfants  = Number(tc.Infants)  || 0;

    const dob1 = String(tc['F.Nac']).split('T')[0].split('-');

    // Adult 1 — datos reales del Excel
    await this.fillPassengerPanel('Adult 1', {
      gender:      String(tc.Genero).toUpperCase() === 'M' ? 'male' : 'female',
      firstName:   String(tc.Nombre).trim().split(' ')[0],
      lastName:    String(tc.Nombre).trim().split(' ').slice(1).join(' ') ||
                   String(tc.Nombre).trim().split(' ')[0],
      day:         dob1[2],
      monthIndex:  dob1[1],
      year:        dob1[0],
      nationality: NATIONALITY_MAP[String(tc.Nacionalidad).toUpperCase()] ?? String(tc.Nacionalidad),
      lifeMiles:   String(tc.LifeMiles).toLowerCase() === 'si',
    });

    // Adults adicionales (datos genericos)
    for (let i = 2; i <= numAdults; i++) {
      await this.fillPassengerPanel('Adult ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.adult),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Youths (12-14 anos)
    for (let i = 1; i <= numYoungs; i++) {
      await this.fillPassengerPanel('Youth ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.young),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Children (2-11 anos)
    for (let i = 1; i <= numChildren; i++) {
      await this.fillPassengerPanel('Child ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.child),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    // Infants (< 2 anos)
    for (let i = 1; i <= numInfants; i++) {
      await this.fillPassengerPanel('Infant ' + i, {
        gender: 'male', firstName: GENERIC.firstName, lastName: GENERIC.lastName,
        day: GENERIC.day, monthIndex: GENERIC.monthIndex, year: String(GENERIC_BIRTH_YEARS.infant),
        nationality: NATIONALITY_MAP[GENERIC.nationality]!,
      });
    }

    await expect(this.phoneInput).toBeVisible({ timeout: 8000 });
  }

  // ─── Booking holder ────────────────────────────────────────────────────────

  async fillBookingHolder(telefono: string, correo: string): Promise<void> {
    await this.prefixInput.fill('+57');
    await this.page.waitForTimeout(600);
    const prefixOpt = this.page.locator('mat-option').first();
    if (await prefixOpt.isVisible({ timeout: 1500 }).catch(() => false)) {
      await prefixOpt.click();
    } else {
      await this.prefixInput.clear();
    }
    await this.phoneInput.fill(String(telefono));
    await this.emailInput.fill(String(correo));
    await this.confirmEmailInput.fill(String(correo));

    const privacyInput = this.privacyCheckbox.locator('input[type="checkbox"]');
    if (!(await privacyInput.isChecked())) {
      await privacyInput.click({ force: true });
    }
  }

  // ─── Continuar al Step 3 ───────────────────────────────────────────────────

  async continue(): Promise<void> {
    await this.continueBtn.scrollIntoViewIfNeeded();
    await this.continueBtn.click();
    await this.page.waitForURL('**/travelers?orderId=**', { timeout: 25000 });
  }

  // ─── Privados ────────────────────────────────────────────────────────────

  /**
   * Devuelve el mat-expansion-panel del pasajero por su label en accordion__pax-count.
   * Ejemplo: passengerPanel("Adult 1"), passengerPanel("Child 2"), passengerPanel("Infant 1")
   */
  private passengerPanel(label: string): Locator {
    return this.page.locator('mat-expansion-panel').filter({
      has: this.page.locator('.accordion__pax-count', { hasText: label }),
    });
  }

  /**
   * Expande el panel si aria-expanded != true.
   * Espera que el header sea visible antes de interactuar y que aria-expanded
   * cambie a 'true' tras el click en lugar de usar un waitForTimeout fijo.
   */
  private async expandPanel(label: string): Promise<void> {
    const header = this.page.locator('mat-expansion-panel-header').filter({
      has: this.page.locator('.accordion__pax-count', { hasText: label }),
    });
    // Garantizar que el header está en viewport y estable antes de leerlo
    await header.waitFor({ state: 'visible', timeout: 10000 });
    await header.scrollIntoViewIfNeeded();
    const isExpanded = await header.getAttribute('aria-expanded')
      .then(v => v === 'true')
      .catch(() => false);
    if (!isExpanded) {
      await header.click();
      // Esperar que el panel confirme su expansión en lugar de un timeout fijo
      await expect(header).toHaveAttribute('aria-expanded', 'true', { timeout: 5000 });
    }
  }

  /**
   * Expande y rellena el panel del pasajero identificado por label.
   * Todos los selectores estan scoped al mat-expansion-panel correcto.
   */
  private async fillPassengerPanel(label: string, data: PanelData): Promise<void> {
    await this.expandPanel(label);

    const panel = this.passengerPanel(label);

    // Esperar que el panel esté completamente expandido antes de llenar campos
    await expect(panel.locator('[data-testid="gender-select"]')).toBeVisible({ timeout: 5000 });

    // Genero
    await panel.locator('[data-testid="gender-select"]').click();
    await this.page.waitForTimeout(400);
    await this.page.locator('[data-test="TA-tp-' + data.gender + '"]').click();
    await this.page.waitForTimeout(200);

    // Nombre y apellido
    await panel.getByTestId('first-name-input').fill(data.firstName);
    await panel.getByTestId('last-name-input').fill(data.lastName);

    // Fecha de nacimiento
    await this.fillDOB(panel.getByTestId('date-of-birth'), data.day, data.monthIndex, data.year);

    // Nacionalidad
    await this.fillNationality(panel.locator('[data-test="TA-tp-Nationality"]'), data.nationality);

    // LifeMiles (solo si aplica, generalmente solo Adult 1)
    if (data.lifeMiles) {
      await this.fillLifeMiles(panel);
    }

    // Next del pasajero — scoped al mismo panel
    await panel.getByTestId('traveler-panel__actions-next').click();
    await this.page.waitForTimeout(500);
  }

  private async fillDOB(container: Locator, day: string, monthIndexOrName: string, year: string): Promise<void> {
    const monthName = isNaN(parseInt(monthIndexOrName, 10))
      ? monthIndexOrName
      : MONTHS_EN[parseInt(monthIndexOrName, 10) - 1] ?? 'January';

    await container.locator('input[placeholder="Day"]').fill(String(parseInt(day, 10)));
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(200);

    await container.locator('mat-select').click();
    await this.page.waitForTimeout(400);
    await this.page.locator('mat-option', { hasText: monthName }).first().click();
    await this.page.waitForTimeout(200);

    const yearInput = container.locator('input[placeholder="Year"]');
    await yearInput.fill(year);
    await this.page.waitForTimeout(400);
    const yearOpt = this.page.locator('mat-option').filter({ hasText: new RegExp('^' + year + '$') });
    if (await yearOpt.isVisible({ timeout: 1000 }).catch(() => false)) {
      await yearOpt.click();
    } else {
      await this.page.keyboard.press('Enter');
    }
    await this.page.waitForTimeout(200);
  }

  private async fillNationality(input: Locator, countryName: string): Promise<void> {
    await input.fill(countryName);
    await this.page.waitForTimeout(700);
    const byDataTest = this.page.locator('[data-test="TA-tp-' + countryName + '"]');
    if (await byDataTest.isVisible({ timeout: 1500 }).catch(() => false)) {
      await byDataTest.getByText(countryName).click();
    } else {
      await this.page.locator('mat-option').filter({ hasText: countryName }).first().click();
    }
  }

  private async fillLifeMiles(panel: Locator): Promise<void> {
    await panel.getByTestId('ff-checkbox').locator('label').click();
    await this.page.waitForTimeout(500);

    const programSelect = panel.locator('[formcontrolname="programCode"]').first();
    if (await programSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await programSelect.click();
      await this.page.waitForTimeout(400);
      await this.page.locator('mat-option').filter({ hasText: 'Lifemiles' }).click();
      await this.page.waitForTimeout(200);

      const ffNumber = panel.getByTestId('ff-number');
      if (await ffNumber.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ffNumber.fill(process.env['LIFEMILES_NUMBER'] ?? '1234567890');
      }
    }
  }
}
