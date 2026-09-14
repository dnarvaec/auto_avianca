import { type Page, type Locator, expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Page Object — Paso 5: Pantalla de Confirmación de Reserva (PNR & Itinerario)
 * URL: https://abracheckoutqa.avtest.ink/en/nbf/confirmation/?token=...
 */
export class ConfirmationPage extends BasePage {
    static readonly URL_PATTERN: RegExp = /.*(\/confirmation|success)/i;

    // ─── Locators ──────────────────────────────────────────────────────────────
    private readonly cookieAcceptBtn: Locator;
    private readonly bookingCodeLocator: Locator;
    private readonly confirmationBanner: Locator;
    private readonly paymentsDetail: Locator;
    private readonly routesContainer: Locator;
    private readonly contactCard: Locator;
    private readonly collapseServicesBtn: Locator;
    private readonly collapseTaxesBtn: Locator;

    constructor(page: Page) {
        super(page);

        this.cookieAcceptBtn = page.locator(
            '#onetrust-accept-btn-handler, #onetrust-banner-sdk button:has-text("Aceptar"), button:has-text("Aceptar"), button:has-text("Accept"), button:has-text("Allow all")'
        );

        // PNR y Banner principal
        this.bookingCodeLocator = page.locator('.reservationCode strong, [class*="reservationCode"] strong').first();
        this.confirmationBanner = page.locator('.confirmationBanner, .reservationContainer').first();

        // Secciones de detalles del viaje
        this.paymentsDetail = page.locator('article.payments-detail, .payment-details').first();
        this.routesContainer = page.locator('section.routes-container, article.route').first();
        this.contactCard = page.locator('section.contact-card, .contact-card__passengers-info').first();

        // Botones desplegables de tarifas e impuestos
        this.collapseServicesBtn = page.locator(
            'button[data-collapse-toggle="collapse-services"], button:has-text("Flights and services")'
        ).first();

        this.collapseTaxesBtn = page.locator(
            'button[data-collapse-toggle="collapse-taxes"], button:has-text("Taxes and fees")'
        ).first();
    }

    // ─── Cookies y Carga ───────────────────────────────────────────────────────

    async dismissCookies(): Promise<void> {
        const acceptBtn = this.cookieAcceptBtn.first();
        if (await acceptBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
            await acceptBtn.click({ force: true }).catch(() => { });
            await this.page.waitForTimeout(300);
        }

        await this.page.evaluate(() => {
            document.querySelectorAll('.onetrust-pc-dark-filter, #onetrust-banner-sdk, #onetrust-consent-sdk').forEach(el => el.remove());
        }).catch(() => { });
    }

    async waitForPage(): Promise<void> {
        // 1. Esperar navegación a la URL de confirmación
        await this.page.waitForURL(ConfirmationPage.URL_PATTERN, {
            timeout: 120000,
            waitUntil: 'domcontentloaded',
        });

        // 2. Esperar a que los loaders desaparezcan
        const loader = this.page.locator('#loader:not(.spinner-desactive), .loader, ngx-spinner');
        await loader.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => { });

        await this.dismissCookies();
    }

    // ─── Verificaciones y Recorrido de Evidencia ──────────────────────────────

    /**
     * Valida la compra exitosa, extrae el PNR y realiza el recorrido
     * visual con scroll suave y apertura de los acordeones para el video.
     * @returns El código de reserva (PNR)
     */
    async assertPaymentSuccess(): Promise<string> {
        await this.waitForPage();

        // 1. Validar el título y código de reserva (PNR)
        await expect(this.bookingCodeLocator).toBeVisible({ timeout: 25000 });
        const pnr = (await this.bookingCodeLocator.innerText()).trim();

        console.log(`\n========================================`);
        console.log(`🎉 ¡COMPRA EXITOSA! PNR / Booking Code: ${pnr}`);
        console.log(`========================================\n`);

        // 2. Scroll centrado en el PNR y banner
        if (await this.confirmationBanner.isVisible({ timeout: 3000 }).catch(() => false)) {
            await this.smoothScroll(this.confirmationBanner, 2000);
        }

        // 3. Scroll suave al detalle de pago (estado aprobado, tarjeta y monto)
        if (await this.paymentsDetail.isVisible({ timeout: 5000 }).catch(() => false)) {
            await this.smoothScroll(this.paymentsDetail, 1000);
        }

        // 4. Scroll suave al itinerario y rutas del vuelo
        if (await this.routesContainer.isVisible({ timeout: 5000 }).catch(() => false)) {
            await this.smoothScroll(this.routesContainer, 1000);
        }

        // 5. Scroll suave a la información de pasajeros y titular
        if (await this.contactCard.isVisible({ timeout: 5000 }).catch(() => false)) {
            await this.smoothScroll(this.contactCard, 1000);
        }

        // 6. Scroll y clic en desglose de Vuelos y Servicios (Flights and services)
        if (await this.collapseServicesBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await this.smoothScroll(this.collapseServicesBtn, 600);
            await this.collapseServicesBtn.click({ force: true });
            await this.page.waitForTimeout(600);
        }

        // 7. Scroll y clic en desglose de Impuestos y Tasas (Taxes and fees)
        if (await this.collapseTaxesBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await this.smoothScroll(this.collapseTaxesBtn, 600);
            await this.collapseTaxesBtn.click({ force: true });
            await this.page.waitForTimeout(600);
        }

        // 8. Pausa final para que el video registre la pantalla completamente expandida
        await this.page.waitForTimeout(3000);

        return pnr;
    }
}