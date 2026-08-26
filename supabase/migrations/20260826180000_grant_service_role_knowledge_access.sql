-- GRANTs para service_role — Fase 4.3 (indexación).
--
-- Este proyecto NUNCA otorga privilegios por default (no hay
-- ALTER DEFAULT PRIVILEGES ni un GRANT ALL ON ALL TABLES): cada rol recibe
-- exactamente lo que sus políticas necesitan, tabla por tabla (convención
-- de 20260821130000_create_rls_policies.sql). Hasta esta sesión ningún
-- código usaba el cliente admin (service role) para tocar tablas de
-- dominio — lib/supabase/admin.ts existía pero nada lo llamaba — así que el
-- hueco nunca se manifestó. La Fase 4.1 ya cubrió knowledge_embeddings para
-- anon/authenticated, pero olvidó que service_role BYPASEA RLS, NO los
-- GRANTs: sin esto, embedding.service.ts falla con
-- "permission denied for table products" (42501) al indexar (misma lección
-- de ReadHub que motivó los GRANTs de la Fase 2.3: RLS sin GRANT = error
-- opaco — aquí aplica también al rol que bypasea RLS).
--
-- service_role necesita:
-- * SELECT en products y support_articles: son las fuentes que
--   embedding.service.ts lee para armar el texto a vectorizar.
-- * SELECT en categories: products.categories(name) es un join embebido en
--   esa misma consulta (nombre de categoría → texto del embedding).
-- * ALL en knowledge_embeddings: es el único rol que escribe ahí (Fase 4.1:
--   sin política ni GRANT para authenticated en INSERT/UPDATE/DELETE).
grant select on public.products to service_role;
grant select on public.support_articles to service_role;
grant select on public.categories to service_role;
grant select, insert, update, delete on public.knowledge_embeddings to service_role;
