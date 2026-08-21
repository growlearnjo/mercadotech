# CLAUDE.md — MercadoTech

Este documento es el contrato entre el equipo y Claude Code. Léelo antes de
generar código en este repositorio.

## Qué es MercadoTech (y qué NO es)

MercadoTech es un marketplace de productos tecnológicos: compradores navegan
un catálogo, ven detalle con galería de imágenes, preguntas y respuestas y
reseñas verificadas, agregan al carrito y hacen checkout; vendedores publican
productos y gestionan pedidos; un asistente de soporte (RAG desde la sesión 4,
agente de voz desde la sesión 8) responde con base en la FAQ de la plataforma;
un admin modera y mantiene la base de conocimiento.

**NO hay pasarela de pago real en ningún momento del proyecto.** El checkout
es simulado: crea el pedido y descuenta stock, sin cobrar.

## Comandos

Convención objetivo (se completa a medida que cada sesión los habilita):

```bash
npm run dev         # servidor de desarrollo (Next.js, Turbopack)
npm run build       # build de producción
npm run lint        # ESLint
npm run type-check  # tsc --noEmit
npm run test        # Vitest (unit) — desde la sesión 6
npm run test:e2e    # Playwright (E2E) — desde la sesión 6
```

## Arquitectura por capas

```
components/       Presentación PURA. Reciben props, no hacen fetching, no conocen Supabase.
hooks/             Estado de cliente. Llaman a services. Cero lógica de negocio propia.
services/          Lógica de negocio. Cada función acepta un SupabaseClient INYECTABLE
                   (default: cliente de navegador) — así hooks y Route Handlers comparten
                   la misma lógica, y los tests la mockean sin red.
lib/supabase/      Clientes: browser (anon), server (cookies+RLS), admin (service role).
lib/ai/            ÚNICOS archivos que conocen la API del proveedor de IA.
lib/voice/         ÚNICOS archivos que conocen la API de voz del navegador/proveedor.
lib/validators/    Validación framework-agnóstica, compartida entre UI y servidor.
lib/constants/     Todos los tunables (IA, roles, límites) centralizados y documentados.
types/             Tipos de dominio + database.ts generado por Supabase.
app/api/v1/        Route Handlers DELGADOS, solo para lo que no puede correr en el
                   navegador (secretos de IA, service role, cookies de sesión).
```

Reglas de independencia (aplican en todas las sesiones):

1. **Un archivo, una responsabilidad.** `product.service.ts` no sabe de pedidos;
   `order.service.ts` no sabe de embeddings.
2. **Sin barrels.** Se importa el archivo específico, nunca "todo el módulo".
3. **La UI nunca importa `lib/ai/`, `lib/voice/` ni el cliente admin**
   (`lib/supabase/admin.ts`).
4. **Un solo camino de datos:** hooks → services → Supabase (RLS). NO se
   construye una capa REST paralela "por si acaso" (lección de ReadHub: quedó
   una API v1 completa que el frontend nunca llamó).
5. **Todo tunable vive en `lib/constants/`** con un comentario que justifica
   su valor.

## Convenciones de código

* TypeScript estricto (`strict: true`), sin `any` implícito.
* Español para comentarios y documentación; inglés para identificadores
  (variables, funciones, tipos, archivos).
* Servicios: `<dominio>.service.ts` (ej. `product.service.ts`).
* Hooks: `use<Dominio>.ts` (ej. `useProducts.ts`).

## Fuente de verdad de la base de datos

Desde la sesión 2, `supabase/migrations/` es la ÚNICA fuente de verdad del
esquema. `supabase/schema.sql` y `supabase/policies.sql` son copias de
referencia legibles, generadas a partir de las migraciones — nunca al revés.

## Regla de sesiones

Cada sesión tiene su especificación completa en `MercadoTech_sesionN.md`. No
se adelanta trabajo de fases o sesiones futuras, incluso si parece trivial
hacerlo ahora.
