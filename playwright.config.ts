import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  /* Ejecutar tests en paralelo dentro de un archivo */
  fullyParallel: false,
  /* Falla el build en CI si hay test.only() */
  forbidOnly: !!process.env.CI,
  /* Reintentos en CI */
  retries: process.env.CI ? 2 : 0,
  /* Workers en CI: 1, local: 2 */
  workers: process.env.CI ? 1 : 2,
  /* Reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    /* Traza en el primer reintento */
    trace: 'on',
    /* Screenshot solo al fallar */
    screenshot: 'on',
    /* Video solo al fallar */
    video: 'on',
    /* Viewport estándar desktop */
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      /* Usa el Google Chrome instalado en el sistema (no requiere playwright install) */
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    /* Descomentar cuando los navegadores estén disponibles por proxy corporativo */
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],
  /* Carpeta de artefactos de test */
  outputDir: 'test-results',
});
