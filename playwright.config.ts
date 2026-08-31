// Configuración de Playwright (Fase 6.4). El patrón viene del CI real de
// ReadHub, con sus lecciones ya incorporadas.
//
// REQUISITO DE ENTORNO — los E2E corren SIEMPRE contra el Supabase LOCAL,
// nunca contra el remoto:
//
//   supabase start        # una vez por sesión de trabajo
//   supabase db reset     # ANTES de cada corrida completa de la suite
//
// El reset no es opcional: los specs crean pedidos y productos reales, y sus
// aserciones son sobre lo RECIÉN creado. Sin reset, la segunda corrida
// arrastra datos de la primera.

import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/** Puerto y URL de la app bajo prueba. Configurable para apuntar a otro entorno. */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Un `test.only` olvidado en un PR vaciaría la suite sin que nadie lo note.
  forbidOnly: isCI,
  // En CI un fallo intermitente cuesta una corrida entera; en local se quiere
  // ver el fallo a la primera, sin reintentos que lo escondan.
  retries: isCI ? 2 : 0,
  // En SERIE siempre, no solo en CI: los specs comparten UNA base de datos
  // local (el comprador compra, el vendedor publica y mueve pedidos) y en
  // paralelo se pisan entre sí. Además, en local el `next dev` compila cada
  // ruta bajo demanda y varios workers a la vez lo saturan hasta el timeout.
  workers: 1,
  // 30 s (el default) no alcanzan: en local el `next dev` de Turbopack compila
  // cada ruta la primera vez que se pide, y con los 3 navegadores golpeando a
  // la vez el primer render de la home se va por encima de ese margen. No es
  // un sleep: es el techo de espera, y los tests siguen esperando por estado
  // observable, no por tiempo.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // `github` anota el fallo en la línea del diff; `html` deja el reporte
  // navegable como artefacto.
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  outputDir: "e2e/test-results",

  use: {
    baseURL,
    // Solo en fallo: en verde, guardar vídeo y traza de cada test infla el
    // artefacto a cientos de MB sin que nadie los mire.
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],

  webServer: {
    // En CI se prueba contra el BUILD de producción, no contra `next dev`:
    // es la única forma de que el E2E vea lo mismo que verá un usuario
    // (Server Components compilados, sin overlay de errores de desarrollo).
    command: isCI ? "npm run build && npm run start" : "npm run dev",
    url: baseURL,
    // En local se reutiliza el dev server que ya esté arriba en el puerto
    // 3000, para no esperar un arranque en cada corrida.
    reuseExistingServer: !isCI,
    // `next build` en un runner frío tarda: 2 minutos no alcanzan.
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
