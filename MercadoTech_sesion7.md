# MercadoTech — Sesión 7: Despliegue y CI/CD con IA

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion7.md` completo y confírmame que entiendes el alcance. No generes código todavía."
2. "Ejecuta la Fase 7.1: pipeline de CI en GitHub Actions."
3. "Ejecuta la Fase 7.2: optimización de performance y Core Web Vitals."
4. "Ejecuta la Fase 7.3: variables de entorno y secretos de producción."
5. "Ejecuta la Fase 7.4: despliegue en Vercel con base de datos remota."
6. "Ejecuta la Fase 7.5: documentación final del proyecto."

---

## Objetivo general

Llevar MercadoTech de "funciona en mi máquina" a un producto desplegado: CI que
bloquea regresiones en cada PR, performance medida y optimizada, gestión segura
de secretos, despliegue automático a Vercel y documentación de nivel entrega.

## Objetivos específicos

* Configurar acciones automáticas de GitHub (CI/CD).
* Optimizar performance y Core Web Vitals con IA.
* Preparar variables de entorno seguras para producción.
* Documentar el proyecto con ayuda de Claude.

---

# FASES

## Fase 7.1 — Pipeline de CI (GitHub Actions)

**Prompt sugerido:** "Ejecuta la Fase 7.1 de `MercadoTech_sesion7.md`."

`.github/workflows/ci.yml`, dos jobs encadenados (patrón probado en ReadHub):

**Job `checks`** (rápido, sin Docker):
1. Checkout + setup Node 20+ con caché de npm.
2. **Pinnear la versión de npm** a la del `packageManager` del package.json
   (lección ReadHub: lockfile generado en Windows + npm más nuevo en Linux =
   "Missing from lock file" por deps opcionales).
3. `npm ci` → `npm run type-check` → `npm run lint` → `npm run test -- --coverage`.
4. Subir cobertura como artefacto (retención 7 días).

**Job `e2e`** (needs: checks):
1. Instalar Chromium de Playwright (solo chromium en CI; con caché por lockfile).
2. Levantar **Supabase local efímero** vía `supabase/setup-cli` + Docker del
   runner: `supabase start` → `supabase db reset` (migraciones + seed).
3. Leer credenciales dinámicamente de `supabase status -o json` (NO son
   secretos: son las claves estándar de cualquier stack local).
4. Correr `npx playwright test --project=chromium` con esas env vars.
5. Subir reporte HTML + screenshots SOLO si falló (retención 14 días).
6. `supabase stop` en `if: always()`.

Extras del workflow: triggers `pull_request` + `push` a main + `workflow_dispatch`;
`concurrency` con `cancel-in-progress`; `permissions: contents: read`;
timeouts por job (15/20 min).

Nota sobre IA en CI: los E2E NO deben depender de `HUGGINGFACEHUB_API_TOKEN`
(el chat con error controlado es comportamiento válido y testeable). Si se
quiere probar RAG real en CI, hacerlo en un workflow manual aparte con el token
como secret.

## Fase 7.2 — Performance y Core Web Vitals

**Prompt sugerido:** "Ejecuta la Fase 7.2 de `MercadoTech_sesion7.md`."

1. **Medir primero**: `npm run build` y registrar tamaños de bundle por ruta;
   Lighthouse (o PageSpeed) sobre home, detalle de producto y asistente.
   Registrar los números ANTES en `docs/PERFORMANCE.md`.
2. Optimizaciones esperadas (aplicar las que la medición justifique):
   * Todas las imágenes por `next/image` con `sizes` correcto; portada del
     card con `priority` solo above-the-fold.
   * `dynamic import` de lo pesado y no-inicial: `ChatWindow`, `OrdersKanban`,
     `SortableImageGallery` (dnd-kit fuera del bundle común).
   * Verificar que NADA de `lib/ai/` ni dependencias de servidor entra al
     bundle cliente (analizar con `@next/bundle-analyzer`).
   * Paginación real del catálogo (si quedó pendiente), `revalidate`/cache
     donde aplique a lecturas públicas (categorías).
   * Fuentes con `next/font`.
3. Objetivos: LCP < 2.5 s, CLS < 0.1, INP < 200 ms (móvil simulado), Lighthouse
   Performance >= 90 en home y catálogo.
4. Registrar el DESPUÉS en `docs/PERFORMANCE.md` (tabla antes/después por métrica).

## Fase 7.3 — Variables de entorno y secretos de producción

**Prompt sugerido:** "Ejecuta la Fase 7.3 de `MercadoTech_sesion7.md`."

1. Auditar `.env.example`: completo, comentado, sin valores reales.
2. `docs/DEPLOY.md`, sección de variables — tabla: variable → dónde vive
   (Vercel env / GitHub Secret / solo local) → quién la lee → pública o secreta:
   * `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — públicas, Vercel.
   * `SUPABASE_SERVICE_ROLE_KEY` — SECRETA, solo runtime de servidor en Vercel
     (usar la clave nueva `sb_secret_...`); jamás en el cliente ni en CI de PRs.
   * `HUGGINGFACEHUB_API_TOKEN` — SECRETA, Vercel.
   * `NEXT_PUBLIC_SITE_URL` — pública, por entorno (preview vs prod).
3. Reglas escritas: nunca commitear `.env*.local`; rotación si una clave se
   expone; los previews de Vercel usan el MISMO proyecto Supabase de staging,
   no el de producción (o documentar la decisión tomada).
4. Verificación: `grep` de que ninguna clave vive hardcodeada en el código.

## Fase 7.4 — Despliegue en Vercel

**Prompt sugerido:** "Ejecuta la Fase 7.4 de `MercadoTech_sesion7.md`."

1. **Base de datos remota**: crear/usar el proyecto Supabase de producción;
   aplicar migraciones con `supabase db push` (documentar el flujo: las
   migraciones se aplican ANTES del deploy que las necesita); NO sembrar el
   seed de laboratorio en producción — crear un `seed.prod.sql` mínimo
   (categorías + artículos FAQ reales) y documentarlo.
2. Conectar el repo a Vercel: framework Next.js, build `npm run build`;
   configurar las env vars de la Fase 7.3 por entorno (Production/Preview).
3. Flujo de despliegue: cada PR → deploy de Preview con URL propia; merge a
   `main` → deploy a Producción. El CI de la Fase 7.1 es requisito de merge
   (branch protection: checks verdes obligatorios — documentar la configuración).
4. Smoke test post-deploy (checklist en `docs/DEPLOY.md`): home carga; login
   con usuario real; catálogo lista; detalle abre; chat responde o falla
   controladamente; `robots`/favicon correctos.
5. Opcional (si el tiempo alcanza): job `deploy` en Actions con la CLI de
   Vercel en lugar de la integración automática, para que TODO el pipeline
   viva en el workflow (test → deploy). Documentar cuál de las dos rutas quedó activa.

## Fase 7.5 — Documentación final

**Prompt sugerido:** "Ejecuta la Fase 7.5 de `MercadoTech_sesion7.md`."

1. `README.md` completo: qué es, stack, arquitectura (diagrama de capas),
   flujo RAG, puesta en marcha local paso a paso (incluye Supabase local),
   comandos, testing, deploy, estructura del proyecto comentada.
2. `docs/ARQUITECTURA.md` actualizado con TODO lo construido en las sesiones
   3–6 (frontend, RAG, MCP, testing) — que refleje la realidad, no el plan.
3. `CLAUDE.md` actualizado: comandos reales, gotchas descubiertos (deps
   opcionales del lockfile, modelos HF que rotan, etc.). Verificar que no
   afirme nada ya falso (lección ReadHub: su CLAUDE.md decía "no hay tests"
   cuando ya había suite completa).
4. `docs/DEPLOY.md` terminado (variables + flujo + smoke tests + rollback:
   cómo revertir a un deploy anterior en Vercel).

---

## Restricciones de la sesión

* No introducir features nuevas — esta sesión endurece y publica lo existente.
* Ningún secreto en el repositorio, en logs de CI ni en el bundle cliente.
* No apuntar tests (unit ni E2E) al Supabase de producción.
* No desplegar sin el CI verde.

## Entregables

1. `.github/workflows/ci.yml` con ambos jobs verdes en GitHub.
2. `docs/PERFORMANCE.md` con métricas antes/después y objetivos alcanzados.
3. `docs/DEPLOY.md` (variables, flujo, smoke tests, rollback).
4. App desplegada en Vercel (URL de producción + previews por PR).
5. README/ARQUITECTURA/CLAUDE.md actualizados.

## Criterios de aceptación de la sesión

* Un PR de prueba dispara CI completo y bloquea el merge si algo falla.
* La URL de producción pasa el smoke test completo.
* Lighthouse >= 90 en Performance para home y catálogo (móvil).
* Un desarrollador nuevo puede levantar el proyecto solo con el README.
