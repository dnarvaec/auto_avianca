import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Clase base para todos los Page Objects.
 * Encapsula operaciones comunes reutilizables con aserciones web nativas.
 */
export abstract class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Navega a una URL absoluta o relativa (se combina con baseURL del config) */
  async navigate(url: string): Promise<void> {
    await this.page.goto(url);
  }

  /** Espera a que el DOM esté listo */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  // ─── Scroll Inteligente ─────────────────────────────────────

  /**
   * Realiza un scroll suave y centra el elemento en el viewport
   * para que quede perfectamente visible en los videos de evidencia.
   */
  async smoothScroll(locator: Locator, timeout = 300): Promise<void> {
    const el = locator.first();
    await el.evaluate((node: HTMLElement) => {
      node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }).catch(() => { });
    await this.page.waitForTimeout(timeout);
  }

  // ─── Acciones protegidas ────────────────────────────────────

  protected async clickElement(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
    await this.smoothScroll(locator);
    await locator.click();
  }

  protected async fillInput(locator: Locator, value: string): Promise<void> {
    await expect(locator).toBeVisible();
    await this.smoothScroll(locator);
    await locator.fill(value);
  }

  protected async selectOption(locator: Locator, value: string): Promise<void> {
    await expect(locator).toBeVisible();
    await locator.selectOption(value);
  }

  // ─── Aserciones protegidas ──────────────────────────────────

  protected async assertVisible(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeVisible();
  }

  protected async assertHidden(locator: Locator, message?: string): Promise<void> {
    await expect(locator, message).toBeHidden();
  }

  protected async assertText(locator: Locator, expectedText: string): Promise<void> {
    await expect(locator).toHaveText(expectedText);
  }

  protected async assertContainsText(locator: Locator, text: string): Promise<void> {
    await expect(locator).toContainText(text);
  }

  protected async assertURL(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern);
  }

  protected async assertTitle(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveTitle(pattern);
  }
}