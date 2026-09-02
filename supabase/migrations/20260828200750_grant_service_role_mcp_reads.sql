-- ============================================================
-- GRANTs de lectura para service_role (sesión 5, servidor MCP)
-- ============================================================
-- Por qué existe esta migración: hasta la sesión 4, el único consumidor de
-- estas tablas era la aplicación web, que corre como rol `authenticated`. El
-- servidor MCP es el primero que corre como `service_role`, y ahí salió a la
-- luz un supuesto equivocado: **bypasear RLS no es lo mismo que tener
-- privilegios de tabla**. `service_role` ignora las políticas, pero Postgres
-- sigue exigiendo el GRANT, y el esquema solo se lo había dado sobre
-- products, categories, support_articles y knowledge_embeddings.
--
-- Sin esto, cuatro tools del MCP fallan con 42501 (permission denied):
--   * get_order_status y el top de vendidos de get_store_stats → orders/order_items
--   * semantic_search_products, ask_assistant y find_related_products →
--     la función match_knowledge, cuyo EXECUTE solo tenía `authenticated`
--
-- Alcance deliberadamente mínimo: SELECT, nunca escritura. El servidor MCP es
-- de solo lectura y ninguna tool inserta, actualiza ni borra. Que estas
-- tablas sean legibles por service_role NO las expone: el MCP proyecta campo
-- por campo y jamás devuelve buyer_id, dirección de envío ni identidad alguna
-- del comprador (ver mcp/src/tools/get-order-status.ts).

grant select on public.orders to service_role;
grant select on public.order_items to service_role;

-- El catálogo se lee siempre con el MISMO select de product.service.ts
-- ("*, categories!inner(slug), product_images(...), reviews(rating)"), así que
-- hidratar un resultado de búsqueda semántica toca estas dos tablas además de
-- products. Ambas ya son públicas para anon vía RLS: esto no abre nada nuevo,
-- solo alinea a service_role con lo que cualquier visitante ya puede leer.
grant select on public.product_images to service_role;
grant select on public.reviews to service_role;

-- profiles NO es público (política profiles_select_own_or_admin). Se concede
-- para el resource mercadotech://sellers/{id}, que expone ÚNICAMENTE
-- display_name y los productos activos del vendedor — nunca phone, email ni
-- rol. La restricción real vive en el código del resource, no aquí.
grant select on public.profiles to service_role;

-- match_knowledge es SECURITY DEFINER y ya filtra por umbral y tipo de
-- fuente: darle EXECUTE a service_role no amplía lo que se puede leer, solo
-- permite que el MCP haga la MISMA búsqueda vectorial que ya hace la web.
-- El tipo va calificado como `extensions.vector` y no como `vector` a secas:
-- pgvector se instala en el schema `extensions`, que está en el search_path
-- del stack LOCAL pero no en el de Supabase hosted. Sin calificar, esta línea
-- pasaba en local y reventaba en producción con 42704 ("type vector does not
-- exist") — el primer `db push` real lo destapó. La migración hermana
-- (20260826150200_create_match_knowledge) ya lo escribía así.
grant execute on function public.match_knowledge(extensions.vector, text, integer, double precision) to service_role;
