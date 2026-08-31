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
  /* Timeout por test: el flujo NBF completo tarda >30s */
  timeout: 180_000,
  /* Reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    trace: 'off',
    screenshot: 'on',
    video: 'on',
    /* Viewport estándar desktop */
    viewport: { width: 1280, height: 720 },
    /* Timeouts por acción para fallar rápido si un elemento no responde */
    actionTimeout: 30_000,
    navigationTimeout: 70_000,
    // Otorga permisos para leer y escribir en el portapapeles
    permissions: ['clipboard-read', 'clipboard-write'],
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
