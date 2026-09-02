-- ============================================================
-- SEED DE PRODUCCIÓN — MercadoTech (Fase 7.4, sesión 7)
-- ============================================================
--
-- ESTE ARCHIVO NO ES `seed.sql`. Son dos cosas distintas y confundirlas es el
-- error más caro de esta sesión:
--
--   supabase/seed.sql       laboratorio. Lo aplica `supabase db reset` contra
--                           el Supabase LOCAL. Trae 6 usuarios con contraseña
--                           conocida, 16 productos inventados, pedidos y
--                           reseñas. JAMÁS se ejecuta contra producción.
--   supabase/seed.prod.sql  este archivo. Se pega UNA vez en el SQL Editor
--                           del proyecto hosted, después de `supabase db push`.
--
-- QUÉ TRAE Y POR QUÉ:
--
--   8 categorías  — son la estructura del catálogo, no datos de muestra: sin
--                   ellas nadie puede publicar un producto, porque el
--                   formulario exige categoría.
--   10 artículos  — la FAQ real que responde el asistente de soporte. Es el
--     de FAQ        mismo contenido del seed de laboratorio porque ese
--                   contenido siempre fue real: está escrito para usuarios,
--                   no para tests.
--
-- QUÉ NO TRAE, A PROPÓSITO (decisión 6 de la spec):
--
--   SIN usuarios    los de laboratorio tienen contraseñas conocidas y
--                   públicas en el repositorio. En producción se registra
--                   gente real, por el formulario, como corresponde.
--   SIN productos   un marketplace de verdad nace vacío: el catálogo lo
--                   llenan los vendedores. Ver la home con su `EmptyState` no
--                   es un fallo del despliegue, es el estado correcto de una
--                   tienda recién abierta.
--   SIN pedidos, reseñas, preguntas ni tickets — todos cuelgan de usuarios y
--                   productos que aquí no existen.
--
-- DESPUÉS DE EJECUTARLO, un paso más: los 10 artículos quedan sembrados pero
-- SIN sus embeddings, y hasta que los tengan `/soporte` responderá "no
-- encontré información". Hay que indexarlos una vez:
--
--   NEXT_PUBLIC_SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<clave> --   HUGGINGFACEHUB_API_TOKEN=<token> npx tsx scripts/index-all.ts
--
-- Es idempotente: se puede ejecutar de nuevo sin duplicar nada.
-- ============================================================

-- ============================================================
-- 1. CATEGORÍAS (8) — estructura del catálogo
-- ============================================================
insert into public.categories (id, name, slug) values
  ('d0000000-0000-0000-0000-000000000001', 'Laptops', 'laptops'),
  ('d0000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones'),
  ('d0000000-0000-0000-0000-000000000003', 'Componentes de PC', 'componentes-pc'),
  ('d0000000-0000-0000-0000-000000000004', 'Audio', 'audio'),
  ('d0000000-0000-0000-0000-000000000005', 'Gaming', 'gaming'),
  ('d0000000-0000-0000-0000-000000000006', 'Monitores', 'monitores'),
  ('d0000000-0000-0000-0000-000000000007', 'Accesorios', 'accesorios'),
  ('d0000000-0000-0000-0000-000000000008', 'Redes', 'redes');

-- ============================================================
-- 2. ARTÍCULOS DE SOPORTE / FAQ (10) — base del RAG de /soporte
-- ============================================================
insert into public.support_articles (id, title, content, category, is_published) values
  ('70000000-0000-0000-0000-000000000001', '¿Cuánto demora el envío de mi pedido?',
   'Los tiempos de entrega dependen de tu distrito y del vendedor. En Lima Metropolitana, la mayoría de pedidos llegan entre 2 y 4 días hábiles después de que el vendedor los despacha. Para provincias, el rango habitual es de 4 a 8 días hábiles, dependiendo del operador logístico y la zona.

Puedes ver el estado de tu pedido en todo momento desde la sección "Mis pedidos": los estados posibles son pendiente, pagado, enviado y entregado. Cuando el vendedor marca un pedido como "enviado", normalmente ya cuenta con un código de seguimiento que también aparece ahí.

Si tu pedido lleva más de 10 días hábiles en estado "pagado" sin pasar a "enviado", te recomendamos contactar directamente al vendedor desde la sección de preguntas del producto, o abrir un ticket de soporte para que un agente revise el caso.',
   'envíos', true),
  ('70000000-0000-0000-0000-000000000002', '¿Los envíos a provincia tienen costo adicional?',
   'El costo de envío varía según el vendedor, el peso/tamaño del producto y el destino. Algunos vendedores ofrecen envío gratuito para compras sobre cierto monto; esa información, cuando aplica, se muestra en la página del producto antes de agregarlo al carrito.

Para provincias alejadas de la costa (selva y zonas altoandinas), es común que el costo sea algo mayor debido a la logística adicional que requieren los operadores de transporte.

Si tienes dudas sobre el costo de envío a tu ciudad para un producto específico, puedes preguntarle directamente al vendedor usando la sección de preguntas y respuestas de ese producto, antes de comprar.',
   'envíos', true),
  ('70000000-0000-0000-0000-000000000003', '¿Puedo cambiar la dirección de entrega después de comprar?',
   'Si tu pedido todavía está en estado "pendiente" o "pagado" (aún no ha sido despachado), puedes solicitar el cambio de dirección contactando directamente al vendedor a través de la sección de preguntas del producto o abriendo un ticket de soporte.

Una vez que el pedido pasa a estado "enviado", ya no es posible modificar la dirección, porque el paquete ya fue entregado al operador logístico con los datos originales.

Recomendamos siempre verificar tu dirección de entrega, referencia y número de contacto antes de confirmar la compra, para evitar contratiempos en la entrega.',
   'envíos', true),
  ('70000000-0000-0000-0000-000000000004', '¿Qué métodos de pago están disponibles?',
   'MercadoTech es una plataforma de demostración: el checkout simula el proceso de compra (crea el pedido y descuenta el stock) pero no procesa cobros reales ni solicita datos de tarjetas. Ningún pedido genera un cargo verdadero.

En una plataforma real, esta sección explicaría los métodos disponibles (tarjetas de crédito/débito, billeteras digitales, pago contra entrega, etc.) y sus tiempos de acreditación. Aquí, el estado "pagado" de un pedido representa ese paso simulado dentro del flujo de compra.

Si tienes dudas sobre por qué tu pedido aparece en un estado distinto al esperado, revisa la sección "Mis pedidos" o contacta a soporte.',
   'pagos', true),
  ('70000000-0000-0000-0000-000000000005', '¿Por qué mi pedido sigue en estado "pendiente"?',
   'Un pedido queda en estado "pendiente" apenas se crea, antes de que se registre el pago (simulado en esta plataforma). Es el primer paso del flujo y es completamente normal que permanezca así por un tiempo breve.

Si notas que un pedido lleva varias horas en "pendiente" sin avanzar a "pagado", puede deberse a una demora del vendedor en procesarlo. Te recomendamos revisar nuevamente en un rato o contactar al vendedor.

Ningún monto se cobra realmente en esta plataforma: el estado "pendiente" no implica ningún cargo pendiente de tu parte.',
   'pagos', true),
  ('70000000-0000-0000-0000-000000000006', '¿Cómo sé si un cobro fue correcto?',
   'Como se explica en el artículo sobre métodos de pago, MercadoTech no realiza cobros reales: es un entorno de práctica y demostración. El estado "pagado" de un pedido es una simulación del flujo de checkout, no un cargo efectivo a ningún medio de pago.

En una plataforma real, aquí encontrarías instrucciones para verificar un cobro: revisar el comprobante enviado por correo, contrastar el monto con el resumen de tu pedido, y qué hacer ante un cobro duplicado o incorrecto.

Si algo en el monto total de tu pedido no coincide con lo esperado (por ejemplo, precio o cantidad), contáctanos mediante un ticket de soporte con el número de pedido.',
   'pagos', true),
  ('70000000-0000-0000-0000-000000000007', '¿Cómo solicito la devolución de un producto?',
   'Puedes solicitar la devolución de un producto dentro de los 7 días calendario posteriores a que el pedido pase a estado "entregado". Para iniciarla, abre un ticket de soporte indicando el número de pedido, el producto y el motivo de la devolución.

Los productos deben devolverse en las mismas condiciones en que fueron recibidos: sin señales de uso excesivo, con su empaque original y accesorios completos, salvo que la devolución se deba a un defecto de fábrica.

Una vez que el vendedor confirma la recepción y buen estado del producto devuelto, se coordina el reembolso o cambio según corresponda. Los tiempos de respuesta del vendedor pueden variar, pero soporte hace seguimiento si no hay respuesta en 48 horas.',
   'devoluciones', true),
  ('70000000-0000-0000-0000-000000000008', '¿Qué pasa si el producto llega dañado o incompleto?',
   'Si tu producto llega con daños visibles, defectos de fábrica o le falta algún accesorio indicado en la publicación, debes reportarlo cuanto antes abriendo un ticket de soporte con fotos del producto y del empaque recibido.

Este tipo de casos tiene prioridad sobre una devolución por simple arrepentimiento: el vendedor es responsable de resolverlo mediante cambio, reposición del accesorio faltante o reembolso, sin costo adicional para ti.

Te recomendamos revisar el pedido apenas lo recibes, antes de deshacerte del empaque, ya que puede ser solicitado como parte del proceso de reclamo.',
   'devoluciones', true),
  ('70000000-0000-0000-0000-000000000009', '¿Cómo actualizo mis datos de cuenta?',
   'Puedes actualizar tu nombre visible, teléfono y foto de perfil desde la sección de tu cuenta una vez que hayas iniciado sesión. Los cambios se guardan de inmediato y se reflejan en tus futuras preguntas, reseñas y pedidos.

El correo electrónico con el que te registraste identifica tu cuenta y no se puede editar libremente por motivos de seguridad; si necesitas cambiarlo, debes contactar a soporte mediante un ticket.

Tu rol dentro de la plataforma (comprador, vendedor o administrador) tampoco puede modificarlo el propio usuario: solo el equipo de MercadoTech puede otorgar o cambiar el rol de vendedor.',
   'cuenta', true),
  ('70000000-0000-0000-0000-000000000010', '¿Cómo me convierto en vendedor dentro de MercadoTech?',
   'Para operar como vendedor necesitas que tu cuenta tenga el rol "seller" habilitado. Esto no lo puede activar el propio usuario desde su perfil: es una validación que realiza el equipo de MercadoTech para mantener la calidad del catálogo.

Una vez habilitado como vendedor, podrás publicar productos con su galería de imágenes, gestionar tu stock y precios, responder preguntas de compradores sobre tus productos y hacer seguimiento a tus pedidos desde tu panel de vendedor.

Si quieres solicitar el rol de vendedor, abre un ticket de soporte indicando el tipo de productos que planeas vender.',
   'cuenta', true);

-- ============================================================
-- Verificación (debe devolver 8 y 10):
--   select count(*) from public.categories;
--   select count(*) from public.support_articles where is_published;
-- Y después de correr index-all.ts, 10 embeddings:
--   select count(*) from public.knowledge_embeddings;
-- ============================================================
