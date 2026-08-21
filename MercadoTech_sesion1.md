# MercadoTech — Sesión 1: Fundamentos, Setup y Estrategia de Costos

## Este documento contiene la especificación completa de la sesión. Léelo completamente antes de generar cualquier código o archivo. No hagas suposiciones fuera de lo especificado.

**Prompts de la sesión (ejecutar en orden):**

1. "Lee `mercadotech/MercadoTech_sesion1.md` completo y confírmame que entiendes el alcance. No generes nada todavía."
2. "Ejecuta la Fase 1.1: inicializa el repositorio y el entorno base."
3. "Ejecuta la Fase 1.2: genera el `CLAUDE.md` fundacional del proyecto."
4. "Ejecuta la Fase 1.3: genera `docs/COSTOS.md` con la estrategia de modelos y control de gastos."
5. "Ejecuta la Fase 1.4: genera `docs/PROMPTS.md` con la biblioteca de prompts del proyecto."
6. "Ejecuta la Fase 1.5: realiza el mini test A/B de modelos y documenta los resultados."

---

## Objetivo general

Dejar el proyecto MercadoTech con su entorno de trabajo listo, sus convenciones
escritas (para que Claude Code las respete en todas las sesiones futuras) y una
estrategia explícita de uso de modelos y control de costos.

## Objetivos específicos

* Comprender la estructura y alcance del proyecto MercadoTech.
* Inicializar el repositorio con la higiene mínima (git, .gitignore, README).
* Escribir el `CLAUDE.md` que gobernará el comportamiento de Claude Code.
* Definir qué modelo (Haiku / Sonnet / Opus) se usa para cada tipo de tarea.
* Crear una biblioteca de prompts reutilizables.
* Ejecutar un mini test A/B entre dos modelos y documentar la comparación.

## Tecnologías y herramientas de esta sesión

* Claude Code (CLI / app de escritorio) ya instalado y autenticado.
* Git.
* Markdown (toda la documentación del proyecto es Markdown en español).

## Descripción del producto (referencia para todas las sesiones)

**MercadoTech** es un marketplace de productos tecnológicos:

* **Compradores** navegan un catálogo por categorías, buscan (texto y, desde la
  sesión 4, semánticamente), ven el detalle con galería de imágenes, preguntas y
  respuestas y reseñas verificadas, agregan al carrito, hacen checkout simulado
  y siguen el estado de sus pedidos.
* **Vendedores** publican productos con galería de imágenes reordenable, y
  gestionan sus pedidos en un tablero kanban por estado.
* **Soporte**: un asistente que responde con base en la FAQ de la plataforma
  (RAG, sesión 4) y que en la sesión 8 se convierte en **agente de voz** capaz de
  consultar el estado de un pedido, responder preguntas frecuentes, crear tickets
  y escalar a un humano.
* **Admin** modera y mantiene la base de conocimiento de soporte.

NO hay pasarela de pago real en ningún momento del proyecto: el checkout es
simulado (crea el pedido y descuenta stock, sin cobrar).

---

# FASES

## Fase 1.1 — Inicialización del repositorio y entorno

**Prompt sugerido:** "Ejecuta la Fase 1.1 de `MercadoTech_sesion1.md`: inicializa el repositorio y el entorno base."

Instrucciones:

1. Crear el directorio raíz del proyecto `mercadotech/` (como repositorio propio,
   independiente de cualquier otro proyecto) e inicializar git (`git init`, rama `main`).
2. Crear `.gitignore` para Node/Next.js: `node_modules/`, `.next/`, `.env*.local`,
   `.turbo/`, `coverage/`, `dist/`, `playwright-report/`, `test-results/`, `.DS_Store`.
3. Crear un `README.md` mínimo: nombre del proyecto, una frase de descripción,
   y la nota "ver `docs/` y `CLAUDE.md` para convenciones" (se completará en la sesión 7).
4. Crear la carpeta `docs/` vacía (con `.gitkeep`).
5. Verificar versiones del entorno y dejarlas registradas al final del README:
   `node --version` (≥ 20), `npm --version`, `git --version`.
6. NO crear todavía el proyecto Next.js — eso es la Fase 2.1.

Criterios de aceptación:

* `git status` limpio tras el primer commit ("chore: initialize repository").
* El `.gitignore` cubre todos los artefactos listados.

## Fase 1.2 — `CLAUDE.md` fundacional

**Prompt sugerido:** "Ejecuta la Fase 1.2 de `MercadoTech_sesion1.md`: genera el `CLAUDE.md` fundacional."

El `CLAUDE.md` es el contrato entre el equipo y Claude Code. Debe contener,
como mínimo, estas secciones (redactadas, no como placeholders):

1. **Qué es MercadoTech** (2-3 líneas) y qué NO es (sin pagos reales).
2. **Comandos** (se completa en sesiones futuras; dejar la sección creada con
   `npm run dev/build/lint/type-check/test/test:e2e` como convención objetivo).
3. **Arquitectura por capas** — copiar el diagrama de capas del README maestro
   (`components/ → hooks/ → services/ → lib/*`), con las 5 reglas de independencia:
   un archivo una responsabilidad; sin barrels; la UI nunca importa `lib/ai/`,
   `lib/voice/` ni el cliente admin; un solo camino de datos (hooks → services →
   Supabase con RLS, sin capa REST paralela); tunables solo en `lib/constants/`.
4. **Convenciones de código**: TypeScript estricto, español para comentarios y
   documentación, inglés para identificadores; nombres de servicios
   `<dominio>.service.ts`; hooks `use<Dominio>.ts`.
5. **Fuente de verdad de la base de datos**: `supabase/migrations/` (desde la
   sesión 2); `schema.sql` y `policies.sql` son solo copias de referencia.
6. **Regla de sesiones**: cada sesión tiene su spec en su archivo de planeación;
   no adelantar trabajo de sesiones futuras.

Criterios de aceptación:

* Un desarrollador (o Claude) que solo lea `CLAUDE.md` sabe dónde poner un
  archivo nuevo y qué tiene prohibido hacer.

## Fase 1.3 — Estrategia de modelos y costos (`docs/COSTOS.md`)

**Prompt sugerido:** "Ejecuta la Fase 1.3 de `MercadoTech_sesion1.md`: genera `docs/COSTOS.md`."

Contenido obligatorio:

1. **Tabla tarea → modelo** (justificada por costo/beneficio):

| Tipo de tarea | Modelo | Justificación |
|---|---|---|
| Boilerplate, renombrados, documentación mecánica, mensajes de commit | Haiku | Barato y suficiente |
| Features estándar (componentes, hooks, services, tests) | Sonnet | Mejor relación calidad/costo |
| Arquitectura, migraciones RLS, debugging difícil, revisión final | Opus | El error aquí cuesta más que el modelo |

2. **Técnicas de ahorro de tokens** (lista accionable): usar Plan Mode antes de
   cambios grandes; `/clear` al cambiar de tema; pedir cambios por fase (este plan
   ya lo hace); no pegar archivos completos si basta la ruta; agrupar preguntas;
   preferir ediciones quirúrgicas a regeneraciones completas.
3. **Presupuesto orientativo por sesión** y qué hacer si se excede (bajar de
   modelo para tareas mecánicas, reducir alcance de la fase; nunca saltarse tests).
4. **Registro de gasto**: tabla vacía (sesión, fecha, tareas, modelo dominante,
   observaciones) que se llena al final de cada sesión.

## Fase 1.4 — Biblioteca de prompts (`docs/PROMPTS.md`)

**Prompt sugerido:** "Ejecuta la Fase 1.4 de `MercadoTech_sesion1.md`: genera `docs/PROMPTS.md`."

Plantillas mínimas (cada una con su estructura y un ejemplo relleno):

1. **Prompt de fase** (el patrón de este plan): contexto → archivo de spec →
   fase a ejecutar → restricciones → criterio de aceptación.
2. **Prompt de feature**: qué, dónde (capa), contratos (tipos), qué NO tocar.
3. **Prompt de debugging**: síntoma → reproducción → logs → hipótesis pedida.
4. **Prompt de revisión**: diff/archivos → checklist (independencia de capas,
   RLS, tipos) → formato del informe.
5. **Prompt de documentación**: audiencia → alcance → formato.

Regla de estilo para todos: contexto mínimo suficiente, criterio de aceptación
explícito, y siempre indicar qué archivos puede tocar y cuáles no.

## Fase 1.5 — Mini test A/B de modelos

**Prompt sugerido:** "Ejecuta la Fase 1.5 de `MercadoTech_sesion1.md`: realiza el test A/B y documenta resultados en `docs/COSTOS.md`."

Instrucciones:

1. Elegir UNA tarea pequeña y representativa, por ejemplo: escribir
   `formatPrice(cents: number): string` que formatee precios en soles peruanos
   (`S/ 1,299.90`) con tests de borde (cero, negativos, redondeo).
2. Ejecutarla dos veces: una con Haiku y una con Sonnet (mismo prompt exacto).
3. Comparar en una tabla: corrección, casos borde cubiertos, legibilidad,
   tokens/latencia percibida.
4. Registrar la conclusión en `docs/COSTOS.md` (sección "Test A/B — Sesión 1")
   y ajustar la tabla tarea → modelo si el resultado lo amerita.
5. El código resultante se descarta o se guarda en `docs/ab-test/` — NO entra
   al código de producción (la app todavía no existe).

---

## Restricciones de la sesión

* NO crear el proyecto Next.js ni instalar dependencias de la app (sesión 2).
* NO diseñar el esquema de base de datos (sesión 2).
* NO escribir código de producción.

## Entregables

1. Repositorio inicializado con `.gitignore` y README mínimo.
2. `CLAUDE.md` fundacional completo.
3. `docs/COSTOS.md` (estrategia + registro + resultado del A/B).
4. `docs/PROMPTS.md` (5 plantillas).

## Criterios de aceptación de la sesión

* Todos los entregables commiteados.
* `CLAUDE.md` contiene las 5 reglas de independencia de capas.
* El test A/B tiene una conclusión escrita, no solo datos.
