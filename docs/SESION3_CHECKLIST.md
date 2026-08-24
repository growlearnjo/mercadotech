# Sesión 3 — Checklist de calidad (Fase 3.8)

Pasada final sobre todas las pantallas del mapa de rutas. No añade
funcionalidad: cierra lo que quedó a medias y verifica la separación de capas.

## Verificación de capas

Los dos greps que exige la spec, ejecutados sobre el árbol final:

```bash
grep -rl "@/lib/supabase" components hooks   # → vacío
grep -rl "from \"@/services" components      # → vacío
```

Ambos devuelven vacío. Para llegar ahí hubo que corregir dos cosas:

* `hooks/useAuth.ts` importaba `lib/supabase/client` para suscribirse a
  `onAuthStateChange`. La suscripción se movió a `services/auth.service.ts`,
  que ahora expone `onAuthStateChange(callback)` y devuelve la función de
  baja.
* `components/seller/*` importaban el tipo `SellerOrder` desde
  `services/seller.service`. El tipo vive ahora en `types/order.ts`; el
  service lo reexporta. Mismo criterio que se aplicó a `CatalogFilters`, que
  pasó de `hooks/useProducts` a `lib/constants/catalog.ts`.

## Limpieza

* `app/dev/ui/page.tsx` eliminado (muestra de la Fase 3.1).
* Sin placeholders "Próximamente": `grep -rn "Próximamente" app/` → vacío.

## Checklist por pantalla

Leyenda: **OK** verificado · **n/a** no aplica.

| Pantalla | Responsive | Carga | Vacío | Error | Teclado | Imágenes | Tema |
|---|---|---|---|---|---|---|---|
| `/` (catálogo) | OK | `ProductCardSkeleton` ×12 | `EmptyState` + "Limpiar filtros" | `ErrorState` + retry | OK | `ProductImage` | OK |
| `/buscar?q=` | OK | ídem | ídem | ídem | OK | `ProductImage` | OK |
| `/categoria/[slug]` | OK | ídem | ídem | ídem | OK | `ProductImage` | OK |
| `/producto/[id]` | OK | `LoadingState` | Q&A y reseñas con `EmptyState` | `ErrorState` + retry | galería con ←/→ | `ProductImage` | OK |
| `/favoritos` | OK | `ProductCardSkeleton` | `EmptyState` + "Explorar catálogo" | `ErrorState` + retry | OK | `ProductImage` | OK |
| `/carrito` | OK | `LoadingState` lista | `EmptyState` + "Ver productos" | `ErrorState` + retry | OK | `ProductImage` | OK |
| `/pedidos` | OK | `LoadingState` lista | `EmptyState` + "Ver productos" | `ErrorState` + retry | OK | n/a | OK |
| `/pedidos/[id]` | OK | `LoadingState` | n/a (siempre tiene ítems) | `ErrorState` + retry | diálogo de cancelar | n/a | OK |
| `/login`, `/register` | OK | botón en estado "Ingresando…" | n/a | `role="alert"` por campo | Tab completo | n/a | OK |
| `/vendedor/productos` | tabla con scroll horizontal | `LoadingState` lista | `EmptyState` + "Publicar" | `ErrorState` + retry | OK | `ProductImage` | OK |
| `/vendedor/publicar` | OK | n/a | n/a | error por campo + `role="alert"` | Tab + galería con teclado | `ProductImage` | OK |
| `/vendedor/productos/[id]/editar` | OK | `LoadingState` | n/a | ídem | ídem | `ProductImage` | OK |
| `/vendedor/pedidos` | columnas con scroll horizontal | `LoadingState` | `EmptyState` | `ErrorState` + retry | `KeyboardSensor` activo | n/a | OK |

## Contraste (medido, no estimado)

Colores computados del DOM y ratio WCAG calculado sobre el valor renderizado:

| Token | Claro | Oscuro |
|---|---|---|
| primary / primary-foreground | 4.81:1 | 6.14:1 |
| success / success-foreground | 4.61:1 | 8.20:1 |
| warning / warning-foreground | 5.30:1 | 6.84:1 |
| destructive / destructive-foreground | 4.57:1 | 6.64:1 |
| muted / muted-foreground | 4.74:1 | 5.50:1 |
| foreground / background | 16.72:1 | 16.75:1 |

Todos ≥ 4.5:1 (AA para texto normal). Dos tokens se ajustaron en la Fase 3.1
justamente para llegar ahí: `--success` bajó de L .624 a .530 y
`--muted-foreground` de L .551 a .530.

## Drag & drop con teclado

Ambos usan `KeyboardSensor` de dnd-kit:

* **Galería** (`SortableImageGallery`): `sortableKeyboardCoordinates` como
  `coordinateGetter`; el asa es un `<button>` real con `aria-label`
  ("Reordenar imagen N"), así que se alcanza con Tab y se mueve con
  Espacio + flechas.
* **Kanban** (`OrdersKanban`): `KeyboardSensor` en el `DndContext`; cada
  tarjeta arrastrable expone un asa `<button>` con `aria-label` ("Mover pedido
  #xxxx"). Las tarjetas de la columna "Cancelado" no son arrastrables por
  diseño (la RLS no deja al vendedor cancelar).

`PointerSensor` lleva `activationConstraint: { distance: 6 }` en los dos: sin
esa distancia, un clic en "quitar imagen" se interpretaba como inicio de
arrastre.

## Comandos de verificación

| Comando | Resultado |
|---|---|
| `npm run lint` | exit 0, sin avisos |
| `npm run type-check` | exit 0 |
| `npm run build` | exit 0, 14 rutas + middleware |

## Limitación conocida del entorno de verificación

El navegador usado para comprobar estas pantallas corre con
`visibilityState: "hidden"`, y en ese estado `requestAnimationFrame` está
pausado. Eso tiene dos efectos que **no** son defectos del código:

1. React no revela los límites de `Suspense` en la carga inicial (deja el
   contenido en un `<div id="S:0">` sin hidratar). Las pantallas se
   verificaron por navegación de cliente, que no depende de eso.
2. Los componentes de Base UI que animan su entrada/salida (`Sheet`,
   `DropdownMenu`, `Dialog`) abren pero no completan el cierre, porque esperan
   un `transitionend` que un documento oculto nunca emite.

Ambos comportamientos desaparecen en un navegador normal. Conviene repasar a
mano el menú móvil y los desplegables antes de dar la sesión por cerrada.
