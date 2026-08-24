# Estructura del proyecto

Mapa de MercadoTech carpeta por carpeta: qué contiene cada una, por qué existe
y qué NO debe entrar en ella. Refleja el árbol real del repositorio, no el plan.

> Si buscas el *porqué* de una decisión concreta, está en
> [`BITACORA.md`](BITACORA.md). Si buscas el modelo de datos y las políticas
> RLS, en [`ARQUITECTURA.md`](ARQUITECTURA.md). Este documento es el mapa.

---

## La idea en una frase

El código está partido en **cuatro capas que solo se hablan en una dirección**:

```
app/  →  hooks/  →  services/  →  Supabase (con RLS)
  ↓
components/   (solo reciben props; no saben que Supabase existe)
```

Cada capa tiene un trabajo y solo uno:

| Capa | Responde a | Tiene permitido |
|---|---|---|
| `components/` | "¿cómo se ve esto?" | props, nada más |
| `hooks/` | "¿en qué estado está?" | llamar a services, `useState`/`useEffect` |
| `services/` | "¿cómo se pide o se guarda?" | hablar con Supabase |
| `app/` | "¿quién se conecta con quién?" | unir hooks con componentes |

**Las páginas son el único sitio donde un hook se encuentra con un componente.**
Esa regla es lo que mantiene los componentes reutilizables y testeables.

Hay dos comprobaciones mecánicas de que la separación se respeta. Ambas deben
devolver vacío siempre:

```bash
grep -rl "@/lib/supabase" components hooks
```

```bash
grep -rl "from \"@/services" components
```

---

## Raíz del proyecto

| Archivo | Para qué sirve |
|---|---|
| `CLAUDE.md` | Contrato con Claude Code. Se lee en cada conversación: reglas de arquitectura y convenciones. |
| `README.md` | Puerta de entrada del repo. |
| `package.json` | Dependencias y los scripts (`dev`, `build`, `lint`, `type-check`, `db:types`, `db:images`). |
| `next.config.ts` | Config de Next. Aquí viven los `images.remotePatterns` que autorizan servir imágenes desde Supabase Storage. |
| `middleware.ts` | Punto de entrada del middleware de Next. Delega en `lib/supabase/middleware.ts`. |
| `components.json` | Config de shadcn/ui (estilo `base-nova`, iconos lucide). |
| `eslint.config.mjs` | Reglas de lint, incluidos los ignores de artefactos generados. |
| `tsconfig.json` | TypeScript estricto y el alias `@/`. |
| `MercadoTech_sesionN.md` | Especificaciones del curso, una por sesión. **Material de referencia, no código.** |
| `PROMPTS_sesionN.md` | Los prompts que se ejecutan en cada sesión. |
| `diseño_visual_platform.pdf` | Mockup de la interfaz. De ahí salieron los colores del tema. |

---

## `app/` — Rutas y páginas (21 archivos)

Es el App Router de Next 15. Las carpetas entre paréntesis son **grupos de
rutas**: organizan el código y permiten un layout distinto por zona, pero
**no aparecen en la URL**.

```
app/
├── layout.tsx              raíz: fuentes, metadata, <Toaster />, lang="es"
├── globals.css            TODOS los tokens de color, claro y oscuro
├── favicon.ico
│
├── (shop)/                zona pública de compra  →  URLs sin prefijo
│   ├── layout.tsx         navbar + contenido + pie
│   ├── page.tsx                              /
│   ├── buscar/page.tsx                       /buscar?q=
│   ├── categoria/[slug]/page.tsx             /categoria/laptops
│   ├── producto/[id]/page.tsx                /producto/<uuid>
│   ├── favoritos/page.tsx                    /favoritos
│   ├── carrito/page.tsx                      /carrito
│   └── pedidos/
│       ├── page.tsx                          /pedidos
│       └── [id]/page.tsx                     /pedidos/<uuid>
│
├── (seller)/              panel del vendedor  →  URLs bajo /vendedor
│   ├── layout.tsx         sidebar + guard de rol
│   └── vendedor/
│       ├── productos/page.tsx                /vendedor/productos
│       ├── productos/[id]/editar/page.tsx    /vendedor/productos/<id>/editar
│       ├── publicar/page.tsx                 /vendedor/publicar
│       └── pedidos/page.tsx                  /vendedor/pedidos
│
├── (auth)/                acceso  →  URLs sin prefijo
│   ├── layout.tsx         tarjeta centrada, sin navbar
│   ├── login/page.tsx                        /login
│   └── register/page.tsx                     /register
│
└── api/v1/                vacío A PROPÓSITO hasta la sesión 4
```

**Por qué el vendedor lleva prefijo `/vendedor` y los demás no.** Los grupos de
rutas no entran en la URL, así que `(shop)/pedidos` y `(seller)/pedidos`
resolverían **ambos a `/pedidos`** y Next fallaría al construir. La carpeta
`vendedor/` dentro del grupo evita el choque y además hace la URL más clara.

**Qué hace una página aquí.** Llama a los hooks que necesita y pasa el
resultado a los componentes. Nada más. Ejemplo real, la home completa:

```tsx
const catalog = useProducts();
return <CatalogView title="Productos" {...catalog} />;
```

**`app/api/v1/` está vacío queriendo.** Los Route Handlers se reservan para lo
que no puede correr en el navegador (claves de IA, service role). Todo el CRUD
va por `services/` con RLS. Crear una API paralela "por si acaso" fue un error
en un proyecto anterior y aquí se evita deliberadamente.

---

## `components/` — Presentación pura (56 archivos)

Reciben props y devuelven JSX. **No hacen fetching, no conocen Supabase, no
importan hooks ni services.** Por eso se pueden reutilizar en cualquier
pantalla y probar sin red.

```
components/
├── ui/          (16)  generados por shadcn. No se editan a mano.
├── shared/      (8)   piezas transversales
├── layout/      (9)   navegación
├── catalog/     (5)   grid y filtros
├── product/     (5)   ficha de producto
├── cart/        (2)   carrito
├── orders/      (3)   pedidos del comprador
├── seller/      (5)   panel del vendedor
└── auth/        (2)   formularios de acceso
```

### `ui/` — Primitivos de shadcn

`button`, `card`, `input`, `label`, `textarea`, `select`, `badge`, `dialog`,
`dropdown-menu`, `avatar`, `separator`, `skeleton`, `tabs`, `sheet`, `sonner`,
`table`.

Los genera `npx shadcn@latest add`. **Se tratan como código de terceros**: si
hace falta cambiar algo, se envuelve en un componente propio en vez de editar
el archivo, para que una reinstalación no borre el cambio.

### `shared/` — Las piezas que usa todo el mundo

| Componente | Qué resuelve |
|---|---|
| `Price` | Formatea a `S/ 1,299.90`. Acepta `number` o `string`. |
| `RatingStars` | 1–5 estrellas. Solo lectura con fracciones (4.8) o editable con teclado. |
| `ConditionBadge` | Color por condición: nuevo / usado / reacondicionado. |
| `ProductImage` | Envuelve `next/image` y **degrada a un placeholder** si la imagen falla. |
| `EmptyState` | "Aquí no hay nada, y es normal". Admite una acción sugerida. |
| `ErrorState` | "Algo falló y puedes reintentar". Admite `onRetry`. |
| `LoadingState` | Esqueletos con la forma de lo que va a llegar, para que no salte el layout. |
| `Container` | Ancho máximo y padding responsive, definidos en un solo sitio. |

`ProductImage` existe por una razón concreta: si una imagen no está en Storage,
sin él se vería el icono de imagen rota del navegador en todo el catálogo.

### `layout/` — Navegación

`Navbar` (compone los demás), `SearchBar`, `CategoriesMenu`, `CartIndicator`,
`UserMenu`, `MobileNav` (el menú en móvil), `SellerSidebar`, `NavLink` (marca
la ruta activa) y `Brand` (el wordmark, en un archivo propio porque aparece en
tres sitios).

### `catalog/`, `product/`, `cart/`, `orders/`, `seller/`, `auth/`

Una carpeta por dominio de pantalla. Si un componente solo tiene sentido en una
zona de la app, vive en su carpeta; si lo usan dos o más, sube a `shared/`.

Los dos **drag & drop** están en `seller/`:
`SortableImageGallery` (reordenar la galería de un producto) y `OrdersKanban`
(mover un pedido de estado). Ambos operables con teclado.

---

## `hooks/` — Estado de cliente (13 archivos)

Llaman a services y exponen `{ datos, loading, error, acciones }`. **Cero
lógica de negocio propia**, salvo lo que la spec les asigna explícitamente.

| Hook | De qué se encarga |
|---|---|
| `useAuth` | Sesión y perfil. Escucha cambios de sesión y actualiza a toda la app. |
| `useCategories` | Las 8 categorías, con caché en memoria (las usan navbar y filtros). |
| `useProducts` | Catálogo. **Los filtros viven en la URL.** |
| `useProduct` | Un producto + su galería. Registra la vista si hay sesión. |
| `useQuestions` | Preguntas: preguntar y responder. |
| `useReviews` | Reseñas, promedio y si puedes reseñar. |
| `useFavorite` / `useFavorites` | Un favorito / la lista completa. |
| `useCart` | Carrito y checkout. |
| `useOrders` | Pedidos del comprador y cancelación. |
| `useSellerProducts` | Productos del vendedor. |
| `useSellerOrders` | Kanban. **Aquí viven las reglas de transición de estado.** |
| `useProductForm` | Formulario de producto, incluidas las imágenes. |

**Dos hooks tienen algo que merece explicación:**

`useProducts` pone los filtros en la URL en vez de en estado local. Eso da tres
cosas gratis: el resultado se comparte por enlace, sobrevive a un F5 y el botón
atrás deshace un filtro en vez de sacarte del catálogo.

`useCart` **no** guarda estado por instancia: usa un store compartido entre
todos los `useCart()`. Sin eso, agregar un producto desde la ficha no
actualizaba el contador del navbar, porque cada uno tenía su propia copia.

---

## `services/` — Acceso a datos (10 archivos)

La **única** capa que habla con Supabase. Funciones async puras, sin React.

```
auth · category · product · storage · question · review · favorite · cart · order · seller
```

Todas siguen la misma firma, con el cliente **inyectable al final**:

```ts
export async function getProductById(
  id: string,
  supabase: Client = createClient(),
): Promise<Product | null>
```

Ese default hace que la UI no tenga que pasar nada, y el parámetro permite que
un Route Handler pase el cliente de servidor y un test pase uno falso, sin
duplicar la lógica.

**Aquí se traduce lo que la base devuelve a lo que las pantallas necesitan.**
Tres conversiones concretas que ocurren siempre en esta capa:

- Las columnas `numeric` (precios, totales) **llegan como texto** desde
  PostgREST. El service las convierte con `Number()`; los componentes reciben
  siempre `number`.
- Las imágenes llegan anidadas y **sin ordenar**. El service las ordena por
  `position` y resuelve la URL pública. Los componentes nunca ven una ruta de
  Storage.
- El promedio de reseñas se calcula aquí, no en la card.

Los errores de Supabase **se lanzan tal cual**; traducirlos a algo legible es
trabajo del hook. Cuando el mensaje de la base ya es útil se conserva: el error
de checkout dice literalmente qué producto se quedó sin stock.

---

## `lib/` — Utilidades y configuración (14 archivos)

```
lib/
├── utils.ts          cn() para clases + formatPrice()
├── supabase/         los cuatro clientes
│   ├── client.ts     navegador (anon, respeta RLS)
│   ├── server.ts     Server Components (cookies, respeta RLS)
│   ├── middleware.ts refresca sesión + PROTEGE rutas
│   └── admin.ts      service role — BYPASEA RLS, jamás desde la UI
├── constants/        todos los valores ajustables
│   ├── roles.ts      roles, estados de pedido, condiciones
│   ├── catalog.ts    productos por página, opciones de orden
│   ├── orders.ts     flujo de estados, etiquetas, colores
│   └── product.ts    límites de título e imágenes
├── validators/       validación compartida entre UI y servidor
│   ├── auth.ts
│   └── product.ts
├── ai/               vacío hasta la sesión 4
└── voice/            vacío hasta la sesión 8
```

**`lib/constants/` es donde vive todo número que alguien podría querer cambiar**,
y cada uno lleva un comentario que justifica su valor. Ejemplo: hay 12
productos por página porque 12 es múltiplo de 2, 3 y 4 — las columnas del grid
en móvil, tablet y escritorio— y así ninguna página deja una fila coja.

**`lib/supabase/admin.ts` no debe importarse nunca desde la UI.** Usa la clave
de servicio y salta todas las políticas de seguridad.

**`lib/supabase/middleware.ts` decide quién entra a dónde.** Exigen sesión
`/carrito`, `/pedidos`, `/favoritos` y `/vendedor`; sin ella redirige a
`/login?redirectTo=…`. La ficha de producto es pública a propósito: protegerla
expulsaría a quien llega desde un enlace compartido.

---

## `types/` — Tipos de dominio (6 archivos)

```
database.ts   GENERADO por Supabase. No se edita a mano.
product.ts    Product, ProductImage, Category
order.ts      Order, OrderItem, SellerOrder
user.ts       Profile
question.ts   Question
review.ts     Review
```

`database.ts` se regenera con `npm run db:types` cada vez que cambia el
esquema. Los demás derivan de él y le añaden los campos calculados que la base
no tiene como columna:

```ts
export type Product = Database["public"]["Tables"]["products"]["Row"] & {
  price: number;              // ya convertido desde string
  image_url: string | null;   // URL pública ya resuelta
  average_rating: number | null;
  review_count: number;
};
```

Si un componente necesita el tipo de algo que vive en un hook o en un service,
**ese tipo se mueve aquí o a `lib/constants/`** — así el componente se tipa sin
romper la regla de capas.

---

## `supabase/` — Base de datos

```
supabase/
├── migrations/    LA FUENTE DE VERDAD del esquema (20 archivos .sql)
├── seed.sql       datos de prueba: 6 usuarios, 8 categorías, 16 productos
├── schema.sql     copia legible del esquema — se genera DESDE las migraciones
├── policies.sql   copia legible de las políticas RLS
├── tests/         batería de validación de RLS
├── config.toml    configuración del stack local
└── seed-images/   imágenes descargadas (ignorado por git, regenerable)
```

**Solo `migrations/` manda.** `schema.sql` y `policies.sql` son copias para
leer; nunca al revés. Para cambiar el esquema se crea una migración nueva con
`supabase migration new <nombre>`, jamás se edita una existente.

Las migraciones dejan **14 tablas con RLS activo**, los buckets de Storage y el
RPC `create_order_from_cart`, que hace el checkout completo (crear pedido,
congelar precios, descontar stock, vaciar carrito) en una sola transacción.

---

## `scripts/` — Utilidades fuera del build

`seed-images.mjs` (`npm run db:images`). El seed crea las filas de
`product_images` pero **no los archivos**, así que sin esto el catálogo se ve
entero con placeholders. El script descarga imágenes de muestra y las sube a
Storage. Es idempotente: se puede reejecutar tras un `supabase db reset`.

---

## `docs/` — Documentación

| Archivo | Qué responde |
|---|---|
| `ESTRUCTURA.md` | Este documento: dónde está cada cosa. |
| `ARQUITECTURA.md` | Modelo de datos, relaciones y políticas RLS explicadas. |
| `BITACORA.md` | Qué se construyó en cada sesión, qué se decidió y por qué. |
| `SESION3_CHECKLIST.md` | Verificación de calidad pantalla por pantalla. |

---

## Dónde tocar según lo que quieras hacer

| Quiero… | Voy a… |
|---|---|
| Cambiar un color | `app/globals.css` (solo tokens; nunca un color suelto en un componente) |
| Cambiar productos por página | `lib/constants/catalog.ts` |
| Añadir un campo a un producto | migración nueva → `npm run db:types` → `types/product.ts` → service |
| Cambiar cómo se consulta el catálogo | `services/product.service.ts` |
| Cambiar el comportamiento de los filtros | `hooks/useProducts.ts` |
| Cambiar cómo se ve una card | `components/catalog/ProductCard.tsx` |
| Añadir una pantalla | carpeta en el grupo de `app/` que corresponda |
| Proteger una ruta nueva | `lib/supabase/middleware.ts` |
| Cambiar las reglas del kanban | `hooks/useSellerOrders.ts` |

---

## Tres reglas que conviene no romper

1. **Sin barrels.** Se importa el archivo concreto (`@/services/product.service`),
   nunca un `index.ts` que reexporte todo. Los barrels arrastran dependencias
   invisibles y engordan el bundle.
2. **Un archivo, una responsabilidad.** `product.service.ts` no sabe de pedidos;
   `order.service.ts` no sabe de imágenes.
3. **Los colores solo por tokens.** Nada de `#1868E8` dentro de un componente:
   si un color no está en `globals.css`, el tema oscuro se romperá.
