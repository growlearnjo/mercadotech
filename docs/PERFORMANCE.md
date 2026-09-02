# Performance y Core Web Vitals — Fase 7.2

Este documento es el registro de una fase con una sola regla: **medir → cambiar
→ medir**. Ningún cambio entró sin su número de antes y de después, y lo que no
movió la aguja se revirtió y quedó anotado. Los intentos fallidos están aquí a
propósito: son el resultado más útil de la fase.

**Resumen honesto:** de los objetivos de la spec se cumplió uno (CLS) y no se
cumplió el otro (Lighthouse ≥ 90). La causa no es una optimización que falte,
sino la arquitectura de datos del proyecto — está explicada abajo con su
medición, y su corrección es un cambio de diseño que esta sesión prohíbe
expresamente.

---

## 1. Metodología

* **Siempre contra build de producción** (decisión 12 de la spec): `npm run
  build` + `npx next start -p 3001`. Ninguna medición sale de `next dev`.
* **Lighthouse 12 por CLI**, móvil simulado:
  `--form-factor=mobile --screenEmulation.mobile --throttling-method=simulate`.
* **Una corrida de calentamiento que se descarta, más 3 medidas, y se reporta
  la MEDIANA.** Sin esto los números no significan nada: ver §2.
* **Sin `@next/bundle-analyzer`** (decisión 3): el build usa Turbopack. El peso
  se lee del resumen de `next build` (First Load JS por ruta).
* Objetivos de la spec: LCP < 2.5 s · CLS < 0.1 · INP < 200 ms · Lighthouse
  Performance ≥ 90 en home y catálogo.

### Comando reproducible

```bash
npm run build
npx next start -p 3001
npx lighthouse http://localhost:3001/ --only-categories=performance \
  --form-factor=mobile --screenEmulation.mobile --throttling-method=simulate \
  --chrome-flags="--headless=new" --output=json --output-path=lh.json
```

---

## 2. Tres formas de medir mal (todas cometidas aquí antes de acertar)

Esta sección vale más que la tabla de resultados. Los tres errores dieron
números *creíbles* y *falsos*.

| Error | Qué número daba | Cómo se detectó |
|---|---|---|
| **Servidor viejo con build nuevo.** `next start` sigue sirviendo el build que leyó al arrancar; sobrescribir `.next` con un `npm run build` no lo actualiza. | Home **94**, CLS 0, TBT 0 — 22 puntos por encima de lo real | Comparando la hora de arranque del proceso con la de `.next/BUILD_ID`. Desde entonces el script de medición **exige** que el servidor sea posterior al build y aborta si no. |
| **Caché fría del optimizador de imágenes.** La primera petición a `/_next/image` obliga a Next a optimizar cada imagen. | Home **68** en la primera corrida y **73** en la tercera, sin tocar nada | Se añadió una corrida de calentamiento que se descarta. |
| **Medir una redirección.** `/asistente` exige sesión: el middleware manda a `/login`, y Lighthouse mide *esa* página. | Un falso "68 → 84 tras optimizar `/asistente`" que en realidad era la varianza de `/login` consigo mismo | Leyendo `finalDisplayedUrl` del reporte, no la URL pedida. Las rutas con sesión **no se pueden medir** con Lighthouse anónimo, y por eso no aparecen en las tablas. |

La varianza entre corridas idénticas llegó a **21 puntos** (catálogo: 75, 73,
54). Cualquier conclusión sacada de una sola corrida de Lighthouse es ruido.

---

## 3. Medición ANTES

Estado: commit `27fcf97` (paso 0 ya aplicado). Mediana de 3 corridas, móvil.

### 3.1 Core Web Vitals

| Página | Score | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|
| `/` (home) | 72 | 5342 ms | 0.118 | 251 ms | 926 ms |
| `/categoria/gaming` (catálogo) | 73 | 4823 ms | 0.118 | 279 ms | 921 ms |
| `/producto/[id]` | 70 | 4913 ms | 0.118 | 362 ms | 920 ms |

### 3.2 First Load JS por ruta

| Ruta | First Load JS |
|---|---|
| `/` | 300 kB |
| `/buscar` | 306 kB |
| `/producto/[id]` | 301 kB |
| `/asistente` | 295 kB |
| `/soporte` | 297 kB |
| `/vendedor/pedidos` | 291 kB |
| `/vendedor/productos/[id]/editar` | **308 kB** |
| `/vendedor/publicar` | **308 kB** |
| compartido por todas | 142 kB |

### 3.3 Diagnóstico: dónde se va el tiempo

Lighthouse desglosa el LCP en cuatro fases. En la home:

| Fase del LCP | ms | Qué significa |
|---|---|---|
| TTFB | 462 | el servidor responde rápido |
| **Load Delay** | **3916** | **el 73 % del LCP: la imagen ni siquiera se ha pedido todavía** |
| Load Time | 138 | descargarla es barato |
| Render Delay | 826 | pintarla, también |

Y el CLS tenía un único culpable, el mismo en las tres páginas:
`footer.border-t`, con 0.118 de los 0.118.

Ambos números apuntan a la misma causa, confirmada con `curl`: **el HTML
inicial no contiene ni una sola tarjeta de producto.**

```bash
curl -s http://localhost:3001/ | grep -c "product-card"   # → 0
```

Las páginas son Client Components (`"use client"`) que piden los datos con
hooks después de hidratar. La secuencia real es: descargar 300 kB de JS →
hidratar → `fetch` a Supabase → recién entonces existe el `<img>` → pedirla.
Esos son los 3.9 s de Load Delay. Y como el contenido llega tarde, el pie de
página aparece arriba y luego baja: ahí está el CLS.

---

## 4. Optimizaciones aplicadas

### 4.1 Esqueleto de catálogo en el límite de Suspense de la home ✅ SE QUEDA

**Por qué.** La home era `<Suspense fallback={null}>`: nacía literalmente
vacía. El pie subía hasta el borde superior y volvía a bajar al llegar el grid
— el desplazamiento que Lighthouse cobraba como CLS 0.118.

**Qué se hizo.** `CatalogViewSkeleton` reserva el alto de una página de
catálogo reutilizando `ProductGrid` en estado `loading`, para que la reserva la
calcule el propio grid.

| Página | Métrica | Antes | Después | Objetivo |
|---|---|---|---|---|
| `/` | CLS | 0.118 | **0** | < 0.1 ✅ |

### 4.2 `dynamic import` de `SortableImageGallery` ✅ SE QUEDA

**Por qué.** `/vendedor/publicar` y `/editar` eran las dos rutas más pesadas
(308 kB). La galería arrastra dnd-kit, que no hace ninguna falta para escribir
título, precio o stock.

**Qué se hizo.** `ProductForm` la carga con `next/dynamic` (`ssr: false`, con
esqueleto que reserva su sitio).

| Ruta | First Load JS antes | después | Ganancia |
|---|---|---|---|
| `/vendedor/publicar` | 308 kB | **287 kB** | −21 kB |
| `/vendedor/productos/[id]/editar` | 308 kB | **287 kB** | −21 kB |

### 4.3 `priority` en las primeras imágenes del grid ✅ SE QUEDA (con reservas)

**Por qué.** El elemento LCP era una tarjeta del grid con `loading="lazy"`.

**Qué se hizo.** `PRIORITY_IMAGE_COUNT = 4` en `lib/constants/catalog.ts` (una
fila en desktop, dos en móvil); `ProductGrid` marca las primeras.

| Métrica | Antes | Después |
|---|---|---|
| Atributo del elemento LCP | `loading="lazy"` | sin `lazy` |
| Load Time del LCP | 138 ms | **72 ms** |
| LCP total | 5342 ms | 5387 ms (sin cambio real) |

**La reserva, dicha claro:** el efecto sobre el LCP total es indistinguible del
ruido, porque `priority` actúa sobre el Load Time (72 ms) y el cuello es el
Load Delay (3.9 s). Se conserva porque su efecto sobre la fase que le
corresponde **sí** está medido, el coste es cero y el beneficio crecerá cuando
el catálogo se sirva desde el servidor. Es el caso de libro de una optimización
correcta aplicada al problema equivocado.

---

## 5. Optimizaciones intentadas y REVERTIDAS

| Intento | Número obtenido | Por qué se revirtió |
|---|---|---|
| **`dynamic import` de `ChatWindow`** en `/asistente` y `/soporte` | First Load JS 295 → 289 kB y 297 → 291 kB (−6 kB) | Ganancia marginal a cambio de cargar en cascada **el contenido principal** de esas rutas. Y no hay forma de confirmarlo con Lighthouse: ambas exigen sesión y la medición acaba en `/login` (§2). Sin número que lo respalde, no entra. |
| **Esqueleto de Suspense en `/categoria/[slug]`** | CLS 0.118 → 0.118 (ninguno) | Ahí `React.use(params)` suspende **por encima** del límite, así que el fallback no llega a pintarse. Al mover `use` dentro del límite, la ruta quedó **colgada en el esqueleto para siempre** (0 tarjetas tras 5 s). Revertido entero. |
| **Esqueleto de Suspense en `/buscar`** | no medido | `/buscar` es una página de pestañas, no un catálogo: el esqueleto habría mentido sobre lo que viene. Revertido por no tener evidencia. |
| **`dynamic import` de `OrdersKanban`** | no aplicado | Descartado en el ranking previo, sin escribir código: el kanban **es** el contenido de `/vendedor/pedidos`, así que cargarlo aparte solo cambia una espera por otra, y esa ruta (291 kB) no estaba entre las pesadas ni entre los objetivos. |

---

## 6. Medición DESPUÉS

Mediana de 3 corridas, mismas condiciones que el ANTES (misma máquina, mismas
imágenes en Storage, servidor reiniciado tras el build).

| Página | Métrica | Antes | Después | Objetivo | ¿Se cumple? |
|---|---|---|---|---|---|
| `/` (home) | Score | 72 | 72 | ≥ 90 | ❌ |
| | LCP | 5342 ms | 5387 ms | < 2.5 s | ❌ |
| | **CLS** | **0.118** | **0** | < 0.1 | ✅ |
| | TBT | 251 ms | 341 ms | — | — |
| `/categoria/gaming` | Score | 73 | 62 | ≥ 90 | ❌ |
| | LCP | 4823 ms | 4714 ms | < 2.5 s | ❌ |
| | CLS | 0.118 | 0.118 | < 0.1 | ❌ |
| `/producto/[id]` | Score | 70 | 68 | ≥ 90 | ❌ |
| | LCP | 4913 ms | 5025 ms | < 2.5 s | ❌ |
| | CLS | 0.118 | 0.118 | < 0.1 | ❌ |

Las diferencias de score en catálogo y producto (73 → 62, 70 → 68) están
**dentro de la varianza** documentada en §2 — sus corridas individuales fueron
75/73/54 y 68/67/70. No son una regresión: son ruido, y decirlo es parte de
medir bien.

### Bundle

| Ruta | Antes | Después |
|---|---|---|
| `/vendedor/publicar` | 308 kB | **287 kB** |
| `/vendedor/productos/[id]/editar` | 308 kB | **287 kB** |
| resto de rutas | sin cambio | sin cambio |

---

## 7. Por qué NO se alcanza Lighthouse ≥ 90 (y qué haría falta)

**El techo no lo pone una optimización que falte: lo pone de dónde vienen los
datos.** Con 3.9 s de Load Delay —descargar JS, hidratar y recién entonces
pedir los productos— el LCP no puede bajar de ~5 s por mucho que se afine la
imagen, y con el LCP en 5 s el score no llega a 90. Los números de §3.3 lo
demuestran; el `curl` que devuelve 0 tarjetas lo explica en una línea.

Arreglarlo de verdad significa **servir el catálogo desde el servidor**: que
`/`, `/categoria/[slug]` y `/producto/[id]` sean Server Components que reciban
los productos ya renderizados. Eso elimina el Load Delay y el CLS de golpe.

Y eso **no se hizo aquí, deliberadamente**, porque:

1. La sesión 7 prohíbe features y cambios de alcance: *"esta sesión endurece y
   publica lo existente"*.
2. Toca la regla estructural del `CLAUDE.md` —`hooks → services → Supabase`—
   que es el contrato del proyecto desde la sesión 3. Cambiarla a mitad de un
   go-live, con la suite E2E como única red, es exactamente el riesgo que esta
   sesión existe para evitar.

Queda como **la recomendación técnica principal** que esta fase deja abierta,
con su medición ya hecha para quien la tome.

### Nota sobre la medición local

Estos números salen de un stack local: Next optimizando imágenes en el mismo
proceso que sirve las páginas, y Supabase en `127.0.0.1`. En producción
(Vercel + CDN, imágenes cacheadas en el borde) el TTFB y el Load Time mejoran
solos. El **Load Delay no**, porque depende del JS del cliente, no de la red:
la conclusión de §7 se sostiene igual.

---

## 8. Estado de los objetivos

| Objetivo | Resultado | Evidencia |
|---|---|---|
| CLS < 0.1 en la home | ✅ 0.118 → **0** | §4.1 |
| CLS < 0.1 en catálogo y producto | ❌ 0.118 | §5 — el intento falló y se revirtió |
| LCP < 2.5 s | ❌ ~5 s | §3.3 y §7: Load Delay por fetching en cliente |
| Lighthouse ≥ 90 en home y catálogo | ❌ 72 / 62 | §7 |
| INP < 200 ms | sin medir | INP necesita interacción real de usuario; Lighthouse en modo navegación reporta TBT como aproximación (251–341 ms) |
| Bundle de las rutas más pesadas | ✅ −21 kB en las dos de 308 kB | §4.2 |
| Suites verdes tras cada cambio | ✅ 293 unitarios · 13/13 E2E chromium | §9 |

## 9. Verificación al cierre

```bash
npm run lint         # limpio
npm run type-check   # limpio
npm run test         # 293 tests, 17 archivos
npm run build        # verde
npx playwright test --project=chromium   # 13/13 (el navegador que corre el CI)
```
