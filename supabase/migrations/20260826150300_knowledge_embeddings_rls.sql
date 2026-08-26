-- Políticas RLS de knowledge_embeddings (Fase 4.1, decisión 1: la IA exige
-- sesión). Mismas convenciones que 20260821130000_create_rls_policies.sql:
-- (select auth.uid()) como initplan, rol explícito por política, GRANTs
-- agrupados al final y omitidos a propósito donde no corresponde.

-- SELECT: solo authenticated, NUNCA anon. Dos razones (documentadas en la
-- spec): (1) evita que la pestaña "Resultados con IA" y los asistentes
-- queden medio-rotos para un anónimo (verían la pestaña pero sin acceso real
-- a los datos); se resuelve mostrando el aviso de login en la UI en vez de
-- exponer la tabla; (2) protege la cuota gratuita mensual de Hugging Face de
-- tráfico anónimo. Los productos inactivos no se filtran aquí: la
-- hidratación contra `products` (vector-search.service, Fase 4.4) descarta
-- los inactivos y las fichas huérfanas.
create policy "knowledge_embeddings_select_authenticated"
on public.knowledge_embeddings for select
to authenticated
using (true);

-- INSERT/UPDATE/DELETE: sin política y sin GRANT (ver abajo). Solo escribe
-- el cliente admin (service role), que bypasea RLS por completo desde
-- embedding.service.ts, invocado únicamente por app/api/v1/reindex/route.ts
-- y scripts/index-all.ts (Fase 4.3) — nunca desde el navegador.

grant select on public.knowledge_embeddings to authenticated;
